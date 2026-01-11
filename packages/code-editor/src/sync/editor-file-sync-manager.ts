import type { 
	FileSyncManager, 
	SyncEventType, 
	SyncEventHandler,
	ExternalChangeEvent,
	ConflictEvent,
	DeletedEvent,
	SyncedEvent
} from '@repo/fs'
import type { 
	EditorRegistry, 
	EditorInstance, 
	SyncStatusInfo, 
	EditorSyncConfig,
	ConflictInfo,
	PendingConflict,
	ConflictResolution,
	ConflictResolutionStrategy
} from './types'
import { EditorStateManager } from './editor-state-manager'

/**
 * Simple notification system interface for editor sync notifications
 */
export interface NotificationSystem {
	/** Show a notification to the user */
	showNotification(message: string, type?: 'info' | 'warning' | 'error'): void
}

/**
 * Options for EditorFileSyncManager
 */
export interface EditorFileSyncManagerOptions {
	/** The FileSyncManager instance to use */
	syncManager: FileSyncManager
	/** Configuration options */
	config: EditorSyncConfig
	/** Editor instance registry */
	editorRegistry: EditorRegistry
	/** Optional notification system for user feedback */
	notificationSystem?: NotificationSystem
}

/**
 * Central coordinator that manages file sync integration with the editor.
 * Bridges the File Sync Layer with the code editor to provide real-time file synchronization,
 * conflict resolution UI, and seamless user experience.
 */
export class EditorFileSyncManager {
	private readonly syncManager: FileSyncManager
	private readonly config: EditorSyncConfig
	private readonly editorRegistry: EditorRegistry
	private readonly notificationSystem?: NotificationSystem
	private readonly stateManager: EditorStateManager
	
	/** Map of file paths to their sync status */
	private readonly syncStatuses = new Map<string, SyncStatusInfo>()
	
	/** Map of file paths to their sync event unsubscribers */
	private readonly syncUnsubscribers = new Map<string, (() => void)[]>()
	
	/** Map of file paths to pending conflicts */
	private readonly pendingConflicts = new Map<string, PendingConflict>()
	
	/** Status change event handlers */
	private readonly statusChangeHandlers = new Set<(path: string, status: SyncStatusInfo) => void>()
	
	/** Conflict resolution request handlers */
	private readonly conflictResolutionRequestHandlers = new Set<(path: string, conflictInfo: ConflictInfo) => void>()
	
	/** Registry event unsubscribers */
	private registryUnsubscribers: (() => void)[] = []

	constructor(options: EditorFileSyncManagerOptions) {
		this.syncManager = options.syncManager
		this.config = options.config
		this.editorRegistry = options.editorRegistry
		this.notificationSystem = options.notificationSystem
		this.stateManager = new EditorStateManager()
		
		this.setupRegistryEventHandlers()
	}

	/**
	 * Register a file when opened in editor
	 */
	async registerOpenFile(path: string, editor: EditorInstance): Promise<void> {
		// Skip if already registered
		if (this.syncStatuses.has(path)) {
			return
		}

		try {
			// Track the file with the sync manager
			const tracker = await this.syncManager.track(path, {
				reactive: false, // Use tracked mode for editor integration
			})

			// Initialize sync status
			const initialStatus: SyncStatusInfo = {
				type: tracker.isDirty ? 'dirty' : 'synced',
				lastSyncTime: Date.now(),
				hasLocalChanges: tracker.isDirty,
				hasExternalChanges: tracker.hasExternalChanges,
			}
			
			this.syncStatuses.set(path, initialStatus)

			// Set up event subscriptions for this file
			this.setupFileEventHandlers(path, editor)

			// Emit initial status
			this.emitStatusChange(path, initialStatus)

		} catch (error) {
			// Handle registration errors gracefully
			const errorStatus: SyncStatusInfo = {
				type: 'error',
				lastSyncTime: Date.now(),
				hasLocalChanges: false,
				hasExternalChanges: false,
				errorMessage: error instanceof Error ? error.message : 'Unknown error',
			}
			
			this.syncStatuses.set(path, errorStatus)
			this.emitStatusChange(path, errorStatus)
		}
	}

	/**
	 * Unregister a file when closed in editor
	 */
	unregisterOpenFile(path: string): void {
		// Clean up sync event subscriptions
		const unsubscribers = this.syncUnsubscribers.get(path)
		if (unsubscribers) {
			unsubscribers.forEach(unsub => unsub())
			this.syncUnsubscribers.delete(path)
		}

		// Remove from sync status tracking
		this.syncStatuses.delete(path)

		// Untrack from sync manager
		this.syncManager.untrack(path)
	}

