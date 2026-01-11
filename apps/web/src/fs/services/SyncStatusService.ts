import { createSignal } from 'solid-js'
import type { SyncStatusInfo } from '@repo/code-editor/sync'

/**
 * Service for managing sync status integration with the UI
 * This will be connected to EditorFileSyncManager when it's implemented
 */
export class SyncStatusService {
	private syncStatuses = new Map<string, SyncStatusInfo>()
	private listeners = new Set<(path: string, status: SyncStatusInfo) => void>()
	private statusSignal: () => number
	private setStatusSignal: (value: number | ((prev: number) => number)) => void

	constructor() {
		const [statusSignal, setStatusSignal] = createSignal(0)
		this.statusSignal = statusSignal
		this.setStatusSignal = setStatusSignal
	}

	/**
	 * Get sync status for a file path
	 */
	getSyncStatus(path: string): SyncStatusInfo | undefined {
		// Access the signal to ensure reactivity
		this.statusSignal()
		return this.syncStatuses.get(path)
	}

	/**
	 * Update sync status for a file path
	 */
	updateSyncStatus(path: string, status: SyncStatusInfo): void {
		this.syncStatuses.set(path, status)
		this.setStatusSignal(prev => prev + 1) // Trigger reactivity
		
		// Notify listeners
		this.listeners.forEach(listener => {
			try {
				listener(path, status)
			} catch (error) {
				console.error('Error in sync status listener:', error)
			}
		})
	}

	/**
	 * Remove sync status for a file path
	 */
	removeSyncStatus(path: string): void {
		if (this.syncStatuses.delete(path)) {
			this.setStatusSignal(prev => prev + 1) // Trigger reactivity
		}
	}

	/**
	 * Subscribe to sync status changes
	 */
	onSyncStatusChange(callback: (path: string, status: SyncStatusInfo) => void): () => void {
		this.listeners.add(callback)
		
		// Return unsubscribe function
		return () => {
			this.listeners.delete(callback)
		}
	}

	/**
	 * Get all tracked file paths
	 */
	getTrackedPaths(): string[] {
		return Array.from(this.syncStatuses.keys())
	}

	/**
	 * Clear all sync statuses
	 */
	clearAll(): void {
		this.syncStatuses.clear()
		this.setStatusSignal(prev => prev + 1) // Trigger reactivity
	}

	/**
	 * Connect to EditorFileSyncManager (placeholder for future implementation)
	 */
	connectToSyncManager(syncManager: unknown): () => void {
		// This will be implemented when EditorFileSyncManager is available
		// For now, return a no-op disconnect function
		console.log('SyncStatusService: connectToSyncManager called (not yet implemented)')
		return () => {}
	}

	/**
	 * Simulate sync status changes for testing
	 */
	simulateStatusChange(path: string, statusType: SyncStatusInfo['type']): void {
		const status: SyncStatusInfo = {
			type: statusType,
			lastSyncTime: Date.now(),
			hasLocalChanges: statusType === 'dirty' || statusType === 'conflict',
			hasExternalChanges: statusType === 'external-changes' || statusType === 'conflict',
			errorMessage: statusType === 'error' ? 'Simulated sync error' : undefined,
		}
		this.updateSyncStatus(path, status)
	}
}

// Global instance for the application
export const syncStatusService = new SyncStatusService()
