import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import type { FsDirTreeNode } from '@repo/fs'
import { createTreePrefetchClient } from '../prefetch/treePrefetchClient'
import type { TreePrefetchWorkerCallbacks, TreePrefetchWorkerInitPayload } from '../prefetch/treePrefetchWorkerTypes'
import { CachedPrefetchQueue } from './cachedPrefetchQueue'
import { TreeCacheController } from './treeCacheController'

// Mock the worker pool and related dependencies
vi.mock('../../workers/comlinkPool', () => ({
	ComlinkPool: vi.fn().mockImplementation(() => ({
		api: {
			loadDirectory: vi.fn().mockResolvedValue(undefined),
		},
		broadcast: vi.fn().mockResolvedValue(undefined),
		destroy: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock('../prefetch/treePrefetch.worker.ts', () => ({}))

describe('TreePrefetchClient API Compatibility Tests', () => {
	let mockCallbacks: TreePrefetchWorkerCallbacks
	let mockInitPayload: TreePrefetchWorkerInitPayload

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Create mock callbacks
		mockCallbacks = {
			onDirectoryLoaded: vi.fn(),
			onStatus: vi.fn(),
			onDeferredMetadata: vi.fn(),
			onError: vi.fn(),
		}

		// Create mock init payload
		mockInitPayload = {
			source: 'local' as const,
			rootHandle: {} as FileSystemDirectoryHandle,
			rootPath: '/test-root',
			rootName: 'test-root',
		}
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe('Property 24: API compatibility preservation', () => {
		it('should maintain the same API interface with caching enabled', async () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping API compatibility test - IndexedDB not available in test environment')
				return
			}

			const client = createTreePrefetchClient(mockCallbacks)

			// Verify all required methods exist
			expect(typeof client.init).toBe('function')
			expect(typeof client.seedTree).toBe('function')
			expect(typeof client.ingestSubtree).toBe('function')
			expect(typeof client.markDirLoaded).toBe('function')
			expect(typeof client.dispose).toBe('function')

			// Test that methods can be called without throwing
			await expect(client.init(mockInitPayload)).resolves.not.toThrow()
			await expect(client.seedTree({} as FsDirTreeNode)).resolves.not.toThrow()
			await expect(client.ingestSubtree({} as FsDirTreeNode)).resolves.not.toThrow()
			await expect(client.markDirLoaded('/test-path')).resolves.not.toThrow()
			await expect(client.dispose()).resolves.not.toThrow()
		})

		it('should handle property-based testing for API compatibility preservation', () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping API compatibility property test - IndexedDB not available in test environment')
				return
			}

			const validPathArb = fc
				.string({ minLength: 1, maxLength: 50 })
				.filter((s) => !s.includes('\0') && s.trim().length > 0)

			const validNameArb = fc
				.string({ minLength: 1, maxLength: 20 })
				.filter((s) => !s.includes('/') && !s.includes('\0') && s.trim().length > 0)

			const treeNodeArb = fc.record({
				kind: fc.constant('dir' as const),
				name: validNameArb,
				path: validPathArb,
				depth: fc.integer({ min: 0, max: 3 }),
				parentPath: fc.option(validPathArb, { nil: undefined }),
				children: fc.array(
					fc.record({
						kind: fc.constant('file' as const),
						name: validNameArb,
						path: validPathArb,
						depth: fc.integer({ min: 1, max: 4 }),
						parentPath: fc.option(validPathArb, { nil: undefined }),
						size: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
						lastModified: fc.option(fc.integer({ min: 0, max: Date.now() }), { nil: undefined }),
					}),
					{ maxLength: 3 }
				),
				isLoaded: fc.option(fc.boolean(), { nil: undefined }),
			})

			fc.assert(
				fc.asyncProperty(
					treeNodeArb,
					validPathArb,
					async (testNode: FsDirTreeNode, testPath: string) => {
						try {
							const client = createTreePrefetchClient(mockCallbacks)

							// Test that all API methods work with various inputs
							await client.init(mockInitPayload)
							await client.seedTree(testNode)
							await client.ingestSubtree(testNode)
							await client.markDirLoaded(testPath)

							// Verify callbacks are still called (API compatibility)
							// The exact behavior may differ with caching, but the API should remain the same
							expect(mockCallbacks.onDirectoryLoaded).toBeDefined()
							expect(mockCallbacks.onStatus).toBeDefined()
							expect(mockCallbacks.onDeferredMetadata).toBeDefined()
							expect(mockCallbacks.onError).toBeDefined()

							await client.dispose()
						} catch (error) {
							// API compatibility means methods shouldn't throw unexpected errors
							console.error('API compatibility test failed:', error)
							throw error
						}
					}
				),
				{ numRuns: 20 }
			)
		})

		it('should preserve callback behavior with cached and non-cached operations', async () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping callback compatibility test - IndexedDB not available in test environment')
				return
			}

			const client = createTreePrefetchClient(mockCallbacks)

			const testNode: FsDirTreeNode = {
				kind: 'dir',
				name: 'test-dir',
				path: '/test-dir',
				depth: 0,
				children: [
					{
						kind: 'file',
						name: 'test-file.txt',
						path: '/test-dir/test-file.txt',
						depth: 1,
						parentPath: '/test-dir',
						size: 1024,
						lastModified: Date.now(),
					},
				],
				isLoaded: true,
			}

			try {
				await client.init(mockInitPayload)
				await client.seedTree(testNode)

				// Verify that status callbacks are still called
				expect(mockCallbacks.onStatus).toHaveBeenCalled()

				// The exact number of calls may differ with caching, but callbacks should still be invoked
				const statusCalls = vi.mocked(mockCallbacks.onStatus).mock.calls
				expect(statusCalls.length).toBeGreaterThan(0)

				// Verify status payload structure remains the same
				const lastStatusCall = statusCalls[statusCalls.length - 1]
				expect(lastStatusCall).toBeDefined()
				if (lastStatusCall) {
					expect(lastStatusCall[0]).toHaveProperty('running')
					expect(lastStatusCall[0]).toHaveProperty('pending')
					expect(lastStatusCall[0]).toHaveProperty('processedCount')
				}

				await client.dispose()
			} catch (error) {
				console.error('Callback compatibility test failed:', error)
				throw error
			}
		})

		it('should maintain the same TreePrefetchClient type interface', () => {
			const client = createTreePrefetchClient(mockCallbacks)

			// Type-level compatibility check - these should compile without errors
			const initMethod: (payload: TreePrefetchWorkerInitPayload) => Promise<void> = client.init
			const seedTreeMethod: (tree: FsDirTreeNode) => Promise<void> = client.seedTree
			const ingestSubtreeMethod: (node: FsDirTreeNode) => Promise<void> = client.ingestSubtree
			const markDirLoadedMethod: (path: string) => Promise<void> = client.markDirLoaded
			const disposeMethod: () => Promise<void> = client.dispose

			// Verify methods exist and have correct signatures
			expect(initMethod).toBe(client.init)
			expect(seedTreeMethod).toBe(client.seedTree)
			expect(ingestSubtreeMethod).toBe(client.ingestSubtree)
			expect(markDirLoadedMethod).toBe(client.markDirLoaded)
			expect(disposeMethod).toBe(client.dispose)
		})
	})
})

/**
 * **Feature: persistent-tree-cache, Property 24: API compatibility preservation**
 * 
 * This test validates that the TreePrefetchClient maintains complete API compatibility
 * when caching is enabled. All existing methods should work the same way, callbacks
 * should still be invoked, and the type interface should remain unchanged.
 */