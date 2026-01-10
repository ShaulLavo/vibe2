import type {
	ContentHandleFactory,
	TrackOptions,
	SyncEventType,
	SyncEventHandler,
	WriteToken,
	ExternalChangeEvent,
	ConflictEvent,
	ReloadedEvent,
	LocalChangesDiscardedEvent,
	DeletedEvent,
	SyncedEvent,
} from './types'
import type { FsContext } from '../vfs/types'
import type { FileSystemChangeRecord } from '../FileSystemObserver'
import { FileStateTracker } from './file-state-tracker'
import { WriteTokenManager } from './write-token-manager'
import { ByteContentHandleFactory } from './content-handle'
import {
	FileSystemObserverManager,
	type ObserverStrategy,
} from './observer-strategy'

/**
 * Options for FileSyncManager
 */
export interface FileSyncManagerOptions {
	/** The FsContext to use for file operations */
	fs: FsContext
	/** Debounce window for batching changes (default: 100ms) */
	debounceMs?: number
	/** Write token expiry time (default: 5000ms) */
	tokenExpiryMs?: number
	/** Custom content handle factory (for future CRDT support) */
	contentHandleFactory?: ContentHandleFactory
}

/**
 * Central coordinator that manages all file tracking operations
 */
export class FileSyncManager {
	private readonly fs: FsContext
	private readonly debounceMs: number
	private readonly contentHandleFactory: ContentHandleFactory
	private readonly writeTokenManager: WriteTokenManager
	private readonly observerManager: FileSystemObserverManager
	private readonly trackers = new Map<string, FileStateTracker>()
	private readonly eventHandlers = new Map<
		SyncEventType,
		Set<SyncEventHandler<any>>
	>()
	private observerStrategy: ObserverStrategy | null = null
	private observerUnsubscribe: (() => void) | null = null
	private debounceTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

	constructor(options: FileSyncManagerOptions) {
		this.fs = options.fs
		this.debounceMs = options.debounceMs ?? 100
		this.contentHandleFactory =
			options.contentHandleFactory ?? ByteContentHandleFactory
		this.writeTokenManager = new WriteTokenManager({
			tokenExpiryMs: options.tokenExpiryMs,
		})
		this.observerManager = new FileSystemObserverManager()
	}

	/**
	 * Register a file for tracking
	 */
	async track(
		path: string,
		options: TrackOptions = {}
	): Promise<FileStateTracker> {
		// Check if already tracking
		const existingTracker = this.trackers.get(path)
		if (existingTracker) {
			return existingTracker
		}

		// Get initial content and mtime
		let initialContent: Uint8Array
		let initialMtime: number

		if (options.initialContent) {
			// Use provided initial content
			if (typeof options.initialContent === 'string') {
				initialContent = new TextEncoder().encode(options.initialContent)
			} else {
				initialContent = options.initialContent
			}
			// Get current mtime from disk
			try {
				const file = this.fs.file(path, 'r')
				initialMtime = await file.lastModified()
			} catch {
				// File doesn't exist yet, use current time
				initialMtime = Date.now()
			}
		} else {
			// Read from disk
			try {
				const file = this.fs.file(path, 'r')
				const content = await file.text()
				initialContent = new TextEncoder().encode(content)
				initialMtime = await file.lastModified()
			} catch {
				// File doesn't exist, start with empty content
				initialContent = new Uint8Array(0)
				initialMtime = Date.now()
			}
		}

		// Create content handle
		const initialHandle = this.contentHandleFactory.fromBytes(initialContent)

		// Create tracker
		const mode = options.reactive ? 'reactive' : 'tracked'
		const tracker = new FileStateTracker(
			path,
			mode,
			initialHandle,
			initialMtime,
			this.contentHandleFactory,
			this.fs
		)

		// Store tracker
		this.trackers.set(path, tracker)

		// Start observing if this is the first tracker
		await this.ensureObserverStarted()

		return tracker
	}