	/**
	 * Get sync status for a file
	 */
	getSyncStatus(path: string): SyncStatusInfo {
		return this.syncStatuses.get(path) ?? {
			type: 'not-watched',
			lastSyncTime: 0,
			hasLocalChanges: false,
			hasExternalChanges: false,
		}
	}

	/**
	 * Get conflict information for a file
	 */
	getConflictInfo(path: string): ConflictInfo | undefined {
		const pendingConflict = this.pendingConflicts.get(path)
		return pendingConflict?.conflictInfo
	}

	/**
	 * Get all pending conflicts
	 */
	getPendingConflicts(): ConflictInfo[] {
		return Array.from(this.pendingConflicts.values()).map(pc => pc.conflictInfo)
	}

	/**
	 * Manually trigger conflict resolution UI
	 */
	showConflictResolution(path: string): void {
		const conflictInfo = this.getConflictInfo(path)
		if (!conflictInfo) {
			console.warn(`No conflict found for path: ${path}`)
			return
		}

		// Emit a special event that UI components can listen to
		// This allows the UI layer to show the conflict resolution dialog
		this.emitConflictResolutionRequest(path, conflictInfo)
	}

	/**
	 * Clear a conflict without resolving it (for skip strategy)
	 */
	skipConflict(path: string): void {
		const pendingConflict = this.pendingConflicts.get(path)
		if (!pendingConflict) {
			return
		}

		// Remove the conflict but keep the status as conflict
		// This allows the user to manually resolve later
		this.pendingConflicts.delete(path)
		
		if (this.notificationSystem) {
			const fileName = path.split('/').pop() || path
			this.notificationSystem.showNotification(
				`Conflict in "${fileName}" was skipped. You can resolve it later.`,
				'info'
			)
		}
	}

	/**
	 * Check if a file has a pending conflict
	 */
	hasConflict(path: string): boolean {
		return this.pendingConflicts.has(path)
	}

	/**
	 * Get the number of pending conflicts
	 */
	getConflictCount(): number {
		return this.pendingConflicts.size
	}

	/**
	 * Resolve a conflict with the specified strategy
	 */
	async resolveConflict(path: string, resolution: ConflictResolution): Promise<void> {
		const pendingConflict = this.pendingConflicts.get(path)
		if (!pendingConflict) {
			throw new Error(`No conflict found for path: ${path}`)
		}

		const { conflictInfo } = pendingConflict
		const editor = this.editorRegistry.getEditor(path)
		if (!editor) {
			throw new Error(`No editor found for path: ${path}`)
		}

		// Handle skip strategy
		if (resolution.strategy === 'skip') {
			this.skipConflict(path)
			return
		}

		try {
			await this.applyConflictResolution(path, conflictInfo, resolution, editor)
			
			// Clear the conflict
			this.pendingConflicts.delete(path)
			
			// Update sync status
			const newStatus: SyncStatusInfo = {
				type: 'synced',
				lastSyncTime: Date.now(),
				hasLocalChanges: false,
				hasExternalChanges: false,
			}
			this.updateSyncStatus(path, newStatus)

			// Show success notification
			if (this.notificationSystem) {
				const fileName = path.split('/').pop() || path
				const strategyName = this.getStrategyDisplayName(resolution.strategy)
				this.notificationSystem.showNotification(
					`Conflict in "${fileName}" resolved using ${strategyName}`,
					'info'
				)
			}

		} catch (error) {
			console.error(`Failed to resolve conflict for ${path}:`, error)
			
			// Update status to show error
			const errorStatus: SyncStatusInfo = {
				type: 'error',
				lastSyncTime: Date.now(),
				hasLocalChanges: true,
				hasExternalChanges: true,
				errorMessage: error instanceof Error ? error.message : 'Conflict resolution failed',
			}
			this.updateSyncStatus(path, errorStatus)
			
			// Show error notification
			if (this.notificationSystem) {
				const fileName = path.split('/').pop() || path
				this.notificationSystem.showNotification(
					`Failed to resolve conflict in "${fileName}": ${errorStatus.errorMessage}`,
					'error'
				)
			}
			
			throw error
		}
	}

