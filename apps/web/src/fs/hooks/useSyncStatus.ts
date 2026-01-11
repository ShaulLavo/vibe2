import { onCleanup } from 'solid-js'
import type { SyncStatusInfo } from '@repo/code-editor/sync'
import { syncStatusService } from '../services/SyncStatusService'

/**
 * Hook for managing sync status state in UI components
 * Connected to the global SyncStatusService
 */
export function useSyncStatus() {
	// Clean up any listeners when the component unmounts
	onCleanup(() => {
		// Service handles its own cleanup
	})

	return {
		getSyncStatus: (path: string) => syncStatusService.getSyncStatus(path),
		updateSyncStatus: (path: string, status: SyncStatusInfo) => 
			syncStatusService.updateSyncStatus(path, status),
		removeSyncStatus: (path: string) => 
			syncStatusService.removeSyncStatus(path),
		onSyncStatusChange: (callback: (path: string, status: SyncStatusInfo) => void) =>
			syncStatusService.onSyncStatusChange(callback),
		getTrackedPaths: () => syncStatusService.getTrackedPaths(),
		clearAll: () => syncStatusService.clearAll(),
		simulateStatusChange: (path: string, statusType: SyncStatusInfo['type']) =>
			syncStatusService.simulateStatusChange(path, statusType),
	}
}