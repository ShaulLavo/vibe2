import { batch } from 'solid-js'
import type { FilePath } from '@repo/fs'
import type { ParseResult, PieceTableSnapshot } from '@repo/utils'
import type { VisibleContentSnapshot } from '@repo/code-editor'
import {
	type FileState,
	type FileStateUpdate,
	type FileStateSubscriber,
	type FileStateEvent,
	type FileStateEventHandler,
	type SharedBuffer,
	type ScrollPosition,
	type SyntaxData,
	createEmptyFileState,
} from './types'
import { timestamp } from '../freshness'
import type { ViewMode } from '../types/ViewMode'

export interface PersistenceBackend {
	load(path: FilePath): Promise<Partial<FileState> | null>
	save(path: FilePath, state: FileState): Promise<void>
	remove(path: FilePath): Promise<void>
	clear(): Promise<void>
}

export interface FileStateStoreOptions {
	persistence?: PersistenceBackend
	persistenceDebounceMs?: number
	maxMemoryEntries?: number
}

export class FileStateStore {
	private files = new Map<FilePath, FileState>()
	private subscribers = new Map<FilePath, Set<FileStateSubscriber>>()
	private globalSubscribers = new Set<FileStateEventHandler>()
	private pendingPersistence = new Set<FilePath>()
	private persistenceTimeout: ReturnType<typeof setTimeout> | null = null
	private readonly persistence?: PersistenceBackend
	private readonly persistenceDebounceMs: number
	private readonly maxMemoryEntries: number

	constructor(options: FileStateStoreOptions = {}) {
		this.persistence = options.persistence
		this.persistenceDebounceMs = options.persistenceDebounceMs ?? 150
		this.maxMemoryEntries = options.maxMemoryEntries ?? 1000
	}

	get(path: FilePath): FileState | undefined {
		const state = this.files.get(path)
		if (state) {
			state.lastAccessed = Date.now()
		}
		return state
	}

	async getAsync(path: FilePath): Promise<FileState | undefined> {
		const memoryState = this.get(path)
		if (memoryState) return memoryState

		if (this.persistence) {
			const persisted = await this.persistence.load(path)
			if (persisted) {
				const state = { ...createEmptyFileState(path), ...persisted }
				this.files.set(path, state)
				this.emitEvent({ type: 'created', path, state })
				return state
			}
		}

		return undefined
	}

	getOrCreate(path: FilePath): FileState {
		let state = this.files.get(path)
		if (!state) {
			state = createEmptyFileState(path)
			this.files.set(path, state)
			this.emitEvent({ type: 'created', path, state })
		} else {
			state.lastAccessed = Date.now()
		}
		return state
	}

	update(path: FilePath, update: FileStateUpdate): void {
		const state = this.getOrCreate(path)
		const updatedFields: (keyof FileState)[] = []

		batch(() => {
			for (const [key, value] of Object.entries(update)) {
				if (value !== undefined && key !== 'path') {
					const typedKey = key as keyof FileStateUpdate
					;(state as unknown as Record<string, unknown>)[typedKey] = value
					updatedFields.push(typedKey)
				}
			}
			state.lastAccessed = Date.now()
		})

		this.notifySubscribers(path, state)
		this.emitEvent({ type: 'updated', path, state, fields: updatedFields })
		this.schedulePersistence(path)
	}

	async remove(path: FilePath): Promise<void> {
		const state = this.files.get(path)
		if (state) {
			state.buffer?.dispose()
			this.files.delete(path)
			this.subscribers.delete(path)
			this.emitEvent({ type: 'removed', path })
		}

		if (this.persistence) {
			await this.persistence.remove(path)
		}
	}

	has(path: FilePath): boolean {
		return this.files.has(path)
	}

	keys(): FilePath[] {
		return Array.from(this.files.keys())
	}

	async clear(): Promise<void> {
		for (const state of this.files.values()) {
			state.buffer?.dispose()
		}

		this.files.clear()
		this.subscribers.clear()
		this.pendingPersistence.clear()

		if (this.persistence) {
			await this.persistence.clear()
		}
	}

	setBuffer(path: FilePath, buffer: SharedBuffer | null): void {
		this.update(path, { buffer })
	}

	setPieceTable(path: FilePath, pieceTable: PieceTableSnapshot | null): void {
		this.update(path, {
			pieceTable: pieceTable ? timestamp(pieceTable) : null,
		})
	}

	setStats(path: FilePath, stats: ParseResult | null): void {
		this.update(path, {
			stats: stats ? timestamp(stats) : null,
			lineStarts: stats?.lineStarts ?? null,
		})
	}

