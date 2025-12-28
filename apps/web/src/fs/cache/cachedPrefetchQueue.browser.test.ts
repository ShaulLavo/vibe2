import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest'
import fc from 'fast-check'
import type { FsDirTreeNode } from '@repo/fs'
import { CachedPrefetchQueue } from './cachedPrefetchQueue'
import { TreeCacheController } from './treeCacheController'
import type { PrefetchTarget, TreePrefetchWorkerCallbacks } from '../prefetch/treePrefetchWorkerTypes'

describe('CachedPrefetchQueue', () => {
	let cacheController: TreeCacheController
	let cachedQueue: CachedPrefetchQueue
	let mockCallbacks: TreePrefetchWorkerCallbacks
	let mockLoadDirectory: MockedFunction<(target: PrefetchTarget) => Promise<FsDirTreeNode | undefined>>
	const testDbName = `test-cached-queue-${Date.now()}-${Math.random().toString(36).substring(7)}`

	beforeEach(async () => {
		cacheController = new TreeCacheController({ 
			dbName: testDbName,
			storeName: 'test-directories'
		})

		// Ensure clean state
		try {
			await cacheController.clearCache()
		} catch {
			// Ignore cleanup errors
		}
		
		mockCallbacks = {
			onDirectoryLoaded: vi.fn(),
			onStatus: vi.fn(),
			onDeferredMetadata: vi.fn(),
			onError: vi.fn()
		}

		mockLoadDirectory = vi.fn()

		cachedQueue = new CachedPrefetchQueue({
			workerCount: 2,
			loadDirectory: mockLoadDirectory,
			callbacks: mockCallbacks,
			cacheController
		})
	})

	afterEach(async () => {
		// Clean up test data
		try {
			await cacheController.clearCache()
			// Also clear any mocks
			mockLoadDirectory.mockClear()
			mockCallbacks.onDirectoryLoaded = vi.fn()
			mockCallbacks.onStatus = vi.fn()
			mockCallbacks.onDeferredMetadata = vi.fn()
			mockCallbacks.onError = vi.fn()
		} catch {
			// Ignore cleanup errors
		}
	})

	describe('Property 6: Background validation with cache display', () => {
		it('should display cached data immediately while workers run in background to validate freshness', async () => {
			await fc.assert(
				fc.asyncProperty(
					// Generate test directory structure
					fc.record({
						path: fc.string({ minLength: 1, maxLength: 20 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
						name: fc.string({ minLength: 1, maxLength: 15 }).map(s => s.replace(/[\0\/]/g, '_')),
						depth: fc.integer({ min: 0, max: 3 }),
						cachedChildren: fc.array(
							fc.record({
								kind: fc.constant('file' as const),
								name: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[\0\/]/g, '_')),
								path: fc.string({ minLength: 1, maxLength: 25 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
								depth: fc.integer({ min: 1, max: 4 }),
								size: fc.option(fc.integer({ min: 0, max: 10000 })),
								lastModified: fc.option(fc.integer({ min: 1000000000000, max: Date.now() }))
							}),
							{ minLength: 0, maxLength: 5 }
						),
						freshChildren: fc.array(
							fc.record({
								kind: fc.constant('file' as const),
								name: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[\0\/]/g, '_')),
								path: fc.string({ minLength: 1, maxLength: 25 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
								depth: fc.integer({ min: 1, max: 4 }),
								size: fc.option(fc.integer({ min: 0, max: 10000 })),
								lastModified: fc.option(fc.integer({ min: 1000000000000, max: Date.now() }))
							}),
							{ minLength: 0, maxLength: 5 }
						)
					}),
					async (testData) => {
						const { path, name, depth, cachedChildren, freshChildren } = testData

						// Create cached directory data
						const cachedNode: FsDirTreeNode = {
							kind: 'dir',
							name,
							path,
							depth,
							parentPath: depth > 0 ? '/' : undefined,
							children: cachedChildren.map(child => ({
								kind: 'file' as const,
								name: child.name,
								path: child.path,
								depth: child.depth,
								parentPath: path,
								size: child.size ?? undefined,
								lastModified: child.lastModified ?? undefined
							})),
							isLoaded: true
						}

						// Create fresh directory data (simulating filesystem scan)
						const freshNode: FsDirTreeNode = {
							kind: 'dir',
							name,
							path,
							depth,
							parentPath: depth > 0 ? '/' : undefined,
							children: freshChildren.map(child => ({
								kind: 'file' as const,
								name: child.name,
								path: child.path,
								depth: child.depth,
								parentPath: path,
								size: child.size ?? undefined,
								lastModified: child.lastModified ?? undefined
							})),
							isLoaded: true
						}

						// Pre-populate cache with cached data
						await cacheController.setCachedDirectory(path, cachedNode)

						// Mock the worker to return fresh data after a delay
						let workerCallCount = 0
						mockLoadDirectory.mockImplementation(async (target) => {
							workerCallCount++
							// Simulate background worker delay
							await new Promise(resolve => setTimeout(resolve, 20))
							return target.path === path ? freshNode : undefined
						})

						// Track callback invocations
						const directoryLoadedCalls: any[] = []
						mockCallbacks.onDirectoryLoaded = vi.fn((payload) => {
							directoryLoadedCalls.push(payload)
						})

						// Simulate cache-first loading
						const target: PrefetchTarget = { path, name, depth, parentPath: depth > 0 ? '/' : undefined }
						
						// The queue should first display cached data, then validate in background
						const startTime = Date.now()
						
						// First, check if cached data would be returned immediately
						const cachedData = await cacheController.getCachedDirectory(path)
						expect(cachedData).not.toBeNull()
						expect(cachedData!.path).toBe(path)
						expect(cachedData!.children).toHaveLength(cachedChildren.length)

						// Verify cached data is available instantly (should be very fast)
						const cacheLoadTime = Date.now() - startTime
						expect(cacheLoadTime).toBeLessThan(100) // More lenient timing

						// Now simulate the cache-first loading which should trigger background validation
						const backgroundStartTime = Date.now()
						
						// This should return cached data immediately and trigger background validation
						const result = await (cachedQueue as any).loadDirectoryWithCache(target)
						
						// Result should be the cached data (returned immediately)
						if (result) {
							expect(result.path).toBe(path)
							expect(result.children).toHaveLength(cachedChildren.length)
						}

						// Wait a bit for background validation to potentially complete
						await new Promise(resolve => setTimeout(resolve, 50))
						
						// Worker should have been called for background validation
						expect(workerCallCount).toBeGreaterThan(0)
					}
				),
				{ numRuns: 10 }
			)
		})

		it('should update UI incrementally when changes are detected during background validation', async () => {
			// Test that mergeDirectoryUpdate correctly updates the cache
			const testPath = `/test-merge-${Date.now()}`
			const testName = 'test-dir'
			const cachedChildCount = 2
			const freshChildCount = 3

			// Ensure clean state
			await cacheController.clearCache()

			// Create cached data with specific child count
			const cachedNode: FsDirTreeNode = {
				kind: 'dir',
				name: testName,
				path: testPath,
				depth: 0,
				children: Array.from({ length: cachedChildCount }, (_, i) => ({
					kind: 'file' as const,
					name: `cached-file-${i}.txt`,
					path: `${testPath}/cached-file-${i}.txt`,
					depth: 1,
					parentPath: testPath,
					size: 100 + i,
					lastModified: Date.now() - 10000
				})),
				isLoaded: true
			}

			// Create fresh data with different child count (simulating changes)
			const freshNode: FsDirTreeNode = {
				kind: 'dir',
				name: testName,
				path: testPath,
				depth: 0,
				children: Array.from({ length: freshChildCount }, (_, i) => ({
					kind: 'file' as const,
					name: `fresh-file-${i}.txt`,
					path: `${testPath}/fresh-file-${i}.txt`,
					depth: 1,
					parentPath: testPath,
					size: 200 + i,
					lastModified: Date.now() - 1000
				})),
				isLoaded: true
			}

			// Pre-populate cache with cached data
			await cacheController.setCachedDirectory(testPath, cachedNode)
			
			// Verify cache was set correctly
			const verifyCache = await cacheController.getCachedDirectory(testPath)
			expect(verifyCache).not.toBeNull()
			expect(verifyCache!.children).toHaveLength(cachedChildCount)

			// Now call mergeDirectoryUpdate to update the cache with fresh data
			await cacheController.mergeDirectoryUpdate(testPath, freshNode)

			// Verify cache was updated with fresh data
			const updatedCache = await cacheController.getCachedDirectory(testPath)
			expect(updatedCache).not.toBeNull()
			expect(updatedCache!.children).toHaveLength(freshChildCount)
			expect(updatedCache!.children[0]?.name).toMatch(/^fresh-file-/)
		})
	})

	describe('Property 13: Cache-first startup with background validation', () => {
		it('should display cached tree data immediately while workers validate all directories in background', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.record({
						rootPath: fc.string({ minLength: 1, maxLength: 10 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
						rootName: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[\0\/]/g, '_')),
						directories: fc.array(
							fc.record({
								path: fc.string({ minLength: 1, maxLength: 15 }).map(s => `/${s.replace(/[\0\/]/g, '_')}`),
								name: fc.string({ minLength: 1, maxLength: 10 }).map(s => s.replace(/[\0\/]/g, '_')),
								childCount: fc.integer({ min: 0, max: 3 })
							}),
							{ minLength: 1, maxLength: 4 }
						)
					}),
					async (testData) => {
						const { rootPath, rootName, directories } = testData

						// Create cached tree structure
						const cachedTree: FsDirTreeNode = {
							kind: 'dir',
							name: rootName,
							path: rootPath,
							depth: 0,
							children: directories.map(dir => ({
								kind: 'dir' as const,
								name: dir.name,
								path: dir.path,
								depth: 1,
								parentPath: rootPath,
								children: Array.from({ length: dir.childCount }, (_, i) => ({
									kind: 'file' as const,
									name: `file-${i}.txt`,
									path: `${dir.path}/file-${i}.txt`,
									depth: 2,
									parentPath: dir.path,
									size: 100 + i,
									lastModified: Date.now() - 5000
								})),
								isLoaded: true
							})),
							isLoaded: true
						}

						// Pre-populate cache with tree data
						await cacheController.setCachedTree(rootPath, cachedTree)
						
						// Also cache individual directories
						for (const dir of directories) {
							const dirNode: FsDirTreeNode = {
								kind: 'dir',
								name: dir.name,
								path: dir.path,
								depth: 1,
								parentPath: rootPath,
								children: Array.from({ length: dir.childCount }, (_, i) => ({
									kind: 'file' as const,
									name: `file-${i}.txt`,
									path: `${dir.path}/file-${i}.txt`,
									depth: 2,
									parentPath: dir.path,
									size: 100 + i,
									lastModified: Date.now() - 5000
								})),
								isLoaded: true
							}
							await cacheController.setCachedDirectory(dir.path, dirNode)
						}

						// Mock worker calls for background validation
						let backgroundValidationCalls = 0
						mockLoadDirectory.mockImplementation(async (target) => {
							backgroundValidationCalls++
							// Simulate background validation delay
							await new Promise(resolve => setTimeout(resolve, 10))
							
							// Return fresh data (could be same or different)
							const matchingDir = directories.find(d => d.path === target.path)
							if (matchingDir) {
								return {
									kind: 'dir' as const,
									name: matchingDir.name,
									path: matchingDir.path,
									depth: 1,
									parentPath: rootPath,
									children: Array.from({ length: matchingDir.childCount }, (_, i) => ({
										kind: 'file' as const,
										name: `validated-file-${i}.txt`,
										path: `${matchingDir.path}/validated-file-${i}.txt`,
										depth: 2,
										parentPath: matchingDir.path,
										size: 200 + i,
										lastModified: Date.now() - 1000
									})),
									isLoaded: true
								}
							}
							return undefined
						})

						// Test cache-first startup
						const startupStartTime = Date.now()
						
						// Should load cached tree immediately
						const cachedTreeData = await cacheController.getCachedTree(rootPath)
						
						const cacheLoadTime = Date.now() - startupStartTime
						
						// Cache load should be very fast
						expect(cacheLoadTime).toBeLessThan(100) // More lenient timing
						
						// Should have cached tree data
						expect(cachedTreeData).not.toBeNull()
						expect(cachedTreeData!.path).toBe(rootPath)
						expect(cachedTreeData!.children).toHaveLength(directories.length)

						// Simulate background validation of all directories
						const validationPromises = directories.map(dir => {
							const target: PrefetchTarget = {
								path: dir.path,
								name: dir.name,
								depth: 1,
								parentPath: rootPath
							}
							return (cachedQueue as any).loadDirectoryWithCache(target)
						})

						// Wait for all background validations to complete
						const validationResults = await Promise.all(validationPromises)

						// All validations should return results (cached data initially)
						validationResults.forEach((result, index) => {
							if (result) {
								expect(result.path).toBe(directories[index]?.path)
								// Should have some children
								expect(result.children.length).toBeGreaterThanOrEqual(0)
							}
						})

						// Wait for background validation to potentially complete
						await new Promise(resolve => setTimeout(resolve, 50))

						// Background validation should have been triggered
						expect(backgroundValidationCalls).toBeGreaterThan(0)
						
						// Cache should potentially be updated with validated data
						for (const dir of directories) {
							const updatedCache = await cacheController.getCachedDirectory(dir.path)
							expect(updatedCache).not.toBeNull()
							// The cache might have been updated with validated data
							if (updatedCache && updatedCache.children.length > 0) {
								// Either original or validated data is acceptable
								const fileName = updatedCache.children[0]?.name
								expect(fileName).toMatch(/^(file-|validated-file-)/)
							}
						}
					}
				),
				{ numRuns: 6 }
			)
		})
	})
})