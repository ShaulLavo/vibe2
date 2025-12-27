import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
	CACHE_KEY_SCHEMA,
	TreeCacheController,
	type CachedDirectoryEntry,
} from './treeCacheController'
import type { FsDirTreeNode } from '@repo/fs'

// Helper type to access private methods and verify absence of properties for testing
interface TestTreeCacheController {
	convertTreeNodeToCached(node: FsDirTreeNode): CachedDirectoryEntry
	convertCachedToTreeNode(cached: CachedDirectoryEntry): FsDirTreeNode
	memoryCache?: unknown
	inMemoryData?: unknown
	cachedData?: unknown
}

describe('TreeCacheController Browser Tests', () => {
	describe('Property 2: Cache key format consistency', () => {
		it('should generate cache keys in the format "v1:tree:{directory_path}" for directory nodes', () => {
			fc.assert(
				fc.property(
					fc.oneof(
						fc
							.string({ minLength: 1, maxLength: 30 })
							.map((s) => `/${s.replace(/\0/g, '')}`),
						fc
							.string({ minLength: 1, maxLength: 30 })
							.map((s) => s.replace(/\0/g, '')),
						fc
							.array(fc.string({ minLength: 1, maxLength: 10 }), {
								minLength: 1,
								maxLength: 3,
							})
							.map((parts) => parts.map((p) => p.replace(/\0/g, '')).join('/')),
						fc.constant('/'),
						fc.constant('')
					),
					(directoryPath) => {
						const cacheKey = CACHE_KEY_SCHEMA.dir(directoryPath)
						const expectedKey = `v1:tree:dir:${directoryPath}`

						expect(cacheKey).toBe(expectedKey)
						expect(cacheKey).toMatch(/^v1:tree:dir:.*$/)
						expect(cacheKey.startsWith('v1:tree:dir:')).toBe(true)

						const extractedPath = cacheKey.substring('v1:tree:dir:'.length)
						expect(extractedPath).toBe(directoryPath)
					}
				),
				{ numRuns: 20 }
			)
		})
	})

	describe('Property 1: LocalForage-only storage', () => {
		it('should store all directory data in IndexedDB and not persist in memory after operations', async () => {
			const controller = new TreeCacheController({
				dbName: `test-localforage-only-${Math.random().toString(36).substring(7)}`,
			})

			const testNode: FsDirTreeNode = {
				kind: 'dir',
				name: 'test-storage',
				path: '/test-storage',
				depth: 0,
				children: [
					{
						kind: 'file',
						name: 'file1.txt',
						path: '/test-storage/file1.txt',
						depth: 1,
						parentPath: '/test-storage',
						size: 1024,
						lastModified: Date.now(),
					},
					{
						kind: 'dir',
						name: 'subdir',
						path: '/test-storage/subdir',
						depth: 1,
						parentPath: '/test-storage',
						children: [],
						isLoaded: true,
					},
				],
				isLoaded: true,
			}

			try {
				await controller.setCachedDirectory('/test-storage', testNode)

				const retrievedNode =
					await controller.getCachedDirectory('/test-storage')
				expect(retrievedNode).not.toBeNull()
				expect(retrievedNode!.name).toBe('test-storage')
				expect(retrievedNode!.children).toHaveLength(2)

				const controllerAny = controller as unknown as TestTreeCacheController
				expect(controllerAny.memoryCache).toBeUndefined()
				expect(controllerAny.inMemoryData).toBeUndefined()

				const stats = await controller.getCacheStats()
				expect(stats.totalEntries).toBeGreaterThan(0)
				expect(stats.indexedDBSize).toBeGreaterThan(0)
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes('No available storage method found')
				) {
					console.warn(
						'Skipping LocalForage test - IndexedDB not available in test environment'
					)
					return
				}
				throw error
			}
		})

		it('should handle property-based testing for LocalForage-only storage validation', () => {
			const validNameArb = fc
				.string({ minLength: 1, maxLength: 15 })
				.filter(
					(s) => !s.includes('/') && !s.includes('\0') && s.trim().length > 0
				)

			const validPathArb = fc
				.string({ minLength: 1, maxLength: 30 })
				.filter((s) => !s.includes('\0') && s.trim().length > 0)

			const fileNodeArb = fc.record({
				kind: fc.constant('file' as const),
				name: validNameArb,
				path: validPathArb,
				depth: fc.integer({ min: 0, max: 3 }),
				parentPath: fc.option(validPathArb, { nil: undefined }),
				size: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
				lastModified: fc.option(fc.integer({ min: 0, max: Date.now() }), {
					nil: undefined,
				}),
			})

			const treeNodeArb = fc.record({
				kind: fc.constant('dir' as const),
				name: validNameArb,
				path: validPathArb,
				depth: fc.integer({ min: 0, max: 2 }),
				parentPath: fc.option(validPathArb, { nil: undefined }),
				children: fc.array(fileNodeArb, { maxLength: 3 }),
				isLoaded: fc.option(fc.boolean(), { nil: undefined }),
			})

			fc.assert(
				fc.asyncProperty(treeNodeArb, async (testNode: FsDirTreeNode) => {
					const controller = new TreeCacheController({
						dbName: `test-localforage-prop-${Math.random().toString(36).substring(7)}`,
					})

					try {
						await controller.setCachedDirectory(testNode.path, testNode)

						const retrieved = await controller.getCachedDirectory(testNode.path)
						expect(retrieved).not.toBeNull()
						expect(retrieved!.name).toBe(testNode.name)
						expect(retrieved!.path).toBe(testNode.path)

						const controllerAny =
							controller as unknown as TestTreeCacheController
						expect(controllerAny.memoryCache).toBeUndefined()
						expect(controllerAny.inMemoryData).toBeUndefined()
						expect(controllerAny.cachedData).toBeUndefined()

						const stats = await controller.getCacheStats()
						expect(stats.indexedDBSize).toBeGreaterThan(0)
						expect(stats.totalEntries).toBeGreaterThan(0)

						await controller.clearCache()
					} catch (error) {
						if (
							error instanceof Error &&
							error.message.includes('No available storage method found')
						) {
							console.warn(
								'Skipping LocalForage property test - IndexedDB not available'
							)
							return
						}
						console.error(
							'LocalForage-only storage test failed for node:',
							testNode
						)
						console.error('Error:', error)
						throw error
					}
				}),
				{ numRuns: 30 }
			)
		})
	})

	describe('Property 4: Write batching optimization', () => {
		it('should batch multiple write operations into fewer IndexedDB transactions', async () => {
			const controller = new TreeCacheController({
				dbName: `test-batch-writes-${Math.random().toString(36).substring(7)}`,
			})

			const testNodes = new Map<string, FsDirTreeNode>()

			for (let i = 0; i < 5; i++) {
				const path = `/batch-test-${i}`
				testNodes.set(path, {
					kind: 'dir',
					name: `batch-test-${i}`,
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
				const startTime = performance.now()
				await controller.batchSetDirectories(testNodes)
				const batchTime = performance.now() - startTime

				const stats = await controller.getCacheStats()
				expect(stats.batchWrites).toBe(1)
				expect(stats.averageBatchWriteTime).toBeGreaterThan(0)
				expect(batchTime).toBeLessThan(1000)

				for (const [path] of testNodes) {
					const retrieved = await controller.getCachedDirectory(path)
					expect(retrieved).not.toBeNull()
					expect(retrieved!.path).toBe(path)
				}
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes('No available storage method found')
				) {
					console.warn(
						'Skipping batch write test - IndexedDB not available in test environment'
					)
					return
				}
				throw error
			}
		})

		it('should handle property-based testing for write batching optimization', () => {
			const validNameArb = fc
				.string({ minLength: 1, maxLength: 10 })
				.filter(
					(s) => !s.includes('/') && !s.includes('\0') && s.trim().length > 0
				)

			const batchSizeArb = fc.integer({ min: 1, max: 10 })

			const createTestNode = (
				index: number,
				baseName: string
			): FsDirTreeNode => ({
				kind: 'dir',
				name: `${baseName}-${index}`,
				path: `/${baseName}-${index}`,
				depth: 0,
				children: [
					{
						kind: 'file',
						name: `file-${index}.txt`,
						path: `/${baseName}-${index}/file-${index}.txt`,
						depth: 1,
						parentPath: `/${baseName}-${index}`,
						size: 100 + index,
						lastModified: Date.now() - index * 100,
					},
				],
				isLoaded: true,
			})

			fc.assert(
				fc.asyncProperty(
					validNameArb,
					batchSizeArb,
					async (baseName: string, batchSize: number) => {
						const controller = new TreeCacheController({
							dbName: `test-batch-prop-${Math.random().toString(36).substring(7)}`,
						})

						try {
							const testNodes = new Map<string, FsDirTreeNode>()

							for (let i = 0; i < batchSize; i++) {
								const node = createTestNode(i, baseName)
								testNodes.set(node.path, node)
							}

							const initialStats = await controller.getCacheStats()
							const initialBatchWrites = initialStats.batchWrites

							await controller.batchSetDirectories(testNodes)

							const finalStats = await controller.getCacheStats()
							expect(finalStats.batchWrites).toBe(initialBatchWrites + 1)
							expect(finalStats.averageBatchWriteTime).toBeGreaterThan(0)

							for (const [path, originalNode] of testNodes) {
								const retrieved = await controller.getCachedDirectory(path)
								expect(retrieved).not.toBeNull()
								expect(retrieved!.name).toBe(originalNode.name)
								expect(retrieved!.path).toBe(originalNode.path)
								expect(retrieved!.children).toHaveLength(
									originalNode.children.length
								)
							}

							await controller.clearCache()
						} catch (error) {
							if (
								error instanceof Error &&
								error.message.includes('No available storage method found')
							) {
								console.warn(
									'Skipping batch write property test - IndexedDB not available'
								)
								return
							}
							console.error('Batch write test failed:', { baseName, batchSize })
							console.error('Error:', error)
							throw error
						}
					}
				),
				{ numRuns: 20 }
			)
		})
	})

	describe('Property 3: Complete data serialization', () => {
		it('should preserve all children, metadata, and timestamp information during serialization round-trip', () => {
			const controller = new TreeCacheController({
				dbName: 'test-serialization-simple',
			})
			const controllerAny = controller as unknown as TestTreeCacheController

			const simpleNode: FsDirTreeNode = {
				kind: 'dir',
				name: 'test',
				path: '/test',
				depth: 0,
				children: [
					{
						kind: 'file',
						name: 'file1.txt',
						path: '/test/file1.txt',
						depth: 1,
						parentPath: '/test',
						size: 100,
						lastModified: 1234567890,
					},
					{
						kind: 'dir',
						name: 'subdir',
						path: '/test/subdir',
						depth: 1,
						parentPath: '/test',
						children: [],
						isLoaded: false,
					},
				],
				isLoaded: true,
			}

			const cachedEntry = controllerAny.convertTreeNodeToCached(simpleNode)
			const restoredNode = controllerAny.convertCachedToTreeNode(cachedEntry)

			expect(restoredNode.name).toBe(simpleNode.name)
			expect(restoredNode.path).toBe(simpleNode.path)
			expect(restoredNode.depth).toBe(simpleNode.depth)
			expect(restoredNode.isLoaded).toBe(simpleNode.isLoaded)
			expect(restoredNode.children).toHaveLength(2)

			const fileChild = restoredNode.children[0]!
			expect(fileChild.kind).toBe('file')
			expect(fileChild.name).toBe('file1.txt')
			if (fileChild.kind === 'file') {
				expect(fileChild.size).toBe(100)
				expect(fileChild.lastModified).toBe(1234567890)
			}

			const dirChild = restoredNode.children[1]!
			expect(dirChild.kind).toBe('dir')
			expect(dirChild.name).toBe('subdir')
			if (dirChild.kind === 'dir') {
				expect(dirChild.isLoaded).toBe(false)
				expect(dirChild.children).toEqual([])
			}

			expect(cachedEntry.cachedAt).toBeGreaterThan(0)
			expect(cachedEntry.version).toBe(1)
			expect(cachedEntry.children).toHaveLength(2)
		})

		it('should handle property-based testing for serialization round-trip', () => {
			const validNameArb = fc
				.string({ minLength: 1, maxLength: 20 })
				.filter(
					(s) =>
						!s.includes('/') &&
						!s.includes('\0') &&
						s.trim().length > 0 &&
						s !== '.' &&
						s !== '..'
				)

			const validPathArb = fc
				.string({ minLength: 1, maxLength: 50 })
				.filter((s) => !s.includes('\0') && s.trim().length > 0)

			const fileNodeArb = fc.record({
				kind: fc.constant('file' as const),
				name: validNameArb,
				path: validPathArb,
				depth: fc.integer({ min: 0, max: 5 }),
				parentPath: fc.option(validPathArb, { nil: undefined }),
				size: fc.option(fc.integer({ min: 0, max: 100000 }), {
					nil: undefined,
				}),
				lastModified: fc.option(fc.integer({ min: 0, max: Date.now() }), {
					nil: undefined,
				}),
			})

			const treeNodeArb = fc.record({
				kind: fc.constant('dir' as const),
				name: validNameArb,
				path: validPathArb,
				depth: fc.integer({ min: 0, max: 3 }),
				parentPath: fc.option(validPathArb, { nil: undefined }),
				children: fc.array(fileNodeArb, { maxLength: 5 }),
				isLoaded: fc.option(fc.boolean(), { nil: undefined }),
			})

			fc.assert(
				fc.property(treeNodeArb, (originalNode: FsDirTreeNode) => {
					const controller = new TreeCacheController({
						dbName: `test-serialization-${Math.random().toString(36).substring(7)}`,
					})

					const controllerAny = controller as unknown as TestTreeCacheController

					try {
						const cachedEntry =
							controllerAny.convertTreeNodeToCached(originalNode)
						const restoredNode =
							controllerAny.convertCachedToTreeNode(cachedEntry)

						expect(restoredNode.kind).toBe(originalNode.kind)
						expect(restoredNode.name).toBe(originalNode.name)
						expect(restoredNode.path).toBe(originalNode.path)
						expect(restoredNode.depth).toBe(originalNode.depth)
						expect(restoredNode.parentPath).toBe(originalNode.parentPath)
						expect(restoredNode.isLoaded).toBe(originalNode.isLoaded ?? false)

						expect(restoredNode.children).toHaveLength(
							originalNode.children.length
						)

						for (let i = 0; i < originalNode.children.length; i++) {
							const originalChild = originalNode.children[i]!
							const restoredChild = restoredNode.children[i]!

							expect(restoredChild.kind).toBe(originalChild.kind)
							expect(restoredChild.name).toBe(originalChild.name)
							expect(restoredChild.path).toBe(originalChild.path)
							expect(restoredChild.depth).toBe(originalChild.depth)
							expect(restoredChild.parentPath).toBe(originalChild.parentPath)

							if (originalChild.kind === 'file') {
								expect(restoredChild.kind).toBe('file')
								if (restoredChild.kind === 'file') {
									expect(restoredChild.size).toBe(originalChild.size)
									expect(restoredChild.lastModified).toBe(
										originalChild.lastModified
									)
								}
							}
						}

						expect(cachedEntry.cachedAt).toBeGreaterThan(0)
						expect(cachedEntry.version).toBe(1)
						expect(cachedEntry.children).toHaveLength(
							originalNode.children.length
						)
					} catch (error) {
						console.error('Serialization test failed for node:', originalNode)
						console.error('Error:', error)
						throw error
					}
				}),
				{ numRuns: 50 }
			)
		})
	})

	describe('Cache key schema', () => {
		it('should generate correct root cache keys', () => {
			expect(CACHE_KEY_SCHEMA.root('local')).toBe('v1:tree:root:local')
			expect(CACHE_KEY_SCHEMA.root('opfs')).toBe('v1:tree:root:opfs')
			expect(CACHE_KEY_SCHEMA.root('memory')).toBe('v1:tree:root:memory')
		})

		it('should generate correct directory cache keys', () => {
			expect(CACHE_KEY_SCHEMA.dir('/')).toBe('v1:tree:dir:/')
			expect(CACHE_KEY_SCHEMA.dir('/src')).toBe('v1:tree:dir:/src')
			expect(CACHE_KEY_SCHEMA.dir('/src/components')).toBe(
				'v1:tree:dir:/src/components'
			)
		})

		it('should generate correct metadata cache keys', () => {
			expect(CACHE_KEY_SCHEMA.meta('/')).toBe('v1:tree:meta:/')
			expect(CACHE_KEY_SCHEMA.meta('/src')).toBe('v1:tree:meta:/src')
			expect(CACHE_KEY_SCHEMA.meta('/src/components')).toBe(
				'v1:tree:meta:/src/components'
			)
		})
	})
})