	setSyntax(path: FilePath, syntax: SyntaxData | null): void {
		this.update(path, {
			syntax: syntax ? timestamp(syntax) : null,
		})
	}

	setScrollPosition(path: FilePath, scrollPosition: ScrollPosition | null): void {
		this.update(path, {
			scrollPosition: scrollPosition ? timestamp(scrollPosition) : null,
		})
	}

	setVisibleContent(path: FilePath, visibleContent: VisibleContentSnapshot | null): void {
		this.update(path, {
			visibleContent: visibleContent ? timestamp(visibleContent) : null,
		})
	}

	setViewMode(path: FilePath, viewMode: ViewMode | null): void {
		this.update(path, { viewMode })
	}

	setDirty(path: FilePath, isDirty: boolean): void {
		this.update(path, { isDirty })
	}

	setLoading(path: FilePath): void {
		this.update(path, { loadingState: { status: 'loading' } })
	}

	setLoaded(path: FilePath): void {
		this.update(path, { loadingState: { status: 'loaded' } })
	}

	setError(path: FilePath, error: Error): void {
		this.update(path, { loadingState: { status: 'error', error } })
	}

	subscribe(path: FilePath, callback: FileStateSubscriber): () => void {
		let subs = this.subscribers.get(path)
		if (!subs) {
			subs = new Set()
			this.subscribers.set(path, subs)
		}
		subs.add(callback)

		return () => {
			subs?.delete(callback)
			if (subs?.size === 0) {
				this.subscribers.delete(path)
			}
		}
	}

	subscribeAll(handler: FileStateEventHandler): () => void {
		this.globalSubscribers.add(handler)
		return () => {
			this.globalSubscribers.delete(handler)
		}
	}

	async flush(): Promise<void> {
		if (this.persistenceTimeout) {
			clearTimeout(this.persistenceTimeout)
			this.persistenceTimeout = null
		}

		if (this.persistence && this.pendingPersistence.size > 0) {
			const paths = Array.from(this.pendingPersistence)
			this.pendingPersistence.clear()

			await Promise.all(
				paths.map(async (path) => {
					const state = this.files.get(path)
					if (state) {
						await this.persistence!.save(path, state)
					}
				})
			)
		}
	}

	evictLRU(count: number = 1): FilePath[] {
		const evicted: FilePath[] = []

		const entries = Array.from(this.files.entries()).sort(
			([, a], [, b]) => a.lastAccessed - b.lastAccessed
		)

		for (let i = 0; i < count && i < entries.length; i++) {
			const entry = entries[i]
			if (!entry) continue

			const [path, state] = entry

			if (state.buffer || state.isDirty) continue

			this.files.delete(path)
			this.subscribers.delete(path)
			evicted.push(path)
		}

		return evicted
	}

	get size(): number {
		return this.files.size
	}

	getStats(): {
		fileCount: number
		activeBuffers: number
		dirtyFiles: number
	} {
		let activeBuffers = 0
		let dirtyFiles = 0

		for (const state of this.files.values()) {
			if (state.buffer) activeBuffers++
			if (state.isDirty) dirtyFiles++
		}

		return {
			fileCount: this.files.size,
			activeBuffers,
			dirtyFiles,
		}
	}

	private notifySubscribers(path: FilePath, state: FileState): void {
		const subs = this.subscribers.get(path)
		if (subs) {
			for (const callback of subs) {
				try {
					callback(state)
				} catch (error) {
					console.error('Error in FileStateStore subscriber:', error)
				}
			}
		}
	}

	private emitEvent(event: FileStateEvent): void {
		for (const handler of this.globalSubscribers) {
			try {
				handler(event)
			} catch (error) {
				console.error('Error in FileStateStore event handler:', error)
			}
		}
	}

	private schedulePersistence(path: FilePath): void {
		if (!this.persistence) return

		this.pendingPersistence.add(path)

		if (this.persistenceTimeout) {
			clearTimeout(this.persistenceTimeout)
		}

		this.persistenceTimeout = setTimeout(() => {
			this.flush().catch((error) => {
				console.error('Error flushing FileStateStore persistence:', error)
			})
		}, this.persistenceDebounceMs)

		if (this.files.size > this.maxMemoryEntries) {
			const excess = this.files.size - this.maxMemoryEntries
			this.evictLRU(excess)
		}
	}
}

export function createFileStateStore(
	options?: FileStateStoreOptions
): FileStateStore {
	return new FileStateStore(options)
}
