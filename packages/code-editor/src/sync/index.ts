// Core sync manager
export { EditorFileSyncManager } from './editor-file-sync-manager'
export type { EditorFileSyncManagerOptions, NotificationSystem } from './editor-file-sync-manager'

// Editor registry
export { EditorRegistryImpl } from './editor-registry'

// Types
export type {
	SyncStatusType,
	SyncStatusInfo,
	CursorPosition,
	EditorScrollPosition,
	FoldedRegion,
	TextSelection,
	EditorState,
	EditorInstance,
	EditorRegistry,
	EditorSyncConfig,
	ConflictInfo,
	ConflictResolution,
	ConflictResolutionStrategy,
	PendingConflict,
	BatchResolutionResult,
} from './types'

export { DEFAULT_EDITOR_SYNC_CONFIG } from './types'

// Status tracking utilities
export { SyncStatusTracker } from './sync-status-tracker'

// Editor state management
export { EditorStateManager } from './editor-state-manager'

// Reactive context and hooks
export { 
	SyncStatusProvider, 
	useSyncStatusContext, 
	createSyncStatus, 
	createMultiSyncStatus,
	createConflictTracker,
	createAllSyncStatuses 
} from './context/SyncStatusContext'
export type { SyncStatusProviderProps } from './context/SyncStatusContext'

export {
	createStatusFilter,
	createConflictedFiles,
	createErrorFiles,
	createDirtyFiles,
	createExternalChangedFiles,
	createSyncStatusHistory,
	createDebouncedSyncStatus,
	createAggregatedSyncStatus,
	createStatusChangeWatcher,
	createSyncStatusNotifications,
} from './hooks/createSyncStatusHooks'

// UI Components
export * from './ui'