	/**
	 * Try to automatically resolve a conflict based on default configuration
	 */
	private async tryAutoResolveConflict(path: string, conflictInfo: ConflictInfo): Promise<boolean> {
		const defaultStrategy = this.config.defaultConflictResolution
		
		// Only auto-resolve if the default strategy is not manual-merge or skip
		if (defaultStrategy === 'manual-merge' || defaultStrategy === 'skip') {
			return false
		}

		try {
			const resolution: ConflictResolution = { strategy: defaultStrategy }
			await this.resolveConflict(path, resolution)
			
			if (this.notificationSystem) {
				const fileName = path.split('/').pop() || path
				const strategyName = this.getStrategyDisplayName(defaultStrategy)
				this.notificationSystem.showNotification(
					`Conflict in "${fileName}" auto-resolved using ${strategyName}`,
					'info'
				)
			}
			
			return true
		} catch (error) {
			console.error(`Auto-resolution failed for ${path}:`, error)
			return false
		}
	}

	/**
	 * Get display name for a conflict resolution strategy
	 */
	private getStrategyDisplayName(strategy: ConflictResolutionStrategy): string {
		switch (strategy) {
			case 'keep-local':
				return 'Keep Local Changes'
			case 'use-external':
				return 'Use External Changes'
			case 'manual-merge':
				return 'Manual Merge'
			case 'skip':
				return 'Skip'
			default:
				return 'Unknown Strategy'
		}
	}

	/**
	 * Resolve conflicts for multiple files
	 */
	async batchResolveConflicts(paths: string[], strategy: ConflictResolutionStrategy): Promise<void> {
		const errors: Array<{ path: string; error: Error }> = []
		
		for (const path of paths) {
			try {
				const conflictInfo = this.getConflictInfo(path)
				if (conflictInfo) {
					await this.resolveConflict(path, { strategy })
				}
			} catch (error) {
				errors.push({ 
					path, 
					error: error instanceof Error ? error : new Error('Unknown error') 
				})
			}
		}

		if (errors.length > 0) {
			const errorMessage = `Failed to resolve conflicts for ${errors.length} files: ${
				errors.map(e => `${e.path} (${e.error.message})`).join(', ')
			}`
			throw new Error(errorMessage)
		}
	}

	/**
	 * Subscribe to sync status changes
	 */
	onSyncStatusChange(callback: (path: string, status: SyncStatusInfo) => void): () => void {
		this.statusChangeHandlers.add(callback)
		
		return () => {
			this.statusChangeHandlers.delete(callback)
		}
	}

	/**
	 * Subscribe to conflict resolution requests
	 */
	onConflictResolutionRequest(callback: (path: string, conflictInfo: ConflictInfo) => void): () => void {
		this.conflictResolutionRequestHandlers.add(callback)
		
		return () => {
			this.conflictResolutionRequestHandlers.delete(callback)
		}
	}

	/**
	 * Check if a file should be closed due to deletion
	 * Returns true if the file was deleted and has no unsaved changes
	 */
	shouldCloseFile(path: string): boolean {
		const status = this.getSyncStatus(path)
		return status.type === 'error' && 
			   status.errorMessage === 'File was deleted externally' &&
			   !status.hasLocalChanges
	}

	/**
	 * Dispose all resources
	 */
	dispose(): void {
		// Clean up all file subscriptions
		for (const unsubscribers of this.syncUnsubscribers.values()) {
			unsubscribers.forEach(unsub => unsub())
		}
		this.syncUnsubscribers.clear()

		// Clean up registry subscriptions
		this.registryUnsubscribers.forEach(unsub => unsub())
		this.registryUnsubscribers = []

		// Clear status tracking
		this.syncStatuses.clear()
		this.statusChangeHandlers.clear()
		this.conflictResolutionRequestHandlers.clear()
		
		// Clear pending conflicts
		this.pendingConflicts.clear()
	}

	/**
	 * Set up event handlers for editor registry events
	 */
	private setupRegistryEventHandlers(): void {
		// Auto-register files when editors are opened
		const onEditorOpen = this.editorRegistry.onEditorOpen((path, editor) => {
			if (this.config.autoWatch) {
				this.registerOpenFile(path, editor).catch(error => {
					console.error(`Failed to register file ${path}:`, error)
				})
			}
		})

		// Auto-unregister files when editors are closed
		const onEditorClose = this.editorRegistry.onEditorClose((path) => {
			this.unregisterOpenFile(path)
		})

		this.registryUnsubscribers.push(onEditorOpen, onEditorClose)
	}