	/**
	 * Stop tracking a file
	 */
	untrack(path: string): void {
		const tracker = this.trackers.get(path)
		if (!tracker) {
			return
		}

		// Remove tracker
		this.trackers.delete(path)

		// Clear any pending write tokens for this path
		this.writeTokenManager.clearToken(path)

		// Stop observing if no more trackers
		if (this.trackers.size === 0) {
			this.stopObserver()
		}
	}

	/**
	 * Get tracker for a path (if tracked)
	 */
	getTracker(path: string): FileStateTracker | undefined {
		return this.trackers.get(path)
	}

	/**
	 * Notify the manager that a write is about to happen (returns token)
	 */
	beginWrite(path: string): WriteToken {
		return this.writeTokenManager.generateToken(path)
	}

	/**
	 * Confirm write completed (clears token on observer match)
	 */
	endWrite(token: WriteToken): void {
		// The token will be automatically cleared when the observer
		// detects the change and matches it against the token
		// This method is here for API completeness and future use
	}

	/**
	 * Subscribe to sync events
	 */
	on<E extends SyncEventType>(
		event: E,
		handler: SyncEventHandler<E>
	): () => void {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set())
		}
		const handlers = this.eventHandlers.get(event)!
		handlers.add(handler)

		// Return unsubscribe function
		return () => {
			handlers.delete(handler)
			if (handlers.size === 0) {
				this.eventHandlers.delete(event)
			}
		}
	}

	/**
	 * Emit a sync event to all registered handlers
	 */
	private emit<E extends SyncEventType>(
		event: E,
		eventData: Parameters<SyncEventHandler<E>>[0]
	): void {
		const handlers = this.eventHandlers.get(event)
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(eventData)
				} catch (error) {
					console.error(`Error in sync event handler for ${event}:`, error)
				}
			}
		}
	}

	/**
	 * Dispose all resources
	 */
	dispose(): void {
		// Clear all trackers
		this.trackers.clear()

		// Clear all event handlers
		this.eventHandlers.clear()

		// Dispose write token manager
		this.writeTokenManager.dispose()

		// Disconnect all observers
		this.stopObserver()
	}

	/**
	 * Ensure observer is started for the root directory
	 */
	private async ensureObserverStarted(): Promise<void> {
		if (this.observerStrategy) {
			return // Already started
		}

		// Create observer strategy
		this.observerStrategy = this.observerManager.createStrategy()

		// Subscribe to change events
		this.observerUnsubscribe = this.observerStrategy.on('change', (changes) => {
			this.handleFileSystemChanges(changes)
		})

		// Start observing the root directory
		try {
			await this.observerStrategy.observe(this.fs.root)
		} catch (error) {
			console.error('Failed to start file system observer:', error)
			// Fall back to polling strategy if native fails
			if (this.observerStrategy instanceof (await import('./observer-strategy')).NativeObserverStrategy) {
				this.stopObserver()
				this.observerStrategy = new (await import('./observer-strategy')).PollingObserverStrategy()
				this.observerUnsubscribe = this.observerStrategy.on('change', (changes) => {
					this.handleFileSystemChanges(changes)
				})
				await this.observerStrategy.observe(this.fs.root)
			}
		}
	}

	/**
	 * Stop the observer
	 */
	private stopObserver(): void {
		if (this.observerUnsubscribe) {
			this.observerUnsubscribe()
			this.observerUnsubscribe = null
		}
		if (this.observerStrategy) {
			this.observerStrategy.disconnect()
			this.observerStrategy = null
		}
		// Clear any pending debounce timeouts
		for (const timeout of this.debounceTimeouts.values()) {
			clearTimeout(timeout)
		}
		this.debounceTimeouts.clear()
	}

	/**
	 * Handle file system changes from the observer
	 */
	private handleFileSystemChanges(changes: FileSystemChangeRecord[]): void {
		// Group changes by path for debouncing
		const changesByPath = new Map<string, FileSystemChangeRecord[]>()

		for (const change of changes) {
			const path = change.relativePathComponents.join('/')
			if (!changesByPath.has(path)) {
				changesByPath.set(path, [])
			}
			changesByPath.get(path)!.push(change)
		}

		// Process each path with debouncing
		for (const [path, pathChanges] of changesByPath) {
			// Clear existing timeout for this path
			const existingTimeout = this.debounceTimeouts.get(path)
			if (existingTimeout) {
				clearTimeout(existingTimeout)
			}

			// Set new debounced timeout
			const timeout = setTimeout(() => {
				this.debounceTimeouts.delete(path)
				this.processPathChanges(path, pathChanges)
			}, this.debounceMs)

			this.debounceTimeouts.set(path, timeout)
		}
	}

	/**
	 * Process changes for a specific path after debouncing
	 */
	private async processPathChanges(
		path: string,
		changes: FileSystemChangeRecord[]
	): Promise<void> {
		const tracker = this.trackers.get(path)
		if (!tracker) {
			return // Not tracking this file
		}

		// Get the latest change (after debouncing, we only care about final state)
		const latestChange = changes[changes.length - 1]

		try {
			if (latestChange.type === 'disappeared') {
				// File was deleted
				this.emit<'deleted'>('deleted', {
					type: 'deleted',
					path,
				})
				return
			}

			if (latestChange.type === 'appeared' || latestChange.type === 'modified') {
				// File was created or modified
				await this.handleFileChange(path, tracker)
			}
		} catch (error) {
			console.error(`Error processing changes for ${path}:`, error)
		}
	}

	/**
	 * Handle a file change (creation or modification)
	 */
	private async handleFileChange(
		path: string,
		tracker: FileStateTracker
	): Promise<void> {
		try {
			// Read current disk content and mtime
			const file = this.fs.file(path, 'r')
			const diskContentStr = await file.text()
			const diskMtime = await file.lastModified()

			// Check if this change matches a pending write token
			const matchedToken = this.writeTokenManager.matchToken(path, diskMtime)
			if (matchedToken) {
				// This is a self-triggered change, update tracker state
				const diskContent = new TextEncoder().encode(diskContentStr)
				tracker.markSynced(diskContent, diskMtime)
				this.emit<'synced'>('synced', {
					type: 'synced',
					path,
				})
				return
			}

			// This is an external change
			const diskContent = new TextEncoder().encode(diskContentStr)
			tracker.updateDiskState(diskContent, diskMtime)

			const syncState = tracker.syncState

			if (tracker.mode === 'reactive') {
				// Reactive files auto-reload regardless of local changes
				const hadLocalChanges = tracker.isDirty
				const newContent = this.contentHandleFactory.fromBytes(diskContent)
				
				// Update local content to match disk
				tracker.setLocalContent(diskContent)
				tracker.markSynced(diskContent, diskMtime)

				// Emit events
				this.emit<'reloaded'>('reloaded', {
					type: 'reloaded',
					path,
					newContent,
				})

				if (hadLocalChanges) {
					this.emit<'local-changes-discarded'>('local-changes-discarded', {
						type: 'local-changes-discarded',
						path,
					})
				}
			} else {
				// Regular tracked files
				if (syncState === 'external-changes') {
					// No local changes, just external changes
					this.emit<'external-change'>('external-change', {
						type: 'external-change',
						path,
						newMtime: diskMtime,
					})
				} else if (syncState === 'conflict') {
					// Both local and external changes - conflict!
					this.emit<'conflict'>('conflict', {
						type: 'conflict',
						path,
						baseContent: tracker.getBaseContent(),
						localContent: tracker.getLocalContent(),
						diskContent: tracker.getDiskContent(),
					})
				}
			}
		} catch (error) {
			console.error(`Error handling file change for ${path}:`, error)
		}
	}
}