import type { SyncStatusInfo, SyncStatusType } from './types'
import type { SyncState, FileStateTracker } from '@repo/fs'

/**
 * Utility class for calculating and tracking sync status from FileSyncManager events
 */
export class SyncStatusTracker {
	/**
	 * Calculate sync status from FileSyncManager tracker state
	 */
	static calculateStatus(
		tracker: FileStateTracker,
		editorIsDirty: boolean,
		lastSyncTime?: number,
		errorMessage?: string
	): SyncStatusInfo {
		// Handle error state first
		if (errorMessage) {
			return {
				type: 'error',
				lastSyncTime: lastSyncTime ?? Date.now(),
				hasLocalChanges: editorIsDirty,
				hasExternalChanges: tracker.hasExternalChanges,
				errorMessage,
			}
		}

		// Map sync states to status types
		const statusType = this.mapSyncStateToStatusType(
			tracker.syncState,
			editorIsDirty
		)

		return {
			type: statusType,
			lastSyncTime: lastSyncTime ?? Date.now(),
			hasLocalChanges: editorIsDirty || tracker.isDirty,
			hasExternalChanges: tracker.hasExternalChanges,
		}
	}

	/**
	 * Map FileSyncManager sync state to editor sync status type
	 */
	private static mapSyncStateToStatusType(
		syncState: SyncState,
		editorIsDirty: boolean
	): SyncStatusType {
		switch (syncState) {
			case 'synced':
				return editorIsDirty ? 'dirty' : 'synced'
			
			case 'local-changes':
				return 'dirty'
			
			case 'external-changes':
				return editorIsDirty ? 'conflict' : 'external-changes'
			
			case 'conflict':
				return 'conflict'
			
			default:
				return 'synced'
		}
	}

	/**
	 * Create initial status for a newly tracked file
	 */
	static createInitialStatus(
		tracker: FileStateTracker,
		editorIsDirty: boolean
	): SyncStatusInfo {
		return this.calculateStatus(tracker, editorIsDirty, Date.now())
	}

	/**
	 * Update status based on external change event
	 */
	static updateForExternalChange(
		currentStatus: SyncStatusInfo,
		editorIsDirty: boolean
	): SyncStatusInfo {
		return {
			...currentStatus,
			type: editorIsDirty ? 'conflict' : 'external-changes',
			hasExternalChanges: true,
			lastSyncTime: Date.now(),
		}
	}

	/**
	 * Update status based on conflict event
	 */
	static updateForConflict(
		currentStatus: SyncStatusInfo
	): SyncStatusInfo {
		return {
			...currentStatus,
			type: 'conflict',
			hasLocalChanges: true,
			hasExternalChanges: true,
			lastSyncTime: Date.now(),
		}
	}

	/**
	 * Update status based on file deletion
	 */
	static updateForDeletion(
		currentStatus: SyncStatusInfo
	): SyncStatusInfo {
		return {
			...currentStatus,
			type: 'error',
			errorMessage: 'File was deleted externally',
			lastSyncTime: Date.now(),
		}
	}

	/**
	 * Update status based on sync completion
	 */
	static updateForSynced(
		currentStatus: SyncStatusInfo,
		editorIsDirty: boolean
	): SyncStatusInfo {
		return {
			...currentStatus,
			type: editorIsDirty ? 'dirty' : 'synced',
			hasExternalChanges: false,
			lastSyncTime: Date.now(),
		}
	}

	/**
	 * Update status based on editor dirty state change
	 */
	static updateForDirtyStateChange(
		currentStatus: SyncStatusInfo,
		isDirty: boolean
	): SyncStatusInfo {
		// Determine new status type based on dirty state and external changes
		let newType: SyncStatusType = 'synced'
		
		if (isDirty && currentStatus.hasExternalChanges) {
			newType = 'conflict'
		} else if (isDirty) {
			newType = 'dirty'
		} else if (currentStatus.hasExternalChanges) {
			newType = 'external-changes'
		}

		return {
			...currentStatus,
			type: newType,
			hasLocalChanges: isDirty,
			lastSyncTime: Date.now(),
		}
	}

	/**
	 * Update status with error information
	 */
	static updateWithError(
		currentStatus: SyncStatusInfo,
		errorMessage: string
	): SyncStatusInfo {
		return {
			...currentStatus,
			type: 'error',
			errorMessage,
			lastSyncTime: Date.now(),
		}
	}

	/**
	 * Clear error state and recalculate status
	 */
	static clearError(
		currentStatus: SyncStatusInfo,
		tracker: FileStateTracker,
		editorIsDirty: boolean
	): SyncStatusInfo {
		return this.calculateStatus(tracker, editorIsDirty, Date.now())
	}

	/**
	 * Check if status indicates a problem that needs user attention
	 */
	static needsAttention(status: SyncStatusInfo): boolean {
		return status.type === 'conflict' || status.type === 'error'
	}

	/**
	 * Check if status indicates file is in sync
	 */
	static isInSync(status: SyncStatusInfo): boolean {
		return status.type === 'synced'
	}

	/**
	 * Check if status indicates local changes
	 */
	static hasLocalChanges(status: SyncStatusInfo): boolean {
		return status.hasLocalChanges || status.type === 'dirty'
	}

	/**
	 * Check if status indicates external changes
	 */
	static hasExternalChanges(status: SyncStatusInfo): boolean {
		return status.hasExternalChanges || status.type === 'external-changes'
	}

	/**
	 * Get user-friendly description of the status
	 */
	static getStatusDescription(status: SyncStatusInfo): string {
		switch (status.type) {
			case 'synced':
				return 'File is up to date'
			case 'dirty':
				return 'File has unsaved changes'
			case 'external-changes':
				return 'File was modified externally'
			case 'conflict':
				return 'File has both local and external changes'
			case 'error':
				return status.errorMessage ?? 'Sync error occurred'
			case 'not-watched':
				return 'File is not being watched for changes'
			default:
				return 'Unknown status'
		}
	}

	/**
	 * Get CSS class name for status indicator styling
	 */
	static getStatusClassName(status: SyncStatusInfo): string {
		switch (status.type) {
			case 'synced':
				return 'sync-status-synced'
			case 'dirty':
				return 'sync-status-dirty'
			case 'external-changes':
				return 'sync-status-external'
			case 'conflict':
				return 'sync-status-conflict'
			case 'error':
				return 'sync-status-error'
			case 'not-watched':
				return 'sync-status-not-watched'
			default:
				return 'sync-status-unknown'
		}
	}
}