	/**
	 * Set up event handlers for a specific file's sync events
	 */
	private setupFileEventHandlers(path: string, editor: EditorInstance): void {
		const unsubscribers: (() => void)[] = []

		// Handle external changes
		const onExternalChange = this.syncManager.on('external-change', (event: ExternalChangeEvent) => {
			if (event.path === path) {
				this.handleExternalChange(path, event, editor).catch(error => {
					console.error(`Error handling external change for ${path}:`, error)
				})
			}
		})

		// Handle conflicts
		const onConflict = this.syncManager.on('conflict', (event: ConflictEvent) => {
			if (event.path === path) {
				this.handleConflict(path, event, editor).catch(error => {
					console.error(`Error handling conflict for ${path}:`, error)
				})
			}
		})

		// Handle file deletion
		const onDeleted = this.syncManager.on('deleted', (event: DeletedEvent) => {
			if (event.path === path) {
				this.handleFileDeleted(path, event, editor)
			}
		})

		// Handle sync completion
		const onSynced = this.syncManager.on('synced', (event: SyncedEvent) => {
			if (event.path === path) {
				this.handleSynced(path, event, editor)
			}
		})

		// Handle editor content changes to update dirty status
		const onContentChange = editor.onContentChange((content) => {
			this.handleEditorContentChange(path, content, editor)
		})

		// Handle editor dirty state changes
		const onDirtyStateChange = editor.onDirtyStateChange((isDirty) => {
			this.handleEditorDirtyStateChange(path, isDirty)
		})

		unsubscribers.push(
			onExternalChange,
			onConflict,
			onDeleted,
			onSynced,
			onContentChange,
			onDirtyStateChange
		)

		this.syncUnsubscribers.set(path, unsubscribers)
	}

	/**
	 * Handle external change events
	 */
	private async handleExternalChange(path: string, event: ExternalChangeEvent, editor: EditorInstance): Promise<void> {
		const currentStatus = this.getSyncStatus(path)
		
		// Check if editor is dirty (has unsaved changes)
		const isDirty = editor.isDirty()
		
		if (!isDirty && this.config.autoReload) {
			// Auto-reload clean files
			await this.performAutoReload(path, event, editor)
		} else {
			// File has unsaved changes - mark as conflict
			const newStatus: SyncStatusInfo = {
				...currentStatus,
				type: isDirty ? 'conflict' : 'external-changes',
				hasExternalChanges: true,
				lastSyncTime: Date.now(),
			}

			this.updateSyncStatus(path, newStatus)
		}
	}

	/**
	 * Perform auto-reload of a clean file with external changes
	 */
	private async performAutoReload(path: string, event: ExternalChangeEvent, editor: EditorInstance): Promise<void> {
		try {
			// Capture current editor state for preservation
			const editorState = this.config.preserveEditorState 
				? this.stateManager.captureState(editor)
				: undefined

			// Get the new content from the sync manager
			const tracker = this.syncManager.getTracker(path)
			if (!tracker) {
				throw new Error('File tracker not found')
			}

			// Update editor content with the latest disk content
			const newContent = tracker.getDiskContent()?.toString() || ''
			editor.setContent(newContent)
			
			// Mark editor as clean since we just loaded fresh content
			editor.markClean()

			// Restore editor state if preservation is enabled
			if (editorState && this.config.preserveEditorState) {
				this.stateManager.restoreState(editor, editorState, newContent)
			}

			// Update sync status to reflect successful reload
			const newStatus: SyncStatusInfo = {
				type: 'synced',
				lastSyncTime: Date.now(),
				hasLocalChanges: false,
				hasExternalChanges: false,
			}
			this.updateSyncStatus(path, newStatus)

			// Show notification if enabled
			if (this.config.showReloadNotifications && this.notificationSystem) {
				const fileName = path.split('/').pop() || path
				this.notificationSystem.showNotification(
					`File "${fileName}" was updated and reloaded`,
					'info'
				)
			}

		} catch (error) {
			// Handle auto-reload failure
			console.error(`Failed to auto-reload file ${path}:`, error)
			
			const errorStatus: SyncStatusInfo = {
				type: 'error',
				lastSyncTime: Date.now(),
				hasLocalChanges: false,
				hasExternalChanges: true,
				errorMessage: error instanceof Error ? error.message : 'Auto-reload failed',
			}
			this.updateSyncStatus(path, errorStatus)

			if (this.notificationSystem) {
				const fileName = path.split('/').pop() || path
				this.notificationSystem.showNotification(
					`Failed to reload "${fileName}": ${errorStatus.errorMessage}`,
					'error'
				)
			}
		}
	}

