import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EditorFileSyncManager, type NotificationSystem } from './editor-file-sync-manager'
import { EditorRegistryImpl } from './editor-registry'
import type { FileSyncManager, ContentHandle } from '@repo/fs'
import { ByteContentHandleFactory } from '@repo/fs'
import type { EditorInstance, EditorSyncConfig, ConflictResolution } from './types'
import { DEFAULT_EDITOR_SYNC_CONFIG } from './types'
import * as fc from 'fast-check'

// Mock FileSyncManager
const createMockFileSyncManager = (): FileSyncManager => ({
	track: vi.fn().mockResolvedValue({
		isDirty: false,
		hasExternalChanges: false,
		syncState: 'synced',
		getContent: vi.fn().mockResolvedValue('updated content'),
	}),
	untrack: vi.fn(),
	getTracker: vi.fn().mockReturnValue({
		isDirty: false,
		hasExternalChanges: false,
		getContent: vi.fn().mockResolvedValue('updated content'),
		getDiskContent: vi.fn().mockReturnValue(ByteContentHandleFactory.fromString('updated content')),
	}),
	on: vi.fn().mockReturnValue(() => {}),
	dispose: vi.fn(),
} as any)

// Mock EditorInstance
const createMockEditor = (): EditorInstance => ({
	getContent: vi.fn().mockReturnValue('test content'),
	setContent: vi.fn(),
	isDirty: vi.fn().mockReturnValue(false),
	markClean: vi.fn(),
	getCursorPosition: vi.fn().mockReturnValue({ line: 0, column: 0 }),
	setCursorPosition: vi.fn(),
	getScrollPosition: vi.fn().mockReturnValue({ scrollTop: 0, scrollLeft: 0 }),
	setScrollPosition: vi.fn(),
	getFoldedRegions: vi.fn().mockReturnValue([]),
	setFoldedRegions: vi.fn(),
	onContentChange: vi.fn().mockReturnValue(() => {}),
	onDirtyStateChange: vi.fn().mockReturnValue(() => {}),
})

// Mock NotificationSystem
const createMockNotificationSystem = (): NotificationSystem => ({
	showNotification: vi.fn(),
})

