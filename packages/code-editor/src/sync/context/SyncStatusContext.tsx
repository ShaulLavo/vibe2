import { createContext, useContext, onMount, onCleanup, createSignal, createMemo, type Accessor } from 'solid-js'
import { createStore } from 'solid-js/store'
import type { SyncStatusInfo } from '../types'
import type { EditorFileSyncManager } from '../editor-file-sync-manager'

/**
 * Context for managing sync status across the application
 */
interface SyncStatusContextValue {
	/** Get sync status for a file path */
	getSyncStatus: (path: string) => SyncStatusInfo
	/** Get all file paths being tracked */
	getTrackedPaths: () => string[]
	/** Check if any files have conflicts */
	hasConflicts: () => boolean
	/** Get count of files with conflicts */
	getConflictCount: () => number
}

const SyncStatusContext = createContext<SyncStatusContextValue>()

/**
 * Props for SyncStatusProvider
 */
export interface SyncStatusProviderProps {
	children: any
	syncManager: EditorFileSyncManager
}

/**
 * Provider component that manages sync status state reactively
 */
export function SyncStatusProvider(props: SyncStatusProviderProps) {
	// Reactive store for all file sync statuses
	const [statusMap, setStatusMap] = createStore<Record<string, SyncStatusInfo>>({})

	// Subscribe to sync manager status changes
	onMount(() => {
		const unsubscribe = props.syncManager.onSyncStatusChange((path, status) => {
			setStatusMap(path, status)
		})

		onCleanup(unsubscribe)
	})

	// Computed values
	const getSyncStatus = (path: string): SyncStatusInfo => {
		return statusMap[path] ?? {
			type: 'not-watched',
			lastSyncTime: Date.now(),
			hasLocalChanges: false,
			hasExternalChanges: false,
		}
	}

	const getTrackedPaths = (): string[] => {
		return Object.keys(statusMap)
	}

	const hasConflicts = (): boolean => {
		return Object.values(statusMap).some(status => status.type === 'conflict')
	}

	const getConflictCount = (): number => {
		return Object.values(statusMap).filter(status => status.type === 'conflict').length
	}

	const contextValue: SyncStatusContextValue = {
		getSyncStatus,
		getTrackedPaths,
		hasConflicts,
		getConflictCount,
	}

	return (
		<SyncStatusContext.Provider value={contextValue}>
			{props.children}
		</SyncStatusContext.Provider>
	)
}

/**
 * Hook to access sync status context
 */
export function useSyncStatusContext(): SyncStatusContextValue {
	const context = useContext(SyncStatusContext)
	if (!context) {
		throw new Error('useSyncStatusContext must be used within a SyncStatusProvider')
	}
	return context
}

/**
 * Hook to get reactive sync status for a specific file
 */
export function createSyncStatus(filePath: Accessor<string>) {
	const context = useSyncStatusContext()

	return createMemo(() => context.getSyncStatus(filePath()))
}

/**
 * Hook to get reactive sync status for multiple files
 */
export function createMultiSyncStatus(filePaths: Accessor<string[]>) {
	const context = useSyncStatusContext()

	return createMemo(() =>
		filePaths().map((path) => ({
			path,
			status: context.getSyncStatus(path),
		}))
	)
}

/**
 * Hook to track conflict state reactively
 */
export function createConflictTracker() {
	const context = useSyncStatusContext()
	
	const hasConflicts = createMemo(() => context.hasConflicts())
	const conflictCount = createMemo(() => context.getConflictCount())
	
	return {
		hasConflicts,
		conflictCount,
	}
}

/**
 * Hook to get all tracked files with their statuses
 */
export function createAllSyncStatuses() {
	const context = useSyncStatusContext()

	return createMemo(() =>
		context.getTrackedPaths().map((path) => ({
			path,
			status: context.getSyncStatus(path),
		}))
	)
}