	/**
	 * Handle conflict events
	 */
	private async handleConflict(path: string, event: ConflictEvent, editor: EditorInstance): Promise<void> {
		const currentStatus = this.getSyncStatus(path)
		
		// Create ConflictInfo from the event
		const conflictInfo: ConflictInfo = {
			path,
			baseContent: event.baseContent.toString(),
			localContent: event.localContent.toString(),
			externalContent: event.diskContent.toString(),
			lastModified: Date.now(), // We don't have exact mtime from ConflictEvent, use current time
			conflictTimestamp: Date.now(),
		}

		// Store the pending conflict
		const pendingConflict: PendingConflict = {
			path,
			conflictInfo,
			timestamp: Date.now(),
		}
		this.pendingConflicts.set(path, pendingConflict)

		// Update sync status to conflict
		const conflictStatus: SyncStatusInfo = {
			...currentStatus,
			type: 'conflict',
			hasLocalChanges: true,
			hasExternalChanges: true,
			lastSyncTime: Date.now(),
		}
		this.updateSyncStatus(path, conflictStatus)

		// Try auto-resolution first
		const autoResolved = await this.tryAutoResolveConflict(path, conflictInfo)
		
		if (!autoResolved) {
			// Show notification for manual resolution
			if (this.notificationSystem) {
				const fileName = path.split('/').pop() || path
				this.notificationSystem.showNotification(
					`Conflict detected in "${fileName}". Both local and external changes found.`,
					'warning'
				)
			}
		}
	}

	/**
	 * Handle file deletion events
	 */
	private handleFileDeleted(path: string, event: DeletedEvent, editor: EditorInstance): void {
		const currentStatus = this.getSyncStatus(path)
		const isDirty = editor.isDirty()
		
		if (!isDirty) {
			// File has no unsaved changes - safe to close the editor
			this.closeEditorForDeletedFile(path)
		} else {
			// File has unsaved changes - mark as error but keep editor open
			const newStatus: SyncStatusInfo = {
				...currentStatus,
				type: 'error',
				errorMessage: 'File was deleted externally but has unsaved changes',
				lastSyncTime: Date.now(),
			}

			this.updateSyncStatus(path, newStatus)
			
			if (this.notificationSystem) {
				const fileName = path.split('/').pop() || path
				this.notificationSystem.showNotification(
					`File "${fileName}" was deleted externally but has unsaved changes. Save to restore the file.`,
					'warning'
				)
			}
		}
	}

	/**
	 * Close editor tab for a deleted file and notify user
	 */
	private closeEditorForDeletedFile(path: string): void {
		// Update status to indicate file was deleted
		const deletedStatus: SyncStatusInfo = {
			type: 'error',
			lastSyncTime: Date.now(),
			hasLocalChanges: false,
			hasExternalChanges: false,
			errorMessage: 'File was deleted externally',
		}
		
		this.updateSyncStatus(path, deletedStatus)

		// Show notification before closing
		if (this.notificationSystem) {
			const fileName = path.split('/').pop() || path
			this.notificationSystem.showNotification(
				`File "${fileName}" was deleted externally and has been closed`,
				'info'
			)
		}

		// Note: The actual editor tab closing should be handled by the editor system
		// This manager just updates the sync status and provides notifications
		// The editor registry or UI layer should listen to these status changes
		// and close the appropriate tabs
	}

	/**
	 * Handle sync completion events
	 */
	private handleSynced(path: string, event: SyncedEvent, editor: EditorInstance): void {
		const currentStatus = this.getSyncStatus(path)
		
		const newStatus: SyncStatusInfo = {
			...currentStatus,
			type: editor.isDirty() ? 'dirty' : 'synced',
			hasExternalChanges: false,
			lastSyncTime: Date.now(),
		}

		this.updateSyncStatus(path, newStatus)
	}

	/**
	 * Handle editor content changes
	 */
	private handleEditorContentChange(path: string, content: string, editor: EditorInstance): void {
		// Update the tracker with new local content if it exists
		const tracker = this.syncManager.getTracker(path)
		if (tracker) {
			// Note: This would need to be implemented in the FileStateTracker
			// For now, we'll rely on the dirty state change handler
		}
	}