describe('EditorFileSyncManager', () => {
	let syncManager: FileSyncManager
	let editorRegistry: EditorRegistryImpl
	let config: EditorSyncConfig
	let notificationSystem: NotificationSystem
	let editorFileSyncManager: EditorFileSyncManager

	beforeEach(() => {
		syncManager = createMockFileSyncManager()
		editorRegistry = new EditorRegistryImpl()
		config = { ...DEFAULT_EDITOR_SYNC_CONFIG }
		notificationSystem = createMockNotificationSystem()
		
		editorFileSyncManager = new EditorFileSyncManager({
			syncManager,
			editorRegistry,
			config,
			notificationSystem,
		})
	})

	it('should create instance successfully', () => {
		expect(editorFileSyncManager).toBeDefined()
	})

	it('should register file when opened', async () => {
		const mockEditor = createMockEditor()
		const path = '/test/file.ts'

		await editorFileSyncManager.registerOpenFile(path, mockEditor)

		expect(syncManager.track).toHaveBeenCalledWith(path, { reactive: false })
		
		const status = editorFileSyncManager.getSyncStatus(path)
		expect(status.type).toBe('synced')
	})

	it('should unregister file when closed', async () => {
		const mockEditor = createMockEditor()
		const path = '/test/file.ts'

		await editorFileSyncManager.registerOpenFile(path, mockEditor)
		editorFileSyncManager.unregisterOpenFile(path)

		expect(syncManager.untrack).toHaveBeenCalledWith(path)
		
		const status = editorFileSyncManager.getSyncStatus(path)
		expect(status.type).toBe('not-watched')
	})

	it('should emit status changes', async () => {
		const mockEditor = createMockEditor()
		const path = '/test/file.ts'
		const statusChanges: Array<{ path: string; status: any }> = []

		const unsubscribe = editorFileSyncManager.onSyncStatusChange((path, status) => {
			statusChanges.push({ path, status })
		})

		await editorFileSyncManager.registerOpenFile(path, mockEditor)

		expect(statusChanges).toHaveLength(1)
		expect(statusChanges[0]?.path).toBe(path)
		expect(statusChanges[0]?.status.type).toBe('synced')

		unsubscribe()
	})

	it('should handle registration errors gracefully', async () => {
		const mockEditor = createMockEditor()
		const path = '/test/file.ts'
		
		// Make track throw an error
		syncManager.track = vi.fn().mockRejectedValueOnce(new Error('Track failed'))

		await editorFileSyncManager.registerOpenFile(path, mockEditor)

		const status = editorFileSyncManager.getSyncStatus(path)
		expect(status.type).toBe('error')
		expect(status.errorMessage).toBe('Track failed')
	})

	it('should dispose resources properly', () => {
		editorFileSyncManager.dispose()
		
		// Should not throw and should clean up properly
		expect(() => editorFileSyncManager.dispose()).not.toThrow()
	})

	describe('Auto-reload functionality', () => {
		it('should auto-reload clean files when external changes occur', async () => {
			const mockEditor = createMockEditor()
			const path = '/test/file.ts'
			
			// Register the file
			await editorFileSyncManager.registerOpenFile(path, mockEditor)
			
			// Directly call the handleExternalChange method (private method testing)
			const manager = editorFileSyncManager as any
			await manager.handleExternalChange(path, { path, timestamp: Date.now() }, mockEditor)
			
			// Verify auto-reload occurred
			expect(mockEditor.setContent).toHaveBeenCalledWith('updated content')
			expect(mockEditor.markClean).toHaveBeenCalled()
			expect(notificationSystem.showNotification).toHaveBeenCalledWith(
				'File "file.ts" was updated and reloaded',
				'info'
			)
		})

		it('should not auto-reload dirty files', async () => {
			const mockEditor = createMockEditor()
			mockEditor.isDirty = vi.fn().mockReturnValue(true) // File is dirty
			const path = '/test/file.ts'
			
			// Register the file
			await editorFileSyncManager.registerOpenFile(path, mockEditor)
			
			// Directly call the handleExternalChange method
			const manager = editorFileSyncManager as any
			await manager.handleExternalChange(path, { path, timestamp: Date.now() }, mockEditor)
			
			// Verify auto-reload did NOT occur
			expect(mockEditor.setContent).not.toHaveBeenCalled()
			expect(mockEditor.markClean).not.toHaveBeenCalled()
			
			// Should mark as conflict instead
			const status = editorFileSyncManager.getSyncStatus(path)
			expect(status.type).toBe('conflict')
		})

		it('should handle auto-reload errors gracefully', async () => {
			const mockEditor = createMockEditor()
			const path = '/test/file.ts'
			
			// Make getTracker return null to simulate error
			syncManager.getTracker = vi.fn().mockReturnValue(null)
			
			// Register the file
			await editorFileSyncManager.registerOpenFile(path, mockEditor)
			
			// Directly call the handleExternalChange method
			const manager = editorFileSyncManager as any
			await manager.handleExternalChange(path, { path, timestamp: Date.now() }, mockEditor)
			
			// Verify error handling
			const status = editorFileSyncManager.getSyncStatus(path)
			expect(status.type).toBe('error')
			expect(status.errorMessage).toBe('File tracker not found')
			expect(notificationSystem.showNotification).toHaveBeenCalledWith(
				'Failed to reload "file.ts": File tracker not found',
				'error'
			)
		})
	})

	describe('File deletion handling', () => {
		it('should close clean files when deleted externally', async () => {
			const mockEditor = createMockEditor()
			const path = '/test/file.ts'
			
			// Register the file first
			await editorFileSyncManager.registerOpenFile(path, mockEditor)
			
			// Directly call the handleFileDeleted method
			const manager = editorFileSyncManager as any
			manager.handleFileDeleted(path, { path, timestamp: Date.now() }, mockEditor)
			
			// Verify file should be closed
			expect(editorFileSyncManager.shouldCloseFile(path)).toBe(true)
			expect(notificationSystem.showNotification).toHaveBeenCalledWith(
				'File "file.ts" was deleted externally and has been closed',
				'info'
			)
		})

		it('should not close dirty files when deleted externally', async () => {
			const mockEditor = createMockEditor()
			mockEditor.isDirty = vi.fn().mockReturnValue(true) // File is dirty
			const path = '/test/file.ts'
			
			// Register the file first
			await editorFileSyncManager.registerOpenFile(path, mockEditor)
			
			// Directly call the handleFileDeleted method
			const manager = editorFileSyncManager as any
			manager.handleFileDeleted(path, { path, timestamp: Date.now() }, mockEditor)
			
			// Verify file should NOT be closed
			expect(editorFileSyncManager.shouldCloseFile(path)).toBe(false)
			expect(notificationSystem.showNotification).toHaveBeenCalledWith(
				'File "file.ts" was deleted externally but has unsaved changes. Save to restore the file.',
				'warning'
			)
			
			// Should mark as error but keep file open
			const status = editorFileSyncManager.getSyncStatus(path)
			expect(status.type).toBe('error')
			expect(status.errorMessage).toBe('File was deleted externally but has unsaved changes')
		})
	})

	// Property-based test for file registration lifecycle
	it('Property 1: File Registration Lifecycle - should register and unregister files without resource leaks', async () => {
		/**
		 * Feature: editor-file-sync-integration, Property 1: File Registration Lifecycle
		 * Validates: Requirements 1.1, 1.2, 1.4
		 * 
		 * For any file opened in the editor, the system SHALL register it with the FileSyncManager 
		 * for change tracking, and when closed, SHALL unregister it completely with no resource 
		 * leaks or orphaned watchers.
		 */
		await fc.assert(
			fc.asyncProperty(
				// Generate sequences of file operations (open/close)
				fc.array(
					fc.record({
						action: fc.constantFrom('open', 'close'),
						// Generate valid file paths without spaces or special characters
						path: fc.string({ 
							minLength: 1, 
							maxLength: 20,
							// Use alphanumeric characters and common filename chars
							unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_')
						}).map(s => `/test/${s || 'file'}.ts`),
					}),
					{ minLength: 1, maxLength: 15 }
				),
				async (operations) => {
					// Create a fresh manager for each test
					const testSyncManager = createMockFileSyncManager()
					const testEditorRegistry = new EditorRegistryImpl()
					const testConfig = { ...DEFAULT_EDITOR_SYNC_CONFIG }
					
					const testManager = new EditorFileSyncManager({
						syncManager: testSyncManager,
						editorRegistry: testEditorRegistry,
						config: testConfig,
					})

					// Track which files are currently open
					const openFiles = new Set<string>()
					const mockEditors = new Map<string, EditorInstance>()
					const allOpenedPaths = new Set<string>()

					try {
						// Execute the sequence of operations
						for (const op of operations) {
							if (op.action === 'open') {
								if (!openFiles.has(op.path)) {
									const mockEditor = createMockEditor()
									mockEditors.set(op.path, mockEditor)
									await testManager.registerOpenFile(op.path, mockEditor)
									openFiles.add(op.path)
									allOpenedPaths.add(op.path)
								}
							} else if (op.action === 'close') {
								if (openFiles.has(op.path)) {
									testManager.unregisterOpenFile(op.path)
									openFiles.delete(op.path)
									mockEditors.delete(op.path)
								}
							}
						}

						// Verify that all currently open files are properly registered
						for (const path of openFiles) {
							const status = testManager.getSyncStatus(path)
							// File should be tracked (not 'not-watched')
							expect(status.type).not.toBe('not-watched')
						}

						// Verify that closed files are properly unregistered
						for (const path of allOpenedPaths) {
							if (!openFiles.has(path)) {
								const status = testManager.getSyncStatus(path)
								// Closed files should not be watched
								expect(status.type).toBe('not-watched')
							}
						}

						// Verify track was called for all opened files
						for (const path of allOpenedPaths) {
							expect(testSyncManager.track).toHaveBeenCalledWith(path, { reactive: false })
						}

						// Clean up remaining open files
						for (const path of openFiles) {
							testManager.unregisterOpenFile(path)
						}

						// Verify untrack was called for all files that were opened
						for (const path of allOpenedPaths) {
							expect(testSyncManager.untrack).toHaveBeenCalledWith(path)
						}

						// Verify no resource leaks - dispose should clean up everything
						testManager.dispose()
						
						// After disposal, all files should be not-watched
						for (const path of allOpenedPaths) {
							const status = testManager.getSyncStatus(path)
							expect(status.type).toBe('not-watched')
						}

					} finally {
						// Always clean up
						testManager.dispose()
					}
				}
			),
			{ numRuns: 100 } // Run 100 iterations as specified in the design
		)
	})

	// Property-based test for conflict detection and resolution
	it('Property 3: Conflict Detection and Resolution - should detect conflicts and provide resolution options', async () => {
		/**
		 * Feature: editor-file-sync-integration, Property 3: Conflict Detection and Resolution
		 * Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5
		 * 
		 * For any file with unsaved local changes that receives external changes, a conflict SHALL be detected,
		 * the user SHALL be notified with resolution options (keep local, use external, show diff), and no 
		 * automatic content updates SHALL occur until the conflict is explicitly resolved.
		 */
		await fc.assert(
			fc.asyncProperty(
				// Generate test scenarios with different content states
				fc.record({
					// File path
					path: fc.string({ 
						minLength: 1, 
						maxLength: 20,
						unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_')
					}).map(s => `/test/${s || 'file'}.ts`),
					
					// Different content versions
					baseContent: fc.string({ minLength: 0, maxLength: 100 }),
					localContent: fc.string({ minLength: 0, maxLength: 100 }),
					externalContent: fc.string({ minLength: 0, maxLength: 100 }),
					
					// Editor dirty state
					isDirty: fc.boolean(),
					
					// Resolution strategy to test
					resolutionStrategy: fc.constantFrom('keep-local', 'use-external', 'manual-merge', 'skip'),
					
					// Merged content for manual merge strategy (ensure it's non-empty for manual merge)
					mergedContent: fc.string({ minLength: 1, maxLength: 100 }),
				}),
				async (scenario) => {
					// Skip scenarios where there's no actual conflict
					// (conflict requires both local changes and external changes)
					if (!scenario.isDirty || scenario.localContent === scenario.externalContent) {
						return // Skip non-conflict scenarios
					}

					// Create a fresh manager for each test
					const testSyncManager = createMockFileSyncManager()
					const testEditorRegistry = new EditorRegistryImpl()
					const testConfig = { 
						...DEFAULT_EDITOR_SYNC_CONFIG,
						// Set to manual-merge to prevent auto-resolution during testing
						defaultConflictResolution: 'manual-merge' as const
					}
					const testNotificationSystem = createMockNotificationSystem()
					
					const testManager = new EditorFileSyncManager({
						syncManager: testSyncManager,
						editorRegistry: testEditorRegistry,
						config: testConfig,
						notificationSystem: testNotificationSystem,
					})

					// Create mock editor with the scenario's content and dirty state
					const mockEditor = createMockEditor()
					vi.mocked(mockEditor.getContent).mockReturnValue(scenario.localContent)
					vi.mocked(mockEditor.isDirty).mockReturnValue(scenario.isDirty)

					// Register the editor with the registry so it can be found during resolution
					testEditorRegistry.registerEditor(scenario.path, mockEditor)

					// Mock tracker to return the scenario's content
					const mockTracker = {
						path: scenario.path,
						mode: 'tracked' as const,
						isDirty: scenario.isDirty,
						hasExternalChanges: true,
						syncState: 'conflict' as const,
						getLocalContent: vi.fn().mockReturnValue({ toString: () => scenario.localContent }),
						getBaseContent: vi.fn().mockReturnValue({ toString: () => scenario.baseContent }),
						getDiskContent: vi.fn().mockReturnValue({ toString: () => scenario.externalContent }),
						resolveKeepLocal: vi.fn().mockResolvedValue(undefined),
						resolveAcceptExternal: vi.fn().mockResolvedValue(undefined),
						resolveMerge: vi.fn().mockResolvedValue(undefined),
					}
					vi.mocked(testSyncManager.getTracker).mockReturnValue(mockTracker as any)

					// Track status changes and conflict resolution requests
					const statusChanges: Array<{ path: string; status: any }> = []
					const conflictRequests: Array<{ path: string; conflictInfo: any }> = []

					const statusUnsubscribe = testManager.onSyncStatusChange((path, status) => {
						statusChanges.push({ path, status })
					})

					const conflictUnsubscribe = testManager.onConflictResolutionRequest((path, conflictInfo) => {
						conflictRequests.push({ path, conflictInfo })
					})

					try {
						// Register the file
						await testManager.registerOpenFile(scenario.path, mockEditor)

						// Simulate a conflict event
						const conflictEvent = {
							type: 'conflict' as const,
							path: scenario.path,
							tracker: mockTracker,
							baseContent: ByteContentHandleFactory.fromString(scenario.baseContent),
							localContent: ByteContentHandleFactory.fromString(scenario.localContent),
							diskContent: ByteContentHandleFactory.fromString(scenario.externalContent),
						}

						// Get the conflict handler from the sync manager mock
						const onConflictCalls = vi.mocked(testSyncManager.on).mock.calls.filter(call => call[0] === 'conflict')
						expect(onConflictCalls.length).toBeGreaterThan(0)
						
						const conflictHandler = onConflictCalls[0]![1]
						await conflictHandler(conflictEvent)

						// Verify conflict detection
						expect(testManager.hasConflict(scenario.path)).toBe(true)
						expect(testManager.getConflictCount()).toBe(1)

						const conflictInfo = testManager.getConflictInfo(scenario.path)
						expect(conflictInfo).toBeDefined()
						expect(conflictInfo!.path).toBe(scenario.path)
						expect(conflictInfo!.baseContent).toBe(scenario.baseContent)
						expect(conflictInfo!.localContent).toBe(scenario.localContent)
						expect(conflictInfo!.externalContent).toBe(scenario.externalContent)

						// Verify status change to conflict
						const conflictStatusChanges = statusChanges.filter(sc => sc.status.type === 'conflict')
						expect(conflictStatusChanges.length).toBeGreaterThan(0)

						// Verify notification was shown
						expect(testNotificationSystem.showNotification).toHaveBeenCalledWith(
							expect.stringContaining('Conflict detected'),
							'warning'
						)

						// Test conflict resolution - only use manual-merge if we have non-empty merged content
						const resolution: ConflictResolution = scenario.resolutionStrategy === 'manual-merge' && scenario.mergedContent.trim()
							? { strategy: scenario.resolutionStrategy, mergedContent: scenario.mergedContent }
							: scenario.resolutionStrategy === 'manual-merge'
							? { strategy: 'keep-local' } // Fallback to keep-local if no merged content
							: { strategy: scenario.resolutionStrategy }

						if (scenario.resolutionStrategy !== 'skip') {
							// Resolve the conflict
							await testManager.resolveConflict(scenario.path, resolution)

							// Verify conflict is cleared
							expect(testManager.hasConflict(scenario.path)).toBe(false)
							expect(testManager.getConflictCount()).toBe(0)

							// Verify appropriate tracker method was called
							const actualStrategy = scenario.resolutionStrategy === 'manual-merge' && !scenario.mergedContent.trim()
								? 'keep-local' // Fallback case
								: scenario.resolutionStrategy

							switch (actualStrategy) {
								case 'keep-local':
									expect(mockTracker.resolveKeepLocal).toHaveBeenCalled()
									break
								case 'use-external':
									expect(mockTracker.resolveAcceptExternal).toHaveBeenCalled()
									expect(mockEditor.setContent).toHaveBeenCalledWith(scenario.externalContent)
									break
								case 'manual-merge':
									expect(mockTracker.resolveMerge).toHaveBeenCalledWith(scenario.mergedContent)
									expect(mockEditor.setContent).toHaveBeenCalledWith(scenario.mergedContent)
									break
							}

							// Verify editor is marked clean after resolution
							expect(mockEditor.markClean).toHaveBeenCalled()

							// Verify status change to synced
							const syncedStatusChanges = statusChanges.filter(sc => sc.status.type === 'synced')
							expect(syncedStatusChanges.length).toBeGreaterThan(0)

							// Verify success notification
							expect(testNotificationSystem.showNotification).toHaveBeenCalledWith(
								expect.stringContaining('resolved'),
								'info'
							)
						} else {
							// Test skip strategy
							testManager.skipConflict(scenario.path)
							
							// Verify conflict is cleared but status remains conflict
							expect(testManager.hasConflict(scenario.path)).toBe(false)
							
							// Verify skip notification
							expect(testNotificationSystem.showNotification).toHaveBeenCalledWith(
								expect.stringContaining('skipped'),
								'info'
							)
						}

						// Test manual conflict resolution UI trigger
						if (testManager.hasConflict(scenario.path)) {
							testManager.showConflictResolution(scenario.path)
							
							// Should emit conflict resolution request
							expect(conflictRequests.length).toBeGreaterThan(0)
							expect(conflictRequests[0]!.path).toBe(scenario.path)
						}

					} finally {
						// Clean up
						statusUnsubscribe()
						conflictUnsubscribe()
						testEditorRegistry.dispose()
						testManager.dispose()
					}
				}
			),
			{ numRuns: 100 } // Run 100 iterations as specified in the design
		)
	})
})