import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { FsDirTreeNode } from '@repo/fs'
import { TreeCacheController } from './treeCacheController'
import { CachedPrefetchQueue } from './cachedPrefetchQueue'

// Helper type to access private methods for testing
interface TestTreeCacheController {
	convertTreeNodeToCached(node: FsDirTreeNode): any
	convertCachedToTreeNode(cached: any): FsDirTreeNode
}

describe('Data Format Compatibility Tests', () => {
	describe('Property 25: Data format compatibility', () => {
		it('should maintain the same FsDirTreeNode structure for cached and live data', () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping data format compatibility test - IndexedDB not available in test environment')
				return
			}

			const controller = new TreeCacheController({
				dbName: `test-format-compat-${Math.random().toString(36).substring(7)}`,
			})
			const controllerAny = controller as unknown as TestTreeCacheController

			// Test with a comprehensive directory structure
			const liveData: FsDirTreeNode = {
				kind: 'dir',
				name: 'test-project',
				path: '/test-project',
				depth: 0,
				children: [
					{
						kind: 'file',
						name: 'README.md',
						path: '/test-project/README.md',
						depth: 1,
						parentPath: '/test-project',
						size: 2048,
						lastModified: 1640995200000,
					},
					{
						kind: 'file',
						name: 'package.json',
						path: '/test-project/package.json',
						depth: 1,
						parentPath: '/test-project',
						size: 1024,
						lastModified: 1640995300000,
					},
					{
						kind: 'dir',
						name: 'src',
						path: '/test-project/src',
						depth: 1,
						parentPath: '/test-project',
						children: [
							{
								kind: 'file',
								name: 'index.ts',
								path: '/test-project/src/index.ts',
								depth: 2,
								parentPath: '/test-project/src',
								size: 512,
								lastModified: 1640995400000,
							},
						],
						isLoaded: true,
					},
					{
						kind: 'dir',
						name: 'tests',
						path: '/test-project/tests',
						depth: 1,
						parentPath: '/test-project',
						children: [],
						isLoaded: false,
					},
				],
				isLoaded: true,
			}

			// Convert to cached format and back
			const cachedEntry = controllerAny.convertTreeNodeToCached(liveData)
			const restoredData = controllerAny.convertCachedToTreeNode(cachedEntry)

			// Verify complete structural compatibility
			expect(restoredData.kind).toBe(liveData.kind)
			expect(restoredData.name).toBe(liveData.name)
			expect(restoredData.path).toBe(liveData.path)
			expect(restoredData.depth).toBe(liveData.depth)
			expect(restoredData.parentPath).toBe(liveData.parentPath)
			expect(restoredData.isLoaded).toBe(liveData.isLoaded)
			expect(restoredData.children).toHaveLength(liveData.children.length)

			// Verify file children maintain exact format
			const restoredReadme = restoredData.children.find(c => c.name === 'README.md')
			const originalReadme = liveData.children.find(c => c.name === 'README.md')
			expect(restoredReadme).toBeDefined()
			expect(originalReadme).toBeDefined()
			
			if (restoredReadme?.kind === 'file' && originalReadme?.kind === 'file') {
				expect(restoredReadme.size).toBe(originalReadme.size)
				expect(restoredReadme.lastModified).toBe(originalReadme.lastModified)
				expect(restoredReadme.path).toBe(originalReadme.path)
				expect(restoredReadme.parentPath).toBe(originalReadme.parentPath)
			}

			// Verify directory children maintain exact format
			const restoredSrc = restoredData.children.find(c => c.name === 'src')
			const originalSrc = liveData.children.find(c => c.name === 'src')
			expect(restoredSrc).toBeDefined()
			expect(originalSrc).toBeDefined()
			
			if (restoredSrc?.kind === 'dir' && originalSrc?.kind === 'dir') {
				expect(restoredSrc.isLoaded).toBe(originalSrc.isLoaded)
				expect(restoredSrc.children).toHaveLength(originalSrc.children.length)
				expect(restoredSrc.path).toBe(originalSrc.path)
				expect(restoredSrc.parentPath).toBe(originalSrc.parentPath)
			}

			// Verify unloaded directories maintain format
			const restoredTests = restoredData.children.find(c => c.name === 'tests')
			const originalTests = liveData.children.find(c => c.name === 'tests')
			expect(restoredTests).toBeDefined()
			expect(originalTests).toBeDefined()
			
			if (restoredTests?.kind === 'dir' && originalTests?.kind === 'dir') {
				expect(restoredTests.isLoaded).toBe(originalTests.isLoaded)
				expect(restoredTests.children).toEqual(originalTests.children)
			}
		})

		it('should handle property-based testing for data format compatibility', () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping data format compatibility property test - IndexedDB not available in test environment')
				return
			}

			const validNameArb = fc
				.string({ minLength: 1, maxLength: 20 })
				.filter((s) => !s.includes('/') && !s.includes('\0') && s.trim().length > 0)

			const validPathArb = fc
				.string({ minLength: 1, maxLength: 50 })
				.filter((s) => !s.includes('\0') && s.trim().length > 0)

			const fileNodeArb = fc.record({
				kind: fc.constant('file' as const),
				name: validNameArb,
				path: validPathArb,
				depth: fc.integer({ min: 0, max: 5 }),
				parentPath: fc.option(validPathArb, { nil: undefined }),
				size: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
				lastModified: fc.option(fc.integer({ min: 0, max: Date.now() }), { nil: undefined }),
			})

			const dirNodeArb = fc.record({
				kind: fc.constant('dir' as const),
				name: validNameArb,
				path: validPathArb,
				depth: fc.integer({ min: 0, max: 3 }),
				parentPath: fc.option(validPathArb, { nil: undefined }),
				children: fc.array(fileNodeArb, { maxLength: 5 }),
				isLoaded: fc.option(fc.boolean(), { nil: undefined }),
			})

			fc.assert(
				fc.property(dirNodeArb, (originalNode: FsDirTreeNode) => {
					const controller = new TreeCacheController({
						dbName: `test-format-prop-${Math.random().toString(36).substring(7)}`,
					})
					const controllerAny = controller as unknown as TestTreeCacheController

					try {
						// Convert to cached format and back
						const cachedEntry = controllerAny.convertTreeNodeToCached(originalNode)
						const restoredNode = controllerAny.convertCachedToTreeNode(cachedEntry)

						// Verify all core properties are preserved
						expect(restoredNode.kind).toBe(originalNode.kind)
						expect(restoredNode.name).toBe(originalNode.name)
						expect(restoredNode.path).toBe(originalNode.path)
						expect(restoredNode.depth).toBe(originalNode.depth)
						expect(restoredNode.parentPath).toBe(originalNode.parentPath)
						expect(restoredNode.isLoaded).toBe(originalNode.isLoaded ?? false)

						// Verify children array structure
						expect(Array.isArray(restoredNode.children)).toBe(true)
						expect(restoredNode.children).toHaveLength(originalNode.children.length)

						// Verify each child maintains format compatibility
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
									expect(restoredChild.lastModified).toBe(originalChild.lastModified)
									// Files should not have children or isLoaded properties
									expect('children' in restoredChild).toBe(false)
									expect('isLoaded' in restoredChild).toBe(false)
								}
							} else if (originalChild.kind === 'dir') {
								expect(restoredChild.kind).toBe('dir')
								if (restoredChild.kind === 'dir') {
									expect(restoredChild.isLoaded).toBe(originalChild.isLoaded ?? false)
									expect(Array.isArray(restoredChild.children)).toBe(true)
									// Directories should not have size or lastModified properties
									expect('size' in restoredChild).toBe(false)
									expect('lastModified' in restoredChild).toBe(false)
								}
							}
						}

						// Verify the structure can be used interchangeably with live data
						// This tests that cached data maintains the exact same TypeScript interface
						const testFunction = (node: FsDirTreeNode) => {
							return {
								hasChildren: node.children.length > 0,
								isDirectory: node.kind === 'dir',
								pathInfo: { path: node.path, name: node.name, depth: node.depth },
							}
						}

						const originalResult = testFunction(originalNode)
						const restoredResult = testFunction(restoredNode)

						expect(restoredResult).toEqual(originalResult)

					} catch (error) {
						console.error('Data format compatibility test failed for node:', originalNode)
						console.error('Error:', error)
						throw error
					}
				}),
				{ numRuns: 50 }
			)
		})

		it('should preserve optional properties correctly', () => {
			// Check if IndexedDB is available
			if (typeof indexedDB === 'undefined') {
				console.warn('Skipping optional properties test - IndexedDB not available in test environment')
				return
			}

			const controller = new TreeCacheController({
				dbName: `test-optional-props-${Math.random().toString(36).substring(7)}`,
			})
			const controllerAny = controller as unknown as TestTreeCacheController

			// Test with minimal node (only required properties)
			const minimalNode: FsDirTreeNode = {
				kind: 'dir',
				name: 'minimal',
				path: '/minimal',
				depth: 0,
				children: [],
			}

			const cachedMinimal = controllerAny.convertTreeNodeToCached(minimalNode)
			const restoredMinimal = controllerAny.convertCachedToTreeNode(cachedMinimal)

			expect(restoredMinimal.parentPath).toBeUndefined()
			expect(restoredMinimal.isLoaded).toBe(false) // Should default to false

			// Test with all optional properties present
			const fullNode: FsDirTreeNode = {
				kind: 'dir',
				name: 'full',
				path: '/full',
				depth: 1,
				parentPath: '/',
				children: [
					{
						kind: 'file',
						name: 'file-with-all-props.txt',
						path: '/full/file-with-all-props.txt',
						depth: 2,
						parentPath: '/full',
						size: 1024,
						lastModified: Date.now(),
					},
					{
						kind: 'file',
						name: 'file-minimal.txt',
						path: '/full/file-minimal.txt',
						depth: 2,
						parentPath: '/full',
						// size and lastModified are undefined
					},
				],
				isLoaded: true,
			}

			const cachedFull = controllerAny.convertTreeNodeToCached(fullNode)
			const restoredFull = controllerAny.convertCachedToTreeNode(cachedFull)

			expect(restoredFull.parentPath).toBe(fullNode.parentPath)
			expect(restoredFull.isLoaded).toBe(fullNode.isLoaded)

			// Check file with all properties
			const fullFile = restoredFull.children.find(c => c.name === 'file-with-all-props.txt')
			const originalFullFile = fullNode.children.find(c => c.name === 'file-with-all-props.txt')
			
			if (fullFile?.kind === 'file' && originalFullFile?.kind === 'file') {
				expect(fullFile.size).toBe(originalFullFile.size)
				expect(fullFile.lastModified).toBe(originalFullFile.lastModified)
			}

			// Check file with minimal properties
			const minimalFile = restoredFull.children.find(c => c.name === 'file-minimal.txt')
			const originalMinimalFile = fullNode.children.find(c => c.name === 'file-minimal.txt')
			
			if (minimalFile?.kind === 'file' && originalMinimalFile?.kind === 'file') {
				expect(minimalFile.size).toBe(originalMinimalFile.size) // Should be undefined
				expect(minimalFile.lastModified).toBe(originalMinimalFile.lastModified) // Should be undefined
			}
		})

		it('should maintain TypeScript type compatibility', () => {
			// This test ensures that cached data can be used anywhere FsDirTreeNode is expected
			const controller = new TreeCacheController({
				dbName: `test-type-compat-${Math.random().toString(36).substring(7)}`,
			})
			const controllerAny = controller as unknown as TestTreeCacheController

			const testNode: FsDirTreeNode = {
				kind: 'dir',
				name: 'type-test',
				path: '/type-test',
				depth: 0,
				children: [
					{
						kind: 'file',
						name: 'test.ts',
						path: '/type-test/test.ts',
						depth: 1,
						parentPath: '/type-test',
						size: 256,
						lastModified: Date.now(),
					},
				],
				isLoaded: true,
			}

			const cached = controllerAny.convertTreeNodeToCached(testNode)
			const restored = controllerAny.convertCachedToTreeNode(cached)

			// These should all compile and work without type errors
			const processNode = (node: FsDirTreeNode): string => {
				return `${node.kind}:${node.name}@${node.path}`
			}

			const processChildren = (children: FsDirTreeNode['children']): number => {
				return children.length
			}

			const processFile = (node: FsDirTreeNode) => {
				if (node.kind === 'dir') {
					// Find a file child to process
					const fileChild = node.children.find(child => child.kind === 'file')
					if (fileChild && fileChild.kind === 'file') {
						return { size: fileChild.size, lastModified: fileChild.lastModified }
					}
				}
				return null
			}

			const processDir = (node: FsDirTreeNode) => {
				if (node.kind === 'dir') {
					return { isLoaded: node.isLoaded, childCount: node.children.length }
				}
				return null
			}

			// All these operations should work identically with cached and original data
			expect(processNode(restored)).toBe(processNode(testNode))
			expect(processChildren(restored.children)).toBe(processChildren(testNode.children))
			
			const restoredFileInfo = processFile(restored)
			const originalFileInfo = processFile(testNode)
			expect(restoredFileInfo).toEqual(originalFileInfo)

			const restoredDirInfo = processDir(restored)
			const originalDirInfo = processDir(testNode)
			expect(restoredDirInfo).toEqual(originalDirInfo)
		})
	})
})

/**
 * **Feature: persistent-tree-cache, Property 25: Data format compatibility**
 * 
 * This test validates that cached directory data maintains the exact same structure
 * and format as live filesystem data. The FsDirTreeNode interface should be
 * preserved completely, allowing cached data to be used interchangeably with
 * live data throughout the application.
 */