	/**
	 * Handle editor dirty state changes
	 */
	private handleEditorDirtyStateChange(path: string, isDirty: boolean): void {
		const currentStatus = this.getSyncStatus(path)
		
		// Determine new status type based on dirty state and external changes
		let newType: SyncStatusInfo['type'] = 'synced'
		
		if (isDirty && currentStatus.hasExternalChanges) {
			newType = 'conflict'
		} else if (isDirty) {
			newType = 'dirty'
		} else if (currentStatus.hasExternalChanges) {
			newType = 'external-changes'
		}

		const newStatus: SyncStatusInfo = {
			...currentStatus,
			type: newType,
			hasLocalChanges: isDirty,
			lastSyncTime: Date.now(),
		}

		this.updateSyncStatus(path, newStatus)
	}

	/**
	 * Update sync status and emit change event
	 */
	private updateSyncStatus(path: string, status: SyncStatusInfo): void {
		this.syncStatuses.set(path, status)
		this.emitStatusChange(path, status)
	}

	/**
	 * Apply a conflict resolution strategy
	 */
	private async applyConflictResolution(
		path: string, 
		conflictInfo: ConflictInfo, 
		resolution: ConflictResolution, 
		editor: EditorInstance
	): Promise<void> {
		const tracker = this.syncManager.getTracker(path)
		if (!tracker) {
			throw new Error(`No tracker found for path: ${path}`)
		}

		switch (resolution.strategy) {
			case 'keep-local':
				// Keep local changes, save to disk to overwrite external changes
				const localContent = conflictInfo.localContent
				
				// Use the tracker's resolveKeepLocal method if available
				if ('resolveKeepLocal' in tracker && typeof tracker.resolveKeepLocal === 'function') {
					await (tracker as any).resolveKeepLocal()
				} else {
					// Fallback: manually write using sync manager's write token system
					const writeToken = this.syncManager.beginWrite(path)
					try {
						// We need to access the filesystem - this is a limitation of the current design
						// For now, we'll throw an error and handle this in the UI layer
						throw new Error('Direct file writing not yet implemented - use editor save functionality')
					} catch (error) {
						console.error(`Failed to save local changes for ${path}:`, error)
						throw error
					}
				}
				
				// Mark editor as clean since we just saved
				editor.markClean()
				break

			case 'use-external':
				// Discard local changes, use external content
				const externalContent = conflictInfo.externalContent
				
				// Capture editor state for preservation
				const editorState = this.config.preserveEditorState 
					? this.stateManager.captureState(editor)
					: undefined

				// Update editor with external content
				editor.setContent(externalContent)
				editor.markClean()

				// Restore editor state if preservation is enabled
				if (editorState && this.config.preserveEditorState) {
					this.stateManager.restoreState(editor, editorState, externalContent)
				}

				// Use the tracker's resolveAcceptExternal method if available
				if ('resolveAcceptExternal' in tracker && typeof tracker.resolveAcceptExternal === 'function') {
					await (tracker as any).resolveAcceptExternal()
				}
				break

			case 'manual-merge':
				// Use provided merged content
				if (!resolution.mergedContent) {
					throw new Error('Manual merge strategy requires merged content')
				}
				
				// Update editor with merged content first
				editor.setContent(resolution.mergedContent)
				
				// Use the tracker's resolveMerge method if available
				if ('resolveMerge' in tracker && typeof tracker.resolveMerge === 'function') {
					await (tracker as any).resolveMerge(resolution.mergedContent)
				} else {
					// Fallback: manually write using sync manager's write token system
					throw new Error('Direct file writing not yet implemented - use editor save functionality')
				}
				
				// Mark editor as clean since we just saved
				editor.markClean()
				break

			case 'skip':
				// Do nothing, leave conflict unresolved
				throw new Error('Skip strategy should not be applied through resolveConflict')

			default:
				throw new Error(`Unknown conflict resolution strategy: ${resolution.strategy}`)
		}
	}

	/**
	 * Emit status change event to all handlers
	 */
	private emitStatusChange(path: string, status: SyncStatusInfo): void {
		for (const handler of this.statusChangeHandlers) {
			try {
				handler(path, status)
			} catch (error) {
				console.error('Error in sync status change handler:', error)
			}
		}
	}

	/**
	 * Emit conflict resolution request event to all handlers
	 */
	private emitConflictResolutionRequest(path: string, conflictInfo: ConflictInfo): void {
		for (const handler of this.conflictResolutionRequestHandlers) {
			try {
				handler(path, conflictInfo)
			} catch (error) {
				console.error('Error in conflict resolution request handler:', error)
			}
		}
	}
}