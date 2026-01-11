import { createMemo, createSignal, onMount, onCleanup, type Accessor } from 'solid-js'
import { useSyncStatusContext, createSyncStatus } from '../context/SyncStatusContext'
import type { SyncStatusInfo, SyncStatusType } from '../types'

/**
 * Hook to filter files by sync status type
 */
export function createStatusFilter(
	filePaths: Accessor<string[]>,
	statusType: SyncStatusType
) {
	const context = useSyncStatusContext()
	
	return createMemo(() => 
		filePaths().filter(path => 
			context.getStatus(path).type === statusType
		)
	)
}

/**
 * Hook to get files with conflicts
 */
export function createConflictedFiles(filePaths: Accessor<string[]>) {
	return createStatusFilter(filePaths, 'conflict')
}

/**
 * Hook to get files with errors
 */
export function createErrorFiles(filePaths: Accessor<string[]>) {
	return createStatusFilter(filePaths, 'error')
}

/**
 * Hook to get dirty (modified) files
 */
export function createDirtyFiles(filePaths: Accessor<string[]>) {
	return createStatusFilter(filePaths, 'dirty')
}

/**
 * Hook to get files with external changes
 */
export function createExternalChangedFiles(filePaths: Accessor<string[]>) {
	return createStatusFilter(filePaths, 'external-changes')
}

/**
 * Hook to track sync status changes over time
 */
export function createSyncStatusHistory(filePath: Accessor<string>, maxHistory = 10) {
	const [history, setHistory] = createSignal<Array<{ status: SyncStatusInfo; timestamp: number }>>([])
	const status = createSyncStatus(filePath)
	
	// Track status changes
	createMemo(() => {
		const currentStatus = status()
		const now = Date.now()
		
		setHistory(prev => {
			const newEntry = { status: currentStatus, timestamp: now }
			const updated = [newEntry, ...prev].slice(0, maxHistory)
			return updated
		})
	})
	
	return {
		history,
		current: status,
		previous: createMemo(() => history()[1]?.status),
		hasChanged: createMemo(() => history().length > 1),
	}
}

/**
 * Hook to create a debounced sync status
 * Useful for reducing UI updates during rapid status changes
 */
export function createDebouncedSyncStatus(filePath: Accessor<string>, delayMs = 100) {
	const [debouncedStatus, setDebouncedStatus] = createSignal<SyncStatusInfo>()
	const status = createSyncStatus(filePath)
	
	let timeoutId: number | undefined
	
	createMemo(() => {
		const currentStatus = status()
		
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
		
		timeoutId = setTimeout(() => {
			setDebouncedStatus(currentStatus)
		}, delayMs) as unknown as number
	})
	
	onCleanup(() => {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
	})
	
	return debouncedStatus
}

/**
 * Hook to aggregate sync status across multiple files
 */
export function createAggregatedSyncStatus(filePaths: Accessor<string[]>) {
	const context = useSyncStatusContext()
	
	return createMemo(() => {
		const paths = filePaths()
		const statuses = paths.map(path => context.getStatus(path))
		
		const counts = {
			synced: 0,
			dirty: 0,
			externalChanges: 0,
			conflicts: 0,
			errors: 0,
			notWatched: 0,
			total: statuses.length
		}
		
		statuses.forEach(status => {
			switch (status.type) {
				case 'synced': counts.synced++; break
				case 'dirty': counts.dirty++; break
				case 'external-changes': counts.externalChanges++; break
				case 'conflict': counts.conflicts++; break
				case 'error': counts.errors++; break
				case 'not-watched': counts.notWatched++; break
			}
		})
		
		// Determine overall status
		let overallStatus: SyncStatusType = 'synced'
		if (counts.errors > 0) {
			overallStatus = 'error'
		} else if (counts.conflicts > 0) {
			overallStatus = 'conflict'
		} else if (counts.externalChanges > 0) {
			overallStatus = 'external-changes'
		} else if (counts.dirty > 0) {
			overallStatus = 'dirty'
		} else if (counts.notWatched === counts.total) {
			overallStatus = 'not-watched'
		}
		
		return {
			counts,
			overallStatus,
			hasIssues: counts.conflicts > 0 || counts.errors > 0,
			needsAttention: counts.conflicts > 0 || counts.errors > 0 || counts.externalChanges > 0,
		}
	})
}

/**
 * Hook to watch for specific status changes
 */
export function createStatusChangeWatcher(
	filePath: Accessor<string>,
	targetStatus: SyncStatusType,
	callback: (status: SyncStatusInfo) => void
) {
	const status = createSyncStatus(filePath)
	
	createMemo(() => {
		const currentStatus = status()
		if (currentStatus.type === targetStatus) {
			callback(currentStatus)
		}
	})
}

/**
 * Hook to create a sync status notification system
 */
export function createSyncStatusNotifications(filePaths: Accessor<string[]>) {
	const [notifications, setNotifications] = createSignal<Array<{
		id: string
		path: string
		status: SyncStatusInfo
		timestamp: number
		dismissed: boolean
	}>>([])
	
	const context = useSyncStatusContext()
	
	// Watch for status changes that need notifications
	createMemo(() => {
		const paths = filePaths()
		
		paths.forEach(path => {
			const status = context.getStatus(path)
			
			// Create notifications for conflicts and errors
			if (status.type === 'conflict' || status.type === 'error') {
				const existingNotification = notifications().find(n => 
					n.path === path && n.status.type === status.type && !n.dismissed
				)
				
				if (!existingNotification) {
					const notification = {
						id: `${path}-${status.type}-${Date.now()}`,
						path,
						status,
						timestamp: Date.now(),
						dismissed: false
					}
					
					setNotifications(prev => [...prev, notification])
				}
			}
		})
	})
	
	const dismissNotification = (id: string) => {
		setNotifications(prev => 
			prev.map(n => n.id === id ? { ...n, dismissed: true } : n)
		)
	}
	
	const clearDismissed = () => {
		setNotifications(prev => prev.filter(n => !n.dismissed))
	}
	
	const activeNotifications = createMemo(() => 
		notifications().filter(n => !n.dismissed)
	)
	
	return {
		notifications: activeNotifications,
		dismissNotification,
		clearDismissed,
	}
}