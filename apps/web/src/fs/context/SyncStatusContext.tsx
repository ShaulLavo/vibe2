import { createContext, useContext, type ParentProps } from 'solid-js'
import type { SyncStatusInfo } from '@repo/code-editor/sync'
import { useSyncStatus } from '../hooks/useSyncStatus'

type SyncStatusContextType = {
	getSyncStatus: (path: string) => SyncStatusInfo | undefined
	updateSyncStatus: (path: string, status: SyncStatusInfo) => void
	removeSyncStatus: (path: string) => void
	onSyncStatusChange: (callback: (path: string, status: SyncStatusInfo) => void) => () => void
	getTrackedPaths: () => string[]
	clearAll: () => void
	simulateStatusChange: (path: string, statusType: SyncStatusInfo['type']) => void
}

const SyncStatusContext = createContext<SyncStatusContextType>()

/**
 * Provider for sync status management throughout the application
 * This will be integrated with EditorFileSyncManager when available
 */
export function SyncStatusProvider(props: ParentProps) {
	const syncStatus = useSyncStatus()

	return (
		<SyncStatusContext.Provider value={syncStatus}>
			{props.children}
		</SyncStatusContext.Provider>
	)
}

/**
 * Hook to access sync status context
 */
export function useSyncStatusContext() {
	const context = useContext(SyncStatusContext)
	if (!context) {
		throw new Error('useSyncStatusContext must be used within a SyncStatusProvider')
	}
	return context
}