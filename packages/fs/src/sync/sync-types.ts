import type { ContentHandle } from './types'

/**
 * Where did the conflict come from?
 * Extensible for future git/cloud sync support.
 */
export type ConflictSource =
	| 'external-file' // SyncController: file changed outside app
	| 'git-merge' // Future: git merge conflict
	| 'git-rebase' // Future: git rebase conflict
	| 'cloud-sync' // Future: cloud sync conflict

/**
 * Event emitted when external file changes are detected
 */
export interface ExternalFileChangeEvent {
	type: 'external-change'
	path: string
	detectedAt: number
}

/**
 * Event emitted when a file is deleted externally
 */
export interface FileDeletedEvent {
	type: 'deleted'
	path: string
	detectedAt: number
}

/**
 * Event emitted when a file conflict is detected.
 * Used by SyncController and future GitObserver/CloudObserver.
 */
export interface FileConflictEvent {
	type: 'conflict'
	path: string
	source: ConflictSource
	detectedAt: number
	message?: string
	baseContent?: ContentHandle
	localContent?: ContentHandle
	externalContent?: ContentHandle
}

/**
 * Union of all sync events
 */
export type SyncEvent =
	| ExternalFileChangeEvent
	| FileDeletedEvent
	| FileConflictEvent

/**
 * Event types for the sync layer
 */
export type SyncEventType = SyncEvent['type']

/**
 * Map of event types to their event objects
 */
export type SyncEventMap = {
	'external-change': ExternalFileChangeEvent
	deleted: FileDeletedEvent
	conflict: FileConflictEvent
}

/**
 * Handler for sync events
 */
export type SyncEventHandler<T extends SyncEventType> = (
	event: SyncEventMap[T]
) => void
