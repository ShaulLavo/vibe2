import { describe, it, expect } from 'vitest'
import { SyncStatusTracker } from './sync-status-tracker'
import type { FileStateTracker } from '@repo/fs'

// Mock FileStateTracker
const createMockTracker = (
	syncState: 'synced' | 'local-changes' | 'external-changes' | 'conflict',
	isDirty = false,
	hasExternalChanges = false
): FileStateTracker => ({
	path: '/test/file.ts',
	syncState,
	isDirty,
	hasExternalChanges,
	mode: 'tracked',
	getLocalContent: () => ({ hash: () => 'local', equals: () => false, toBytes: () => new Uint8Array(), toString: () => 'local' }),
	getBaseContent: () => ({ hash: () => 'base', equals: () => false, toBytes: () => new Uint8Array(), toString: () => 'base' }),
	getDiskContent: () => ({ hash: () => 'disk', equals: () => false, toBytes: () => new Uint8Array(), toString: () => 'disk' }),
} as any)

describe('SyncStatusTracker', () => {
	describe('calculateStatus', () => {
		it('should calculate synced status', () => {
			const tracker = createMockTracker('synced', false, false)
			const status = SyncStatusTracker.calculateStatus(tracker, false)

			expect(status.type).toBe('synced')
			expect(status.hasLocalChanges).toBe(false)
			expect(status.hasExternalChanges).toBe(false)
		})

		it('should calculate dirty status when editor is dirty', () => {
			const tracker = createMockTracker('synced', false, false)
			const status = SyncStatusTracker.calculateStatus(tracker, true)

			expect(status.type).toBe('dirty')
			expect(status.hasLocalChanges).toBe(true)
			expect(status.hasExternalChanges).toBe(false)
		})

		it('should calculate external-changes status', () => {
			const tracker = createMockTracker('external-changes', false, true)
			const status = SyncStatusTracker.calculateStatus(tracker, false)

			expect(status.type).toBe('external-changes')
			expect(status.hasLocalChanges).toBe(false)
			expect(status.hasExternalChanges).toBe(true)
		})

		it('should calculate conflict status', () => {
			const tracker = createMockTracker('conflict', true, true)
			const status = SyncStatusTracker.calculateStatus(tracker, true)

			expect(status.type).toBe('conflict')
			expect(status.hasLocalChanges).toBe(true)
			expect(status.hasExternalChanges).toBe(true)
		})

		it('should handle error status', () => {
			const tracker = createMockTracker('synced', false, false)
			const status = SyncStatusTracker.calculateStatus(tracker, false, Date.now(), 'Test error')

			expect(status.type).toBe('error')
			expect(status.errorMessage).toBe('Test error')
		})
	})

	describe('status update methods', () => {
		it('should update for external change', () => {
			const currentStatus = {
				type: 'synced' as const,
				lastSyncTime: 1000,
				hasLocalChanges: false,
				hasExternalChanges: false,
			}

			const newStatus = SyncStatusTracker.updateForExternalChange(currentStatus, false)

			expect(newStatus.type).toBe('external-changes')
			expect(newStatus.hasExternalChanges).toBe(true)
			expect(newStatus.lastSyncTime).toBeGreaterThan(1000)
		})

		it('should update for conflict when editor is dirty', () => {
			const currentStatus = {
				type: 'dirty' as const,
				lastSyncTime: 1000,
				hasLocalChanges: true,
				hasExternalChanges: false,
			}

			const newStatus = SyncStatusTracker.updateForExternalChange(currentStatus, true)

			expect(newStatus.type).toBe('conflict')
			expect(newStatus.hasExternalChanges).toBe(true)
		})

		it('should update for deletion', () => {
			const currentStatus = {
				type: 'synced' as const,
				lastSyncTime: 1000,
				hasLocalChanges: false,
				hasExternalChanges: false,
			}

			const newStatus = SyncStatusTracker.updateForDeletion(currentStatus)

			expect(newStatus.type).toBe('error')
			expect(newStatus.errorMessage).toBe('File was deleted externally')
		})

		it('should update for sync completion', () => {
			const currentStatus = {
				type: 'external-changes' as const,
				lastSyncTime: 1000,
				hasLocalChanges: false,
				hasExternalChanges: true,
			}

			const newStatus = SyncStatusTracker.updateForSynced(currentStatus, false)

			expect(newStatus.type).toBe('synced')
			expect(newStatus.hasExternalChanges).toBe(false)
		})

		it('should update for dirty state change', () => {
			const currentStatus = {
				type: 'synced' as const,
				lastSyncTime: 1000,
				hasLocalChanges: false,
				hasExternalChanges: false,
			}

			const newStatus = SyncStatusTracker.updateForDirtyStateChange(currentStatus, true)

			expect(newStatus.type).toBe('dirty')
			expect(newStatus.hasLocalChanges).toBe(true)
		})
	})

	describe('utility methods', () => {
		it('should identify status that needs attention', () => {
			expect(SyncStatusTracker.needsAttention({ type: 'conflict', lastSyncTime: 0, hasLocalChanges: true, hasExternalChanges: true })).toBe(true)
			expect(SyncStatusTracker.needsAttention({ type: 'error', lastSyncTime: 0, hasLocalChanges: false, hasExternalChanges: false, errorMessage: 'Error' })).toBe(true)
			expect(SyncStatusTracker.needsAttention({ type: 'synced', lastSyncTime: 0, hasLocalChanges: false, hasExternalChanges: false })).toBe(false)
		})

		it('should identify in-sync status', () => {
			expect(SyncStatusTracker.isInSync({ type: 'synced', lastSyncTime: 0, hasLocalChanges: false, hasExternalChanges: false })).toBe(true)
			expect(SyncStatusTracker.isInSync({ type: 'dirty', lastSyncTime: 0, hasLocalChanges: true, hasExternalChanges: false })).toBe(false)
		})

		it('should provide status descriptions', () => {
			expect(SyncStatusTracker.getStatusDescription({ type: 'synced', lastSyncTime: 0, hasLocalChanges: false, hasExternalChanges: false })).toBe('File is up to date')
			expect(SyncStatusTracker.getStatusDescription({ type: 'dirty', lastSyncTime: 0, hasLocalChanges: true, hasExternalChanges: false })).toBe('File has unsaved changes')
			expect(SyncStatusTracker.getStatusDescription({ type: 'conflict', lastSyncTime: 0, hasLocalChanges: true, hasExternalChanges: true })).toBe('File has both local and external changes')
		})

		it('should provide CSS class names', () => {
			expect(SyncStatusTracker.getStatusClassName({ type: 'synced', lastSyncTime: 0, hasLocalChanges: false, hasExternalChanges: false })).toBe('sync-status-synced')
			expect(SyncStatusTracker.getStatusClassName({ type: 'conflict', lastSyncTime: 0, hasLocalChanges: true, hasExternalChanges: true })).toBe('sync-status-conflict')
		})
	})
})