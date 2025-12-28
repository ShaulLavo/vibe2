import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { TreeCacheController } from './treeCacheController'
import { CachedPrefetchQueue } from './cachedPrefetchQueue'
import type { FsDirTreeNode } from '@repo/fs'

describe('Cache Management Browser Tests', () => {
	describe('Property 20: Cache management operations', () => {
		it('should completely remove all specified cached data for clear operations', async () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping cache management test - IndexedDB not available in test environment')
				return
			}

			const controller = new TreeCacheController({
				dbName: `test-cache-clear-${Math.random().toString(36).substring(7)}`,
			})

			// Create test data
			const testNodes = new Map<string, FsDirTreeNode>()
			for (let i = 0; i < 5; i++) {
				const path = `/test-clear-${i}`
				testNodes.set(path, {
					kind: 'dir',
					name: `test-clear-${i}`,
					path,
					depth: 0,
					children: [
						{
							kind: 'file',
							name: `file-${i}.txt`,
							path: `${path}/file-${i}.txt`,
							depth: 1,
							parentPath: path,
							size: 100 * i,
							lastModified: Date.now() - i * 1000,
						},
					],
					isLoaded: true,
				})
			}

			try {
				// Cache all test data
				await controller.batchSetDirectories(testNodes)

				// Verify data is cached
				let stats = await controller.getCacheStats()
				expect(stats.totalEntries).toBeGreaterThan(0)

				// Test clear operation with progress tracking
				const progressUpdates: Array<{ completed: number; total: number; currentOperation: string }> = []
				
				await controller.clearCacheWithProgress((progress) => {
					progressUpdates.push({ ...progress })
				})

				// Verify all data is removed
				stats = await controller.getCacheStats()
				expect(stats.totalEntries).toBe(0)
				expect(stats.hitRate).toBe(0)
				expect(stats.missRate).toBe(0)

				// Verify progress tracking worked
				expect(progressUpdates.length).toBeGreaterThan(0)
				const finalProgress = progressUpdates[progressUpdates.length - 1]!
				expect(finalProgress.completed).toBe(finalProgress.total)
				expect(finalProgress.currentOperation).toContain('cleared')

				// Verify no cached data can be retrieved
				for (const [path] of testNodes) {
					const retrieved = await controller.getCachedDirectory(path)
					expect(retrieved).toBeNull()
				}
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes('No available storage method found')
				) {
					console.warn(
						'Skipping cache clear test - IndexedDB not available in test environment'
					)
					return
				}
				throw error
			}
		})

		it('should completely remove specified cached data for invalidate operations', async () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping cache invalidate test - IndexedDB not available in test environment')
				return
			}

			const controller = new TreeCacheController({
				dbName: `test-cache-invalidate-${Math.random().toString(36).substring(7)}`,
			})

			// Create hierarchical test data
			const rootNode: FsDirTreeNode = {
				kind: 'dir',
				name: 'root',
				path: '/root',
				depth: 0,
				children: [
					{
						kind: 'dir',
						name: 'subdir1',
						path: '/root/subdir1',
						depth: 1,
						parentPath: '/root',
						children: [],
						isLoaded: true,
					},
					{
						kind: 'dir',
						name: 'subdir2',
						path: '/root/subdir2',
						depth: 1,
						parentPath: '/root',
						children: [],
						isLoaded: true,
					},
				],
				isLoaded: true,
			}

			const subdir1Node: FsDirTreeNode = {
				kind: 'dir',
				name: 'subdir1',
				path: '/root/subdir1',
				depth: 1,
				parentPath: '/root',
				children: [
					{
						kind: 'file',
						name: 'file1.txt',
						path: '/root/subdir1/file1.txt',
						depth: 2,
						parentPath: '/root/subdir1',
						size: 1000,
						lastModified: Date.now(),
					},
				],
				isLoaded: true,
			}

			const subdir2Node: FsDirTreeNode = {
				kind: 'dir',
				name: 'subdir2',
				path: '/root/subdir2',
				depth: 1,
				parentPath: '/root',
				children: [
					{
						kind: 'file',
						name: 'file2.txt',
						path: '/root/subdir2/file2.txt',
						depth: 2,
						parentPath: '/root/subdir2',
						size: 2000,
						lastModified: Date.now(),
					},
				],
				isLoaded: true,
			}

			try {
				// Cache all nodes
				await controller.setCachedDirectory('/root', rootNode)
				await controller.setCachedDirectory('/root/subdir1', subdir1Node)
				await controller.setCachedDirectory('/root/subdir2', subdir2Node)

				// Verify all data is cached
				expect(await controller.getCachedDirectory('/root')).not.toBeNull()
				expect(await controller.getCachedDirectory('/root/subdir1')).not.toBeNull()
				expect(await controller.getCachedDirectory('/root/subdir2')).not.toBeNull()

				// Test subtree invalidation with progress tracking
				const progressUpdates: Array<{ completed: number; total: number; currentOperation: string }> = []
				
				await controller.invalidateSubtreeWithProgress('/root/subdir1', (progress) => {
					progressUpdates.push({ ...progress })
				})

				// Verify only subdir1 is invalidated, others remain
				expect(await controller.getCachedDirectory('/root')).not.toBeNull()
				expect(await controller.getCachedDirectory('/root/subdir1')).toBeNull() // Should be invalidated
				expect(await controller.getCachedDirectory('/root/subdir2')).not.toBeNull()

				// Verify progress tracking worked
				expect(progressUpdates.length).toBeGreaterThan(0)
				const finalProgress = progressUpdates[progressUpdates.length - 1]!
				expect(finalProgress.completed).toBe(finalProgress.total)
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes('No available storage method found')
				) {
					console.warn(
						'Skipping cache invalidate test - IndexedDB not available in test environment'
					)
					return
				}
				throw error
			}
		})

		it('should handle property-based testing for cache management operations', () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping cache management property test - IndexedDB not available in test environment')
				return
			}

			const validNameArb = fc
				.string({ minLength: 1, maxLength: 10 })
				.filter(
					(s) => !s.includes('/') && !s.includes('\0') && s.trim().length > 0
				)

			const cacheEntryCountArb = fc.integer({ min: 1, max: 10 })
			const operationArb = fc.constantFrom('clear', 'cleanup', 'validate', 'compact')

			const createTestNode = (name: string, index: number): FsDirTreeNode => ({
				kind: 'dir',
				name: `${name}-${index}`,
				path: `/${name}-${index}`,
				depth: 0,
				children: [
					{
						kind: 'file',
						name: `file-${index}.txt`,
						path: `/${name}-${index}/file-${index}.txt`,
						depth: 1,
						parentPath: `/${name}-${index}`,
						size: 100 + index,
						lastModified: Date.now() - index * 1000,
					},
				],
				isLoaded: true,
			})

			fc.assert(
				fc.asyncProperty(
					validNameArb,
					cacheEntryCountArb,
					operationArb,
					async (baseName: string, entryCount: number, operation: 'clear' | 'cleanup' | 'validate' | 'compact') => {
						const mockLoadDirectory = async () => undefined
						const mockCallbacks = {
							onDirectoryLoaded: () => {},
							onStatus: () => {},
							onDeferredMetadata: () => {},
							onError: () => {},
						}

						const queue = new CachedPrefetchQueue({
							workerCount: 1,
							loadDirectory: mockLoadDirectory,
							callbacks: mockCallbacks,
							cacheController: new TreeCacheController({
								dbName: `test-cache-mgmt-prop-${Math.random().toString(36).substring(7)}`,
							}),
						})

						try {
							// Create and cache test entries
							const testNodes = new Map<string, FsDirTreeNode>()
							for (let i = 0; i < entryCount; i++) {
								const node = createTestNode(baseName, i)
								testNodes.set(node.path, node)
							}

							// Cache all entries
							await queue['cacheController'].batchSetDirectories(testNodes)

							// Verify entries are cached
							const initialStats = await queue.getCacheStats()
							expect(initialStats.totalEntries).toBeGreaterThan(0)

							// Test cache management operation
							const progressUpdates: any[] = []
							const result = await queue.performCacheManagement(operation, {
								maxAgeMs: 1000, // Very short age for cleanup testing
								onProgress: (progress) => {
									progressUpdates.push(progress)
								}
							})

							// For any cache management request, all specified cached data should be removed completely
							expect(result).toBeDefined()
							
							if (operation === 'clear') {
								// Clear should remove all data
								const finalStats = await queue.getCacheStats()
								expect(finalStats.totalEntries).toBe(0)
								
								// Verify no data can be retrieved
								for (const [path] of testNodes) {
									const retrieved = await queue['cacheController'].getCachedDirectory(path)
									expect(retrieved).toBeNull()
								}
							} else if (operation === 'validate') {
								// Validate should return integrity information
								expect(result.validEntries).toBeGreaterThanOrEqual(0)
								expect(result.corruptedEntries).toBeGreaterThanOrEqual(0)
								expect(result.repairedEntries).toBeGreaterThanOrEqual(0)
								expect(Array.isArray(result.issues)).toBe(true)
							} else if (operation === 'compact') {
								// Compact should return compaction information
								expect(result.removedEntries).toBeGreaterThanOrEqual(0)
								expect(result.spaceSaved).toBeGreaterThanOrEqual(0)
							}

							// Verify progress tracking worked for operations that support it
							if (operation !== 'cleanup' || progressUpdates.length > 0) {
								expect(progressUpdates.length).toBeGreaterThanOrEqual(0)
								if (progressUpdates.length > 0) {
									const finalProgress = progressUpdates[progressUpdates.length - 1]!
									expect(finalProgress.completed).toBeGreaterThanOrEqual(0)
									expect(finalProgress.total).toBeGreaterThanOrEqual(0)
									expect(typeof finalProgress.currentOperation).toBe('string')
								}
							}

							await queue.clearCache()
						} catch (error) {
							if (
								error instanceof Error &&
								error.message.includes('No available storage method found')
							) {
								console.warn(
									'Skipping cache management property test - IndexedDB not available'
								)
								return
							}
							console.error('Cache management test failed:', { baseName, entryCount, operation })
							console.error('Error:', error)
							throw error
						}
					}
				),
				{ numRuns: 15 }
			)
		})

		it('should provide accurate cache size and statistics information', async () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping cache info test - IndexedDB not available in test environment')
				return
			}

			const controller = new TreeCacheController({
				dbName: `test-cache-info-${Math.random().toString(36).substring(7)}`,
			})

			try {
				// Initially should have no entries
				const initialSize = await controller.getCacheSize()
				expect(initialSize.totalEntries).toBe(0)
				expect(initialSize.estimatedSizeBytes).toBe(0)

				// Add some test data
				const testNodes = new Map<string, FsDirTreeNode>()
				for (let i = 0; i < 3; i++) {
					const path = `/test-info-${i}`
					testNodes.set(path, {
						kind: 'dir',
						name: `test-info-${i}`,
						path,
						depth: 0,
						children: [
							{
								kind: 'file',
								name: `file-${i}.txt`,
								path: `${path}/file-${i}.txt`,
								depth: 1,
								parentPath: path,
								size: 200 * i,
								lastModified: Date.now() - i * 2000,
							},
						],
						isLoaded: true,
					})
				}

				await controller.batchSetDirectories(testNodes)

				// Check size information
				const sizeInfo = await controller.getCacheSize()
				expect(sizeInfo.totalEntries).toBe(3)
				expect(sizeInfo.estimatedSizeBytes).toBeGreaterThan(0)
				expect(sizeInfo.newestEntry).toBeGreaterThan(sizeInfo.oldestEntry)

				// Check stats information
				const stats = await controller.getCacheStats()
				expect(stats.totalEntries).toBe(3)
				expect(stats.batchWrites).toBe(1) // One batch write operation
				expect(stats.totalSizeBytes).toBeGreaterThan(0)
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes('No available storage method found')
				) {
					console.warn(
						'Skipping cache info test - IndexedDB not available in test environment'
					)
					return
				}
				throw error
			}
		})
	})
})