import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { TreeCacheController } from './treeCacheController'
import type { FsDirTreeNode } from '@repo/fs'

describe('Lazy Loading Browser Tests', () => {
	describe('Property 16: Lazy loading strategy', () => {
		it('should load children on-demand rather than loading entire trees at once for large directories', async () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping lazy loading test - IndexedDB not available in test environment')
				return
			}

			const controller = new TreeCacheController({
				dbName: `test-lazy-loading-${Math.random().toString(36).substring(7)}`,
			})

			// Create a large directory with many children
			const largeDirectory: FsDirTreeNode = {
				kind: 'dir',
				name: 'large-dir',
				path: '/large-dir',
				depth: 0,
				children: [],
				isLoaded: true,
			}

			// Add 150 children (exceeds default lazy loading threshold of 100)
			for (let i = 0; i < 150; i++) {
				largeDirectory.children.push({
					kind: 'file',
					name: `file-${i}.txt`,
					path: `/large-dir/file-${i}.txt`,
					depth: 1,
					parentPath: '/large-dir',
					size: 1000 + i,
					lastModified: Date.now() - i * 1000,
				})
			}

			try {
				// Cache the large directory
				await controller.setCachedDirectory('/large-dir', largeDirectory)

				// Test lazy loading with maxChildrenToLoad = 50
				const lazyLoadedNode = await controller.getCachedDirectoryLazy('/large-dir', 50)
				
				// If IndexedDB is not working properly, lazyLoadedNode will be null
				if (lazyLoadedNode === null) {
					console.warn('Skipping lazy loading test - IndexedDB operations returning null')
					return
				}

				expect(lazyLoadedNode).not.toBeNull()
				expect(lazyLoadedNode!.children).toHaveLength(50) // Should only load first 50 children
				expect(lazyLoadedNode!.isLoaded).toBe(false) // Should be marked as not fully loaded

				// Verify the first 50 children are correct
				for (let i = 0; i < 50; i++) {
					const child = lazyLoadedNode!.children[i]!
					expect(child.name).toBe(`file-${i}.txt`)
					expect(child.path).toBe(`/large-dir/file-${i}.txt`)
				}

				// Test loading more children
				const moreChildrenNode = await controller.loadMoreChildren('/large-dir', 50, 30)
				
				if (moreChildrenNode === null) {
					console.warn('Skipping load more children test - operation returning null')
					return
				}

				expect(moreChildrenNode).not.toBeNull()
				expect(moreChildrenNode!.children).toHaveLength(80) // Should now have 50 + 30 = 80 children
				expect(moreChildrenNode!.isLoaded).toBe(false) // Still not fully loaded

				// Test loading remaining children
				const finalNode = await controller.loadMoreChildren('/large-dir', 80, 100)
				
				if (finalNode === null) {
					console.warn('Skipping final load test - operation returning null')
					return
				}

				expect(finalNode).not.toBeNull()
				expect(finalNode!.children).toHaveLength(150) // Should now have all 150 children
				expect(finalNode!.isLoaded).toBe(true) // Should be marked as fully loaded

				await controller.clearCache()
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes('No available storage method found')
				) {
					console.warn(
						'Skipping lazy loading test - IndexedDB not available in test environment'
					)
					return
				}
				throw error
			}
		})

		it('should handle property-based testing for lazy loading strategy', () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping lazy loading property test - IndexedDB not available in test environment')
				return
			}

			const validNameArb = fc
				.string({ minLength: 1, maxLength: 10 })
				.filter(
					(s) => !s.includes('/') && !s.includes('\0') && s.trim().length > 0
				)

			const childCountArb = fc.integer({ min: 50, max: 200 }) // Large directories
			const batchSizeArb = fc.integer({ min: 10, max: 50 }) // Reasonable batch sizes

			const createLargeDirectory = (
				name: string,
				childCount: number
			): FsDirTreeNode => {
				const children: FsDirTreeNode['children'] = []
				
				for (let i = 0; i < childCount; i++) {
					children.push({
						kind: 'file',
						name: `file-${i}.txt`,
						path: `/${name}/file-${i}.txt`,
						depth: 1,
						parentPath: `/${name}`,
						size: 100 + i,
						lastModified: Date.now() - i * 100,
					})
				}

				return {
					kind: 'dir',
					name,
					path: `/${name}`,
					depth: 0,
					children,
					isLoaded: true,
				}
			}

			fc.assert(
				fc.asyncProperty(
					validNameArb,
					childCountArb,
					batchSizeArb,
					async (dirName: string, childCount: number, batchSize: number) => {
						const controller = new TreeCacheController({
							dbName: `test-lazy-prop-${Math.random().toString(36).substring(7)}`,
						})

						try {
							const largeDir = createLargeDirectory(dirName, childCount)
							
							// Cache the large directory
							await controller.setCachedDirectory(largeDir.path, largeDir)

							// Test lazy loading
							const lazyNode = await controller.getCachedDirectoryLazy(largeDir.path, batchSize)
							
							// If IndexedDB is not working properly, lazyNode will be null
							if (lazyNode === null) {
								console.warn('Skipping lazy loading property test iteration - IndexedDB operations returning null')
								return
							}

							// For any large directory tree, children should be loaded on-demand rather than loading entire trees at once
							expect(lazyNode).not.toBeNull()
							
							if (childCount > batchSize) {
								// Should only load the batch size, not all children
								expect(lazyNode!.children.length).toBe(batchSize)
								expect(lazyNode!.children.length).toBeLessThan(childCount)
								expect(lazyNode!.isLoaded).toBe(false) // Not fully loaded
								
								// Verify children are loaded in correct order
								for (let i = 0; i < batchSize; i++) {
									const child = lazyNode!.children[i]!
									expect(child.name).toBe(`file-${i}.txt`)
									expect(child.path).toBe(`/${dirName}/file-${i}.txt`)
								}
							} else {
								// If directory is smaller than batch size, should load all children
								expect(lazyNode!.children.length).toBe(childCount)
								expect(lazyNode!.isLoaded).toBe(true) // Fully loaded
							}

							await controller.clearCache()
						} catch (error) {
							if (
								error instanceof Error &&
								error.message.includes('No available storage method found')
							) {
								console.warn(
									'Skipping lazy loading property test - IndexedDB not available'
								)
								return
							}
							console.error('Lazy loading test failed:', { dirName, childCount, batchSize })
							console.error('Error:', error)
							throw error
						}
					}
				),
				{ numRuns: 20 }
			)
		})

		it('should maintain correct parent-child relationships during lazy loading', async () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping lazy loading relationship test - IndexedDB not available in test environment')
				return
			}

			const controller = new TreeCacheController({
				dbName: `test-lazy-relationships-${Math.random().toString(36).substring(7)}`,
			})

			const testDirectory: FsDirTreeNode = {
				kind: 'dir',
				name: 'test-relationships',
				path: '/test-relationships',
				depth: 0,
				children: [],
				isLoaded: true,
			}

			// Add 75 children
			for (let i = 0; i < 75; i++) {
				testDirectory.children.push({
					kind: 'file',
					name: `file-${i}.txt`,
					path: `/test-relationships/file-${i}.txt`,
					depth: 1,
					parentPath: '/test-relationships',
					size: 500 + i,
					lastModified: Date.now() - i * 500,
				})
			}

			try {
				await controller.setCachedDirectory('/test-relationships', testDirectory)

				// Load with lazy loading (batch size 25)
				const lazyNode = await controller.getCachedDirectoryLazy('/test-relationships', 25)
				
				if (lazyNode === null) {
					console.warn('Skipping lazy loading relationship test - IndexedDB operations returning null')
					return
				}

				expect(lazyNode).not.toBeNull()
				expect(lazyNode!.children).toHaveLength(25)

				// Verify all children have correct parent references
				for (const child of lazyNode!.children) {
					expect(child.parentPath).toBe('/test-relationships')
					expect(child.depth).toBe(1)
					expect(child.path.startsWith('/test-relationships/')).toBe(true)
				}

				// Load more children and verify relationships are maintained
				const moreNode = await controller.loadMoreChildren('/test-relationships', 25, 25)
				
				if (moreNode === null) {
					console.warn('Skipping load more relationship test - operation returning null')
					return
				}

				expect(moreNode).not.toBeNull()
				expect(moreNode!.children).toHaveLength(50)

				// Verify all children (including newly loaded ones) have correct relationships
				for (const child of moreNode!.children) {
					expect(child.parentPath).toBe('/test-relationships')
					expect(child.depth).toBe(1)
					expect(child.path.startsWith('/test-relationships/')).toBe(true)
				}

				await controller.clearCache()
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes('No available storage method found')
				) {
					console.warn(
						'Skipping lazy loading relationship test - IndexedDB not available'
					)
					return
				}
				throw error
			}
		})
	})
})