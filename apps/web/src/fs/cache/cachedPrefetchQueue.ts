import type { FsDirTreeNode } from '@repo/fs'
import { PrefetchQueue } from '../prefetch/prefetchQueue'
import type {
	PrefetchTarget,
	TreePrefetchWorkerCallbacks,
} from '../prefetch/treePrefetchWorkerTypes'
import { TreeCacheController } from './treeCacheController'

export interface CachedPrefetchQueueOptions {
	workerCount: number
	loadDirectory: (target: PrefetchTarget) => Promise<FsDirTreeNode | undefined>
	callbacks: TreePrefetchWorkerCallbacks
	cacheController?: TreeCacheController
}

export class CachedPrefetchQueue extends PrefetchQueue {
	private readonly cacheController: TreeCacheController
	private readonly originalLoadDirectory: (
		target: PrefetchTarget
	) => Promise<FsDirTreeNode | undefined>
	private readonly callbacks: TreePrefetchWorkerCallbacks

	constructor(options: CachedPrefetchQueueOptions) {
		const originalLoader = options.loadDirectory

		super({
			workerCount: options.workerCount,
			loadDirectory: (target) => this.loadDirectoryWithCache(target),
			callbacks: options.callbacks,
		})

		this.originalLoadDirectory = originalLoader
		this.callbacks = options.callbacks

		// Initialize cache controller with error handling
		try {
			this.cacheController =
				options.cacheController ?? new TreeCacheController()
		} catch (_error) {
			// Create a fallback cache controller that always returns null/does nothing
			this.cacheController = this.createFallbackCacheController()
		}
	}

	/**
	 * Create a fallback cache controller that does nothing when cache initialization fails
	 */
	private createFallbackCacheController(): TreeCacheController {
		return {
			getCachedTree: async () => null,
			setCachedTree: async () => {},
			getCachedDirectory: async () => null,
			setCachedDirectory: async () => {},
			invalidateDirectory: async () => {},
			invalidateSubtree: async () => {},
			clearCache: async () => {},
			isDirectoryFresh: async () => false,
			markDirectoryStale: async () => {},
			validateAndCleanupStaleEntries: async () => {},
			cleanupOldEntries: async () => {},
			batchSetDirectories: async () => {},
			getCacheStats: async () => ({
				totalEntries: 0,
				totalSizeBytes: 0,
				hitRate: 0,
				missRate: 0,
				averageLoadTime: 0,
				cacheValidationTime: 0,
				indexedDBSize: 0,
				oldestEntry: 0,
				newestEntry: 0,
				batchWrites: 0,
				averageBatchWriteTime: 0,
			}),
			performIncrementalUpdate: async () => {},
			mergeDirectoryUpdate: async () => {},
			getDirectoriesNeedingUpdate: async () => [],
			performBatchIncrementalUpdate: async () => {},
			evictLRUEntries: async () => {},
			handleCorruptedData: async () => {},
			updateAccessTime: async (_path: string, _cachedAt: number) => {},
			// New methods for task 11
			getCachedDirectoryLazy: async () => null,
			loadMoreChildren: async () => null,
			clearCacheWithProgress: async () => {},
			invalidateSubtreeWithProgress: async () => {},
			getCacheSize: async () => ({
				totalEntries: 0,
				estimatedSizeBytes: 0,
				oldestEntry: 0,
				newestEntry: 0,
			}),
			validateCacheIntegrity: async () => ({
				validEntries: 0,
				corruptedEntries: 0,
				repairedEntries: 0,
				issues: [],
			}),
			compactCache: async () => ({
				removedEntries: 0,
				spaceSaved: 0,
			}),
		} as any
	}

	async seedTree(tree?: FsDirTreeNode) {
		if (!tree) return

		// Cache-first startup: load cached tree immediately for instant display
		const cachedTree = await this.cacheController.getCachedTree(tree.path)
		if (cachedTree) {
			// Display cached tree immediately WITHOUT triggering prefetch processing
			// This prevents re-indexing and shows the cached data instantly
			this.callbacks.onDirectoryLoaded({
				node: cachedTree,
			})

			// Start background validation of all cached directories
			this.validateTreeInBackground(tree).catch(() => {
				// Background tree validation failed
			})
		} else {
			super.seedTree(tree)
		}

		// Always cache the provided tree data
		await this.cacheController.setCachedTree(tree.path, tree)
	}

	private async validateTreeInBackground(tree: FsDirTreeNode): Promise<void> {
		try {
			// Validate all directories in the tree structure
			const validationPromises: Promise<void>[] = []

			const validateDirectory = async (node: FsDirTreeNode) => {
				// Skip if not a directory or not loaded
				if (node.kind !== 'dir' || !node.isLoaded) {
					return
				}

				const target: PrefetchTarget = {
					path: node.path,
					name: node.name,
					depth: node.depth,
					parentPath: node.parentPath,
				}

				// Get cached data for comparison
				const cachedNode = await this.cacheController.getCachedDirectory(
					node.path
				)
				if (cachedNode) {
					await this.validateInBackground(target, cachedNode)
				}

				// Recursively validate child directories
				for (const child of node.children) {
					if (child.kind === 'dir' && child.isLoaded) {
						validationPromises.push(validateDirectory(child))
					}
				}
			}

			await validateDirectory(tree)
			await Promise.all(validationPromises)
		} catch (_error) {
			// Background tree validation error
		}
	}

	private async loadDirectoryWithCache(
		target: PrefetchTarget
	): Promise<FsDirTreeNode | undefined> {
		try {
			// First, try to get cached data for immediate display
			let cachedNode: FsDirTreeNode | null = null

			try {
				cachedNode = await this.cacheController.getCachedDirectory(target.path)
			} catch (_error) {
				// Continue with filesystem fallback - don't throw
			}

			if (cachedNode) {
				// Trigger background validation (don't await) - use setTimeout to ensure it runs asynchronously
				setTimeout(() => {
					this.validateInBackground(target, cachedNode!).catch(() => {
						// Background validation failed
					})
				}, 0)

				// Return the cached data immediately (already converted by getCachedDirectory)
				return cachedNode
			}

			// No cached data available, perform fresh load
			const freshNode = await this.originalLoadDirectory(target)

			if (!freshNode) {
				return undefined
			}

			// Try to cache the fresh data, but don't fail if caching fails
			try {
				await this.cacheController.performIncrementalUpdate(
					target.path,
					freshNode
				)
			} catch (_error) {
				// Continue without caching - don't throw
			}

			return freshNode
		} catch (_error) {
			// Final fallback - try direct filesystem load without any caching
			try {
				return await this.originalLoadDirectory(target)
			} catch (fallbackError) {
				throw fallbackError
			}
		}
	}

	private async validateInBackground(
		target: PrefetchTarget,
		cachedNode: FsDirTreeNode
	): Promise<void> {
		try {
			// Perform fresh filesystem scan in background
			const freshNode = await this.originalLoadDirectory(target)

			if (!freshNode) {
				return
			}

			// Check if data has changed
			const hasChanged = this.hasDataChanged(cachedNode, freshNode)

			if (hasChanged) {
				// Update cache with fresh data using incremental update
				await this.cacheController.mergeDirectoryUpdate(target.path, freshNode)

				// Notify UI of changes through callbacks
				this.callbacks.onDirectoryLoaded({
					node: freshNode,
				})
			}
		} catch (_error) {
			// Background validation error
		}
	}

	private hasDataChanged(
		cachedNode: FsDirTreeNode,
		freshNode: FsDirTreeNode
	): boolean {
		// Simple change detection based on children count and names
		const cachedChildren = cachedNode.children || []
		const freshChildren = freshNode.children || []

		if (cachedChildren.length !== freshChildren.length) {
			return true
		}

		// Check if child names have changed
		const cachedNames = new Set(cachedChildren.map((child) => child.name))
		const freshNames = new Set(freshChildren.map((child) => child.name))

		for (const name of freshNames) {
			if (!cachedNames.has(name)) {
				return true
			}
		}

		for (const name of cachedNames) {
			if (!freshNames.has(name)) {
				return true
			}
		}

		return false
	}

	/**
	 * Perform selective incremental update for changed directories only
	 * Preserves cached data for unchanged directories
	 */
	async performIncrementalUpdate(
		changedPaths: string[],
		directoryMtimes?: Map<string, number>
	): Promise<void> {
		const updatePromises = changedPaths.map(async (path) => {
			// Create target for the changed directory
			const pathSegments = path.split('/').filter(Boolean)
			const name = pathSegments[pathSegments.length - 1] || 'root'
			const depth = pathSegments.length
			const parentPath =
				depth > 0 ? '/' + pathSegments.slice(0, -1).join('/') : undefined

			const target: PrefetchTarget = {
				path,
				name,
				depth,
				parentPath: parentPath === '/' ? undefined : parentPath,
			}

			// Load fresh data for this directory only
			const freshNode = await this.originalLoadDirectory(target)
			if (freshNode) {
				const directoryMtime = directoryMtimes?.get(path)
				await this.cacheController.performIncrementalUpdate(
					path,
					freshNode,
					directoryMtime
				)

				// Notify UI of the update
				this.callbacks.onDirectoryLoaded({
					node: freshNode,
				})
			}
		})

		await Promise.all(updatePromises)
	}

	/**
	 * Detect which directories need incremental updates based on modification times
	 */
	async detectDirectoriesNeedingUpdate(
		directoryMtimes: Map<string, number>
	): Promise<string[]> {
		try {
			return await this.cacheController.getDirectoriesNeedingUpdate(
				directoryMtimes
			)
		} catch (_error) {
			return []
		}
	}

	/**
	 * Enhanced cache-first loading with incremental update support
	 */
	async loadWithIncrementalUpdate(
		rootPath: string,
		directoryMtimes?: Map<string, number>
	): Promise<void> {
		// First, load cached tree for immediate display
		const cachedTree = await this.cacheController.getCachedTree(rootPath)
		if (cachedTree) {
			// Display cached tree immediately
			this.callbacks.onDirectoryLoaded({
				node: cachedTree,
			})
		}

		// Detect which directories need updates
		if (directoryMtimes) {
			const directoriesNeedingUpdate =
				await this.detectDirectoriesNeedingUpdate(directoryMtimes)

			if (directoriesNeedingUpdate.length > 0) {
				// Perform incremental updates only for changed directories
				await this.performIncrementalUpdate(
					directoriesNeedingUpdate,
					directoryMtimes
				)
			}
		}
	}

	/**
	 * Load directory with lazy loading support for large directories
	 */
	async loadDirectoryLazy(
		target: PrefetchTarget,
		maxChildrenToLoad: number = 100,
		onProgress?: (progress: {
			completed: number
			total: number
			currentOperation: string
		}) => void
	): Promise<FsDirTreeNode | undefined> {
		try {
			onProgress?.({
				completed: 0,
				total: 3,
				currentOperation: 'Checking cache...',
			})

			// First, try to get cached data with lazy loading
			let cachedNode: FsDirTreeNode | null = null

			try {
				cachedNode = await this.cacheController.getCachedDirectoryLazy(
					target.path,
					maxChildrenToLoad
				)
			} catch (_error) {
				// Fall back to filesystem
			}

			if (cachedNode) {
				onProgress?.({
					completed: 1,
					total: 3,
					currentOperation: 'Displaying cached data...',
				})

				// Trigger background validation (don't await)
				setTimeout(() => {
					this.validateInBackground(target, cachedNode!).catch(() => {
						// Background validation failed
					})
				}, 0)

				onProgress?.({
					completed: 3,
					total: 3,
					currentOperation: 'Lazy loading complete',
				})
				return cachedNode
			}

			onProgress?.({
				completed: 1,
				total: 3,
				currentOperation: 'Loading from filesystem...',
			})

			// No cached data available, perform fresh load
			const freshNode = await this.originalLoadDirectory(target)

			if (!freshNode) {
				return undefined
			}

			onProgress?.({
				completed: 2,
				total: 3,
				currentOperation: 'Caching fresh data...',
			})

			// Try to cache the fresh data, but don't fail if caching fails
			try {
				await this.cacheController.performIncrementalUpdate(
					target.path,
					freshNode
				)
			} catch (_error) {
				// Continue without caching - don't throw
			}

			onProgress?.({
				completed: 3,
				total: 3,
				currentOperation: 'Loading complete',
			})
			return freshNode
		} catch (_error) {
			// Final fallback - try direct filesystem load without any caching
			try {
				return await this.originalLoadDirectory(target)
			} catch (fallbackError) {
				throw fallbackError
			}
		}
	}

	/**
	 * Load more children for a lazily loaded directory
	 */
	async loadMoreChildren(
		path: string,
		currentChildrenCount: number,
		batchSize: number = 100,
		onProgress?: (progress: {
			completed: number
			total: number
			currentOperation: string
		}) => void
	): Promise<FsDirTreeNode | null> {
		try {
			onProgress?.({
				completed: 0,
				total: 2,
				currentOperation: 'Loading more children...',
			})

			const updatedNode = await this.cacheController.loadMoreChildren(
				path,
				currentChildrenCount,
				batchSize
			)

			if (updatedNode) {
				onProgress?.({
					completed: 1,
					total: 2,
					currentOperation: 'Updating UI...',
				})

				// Notify UI of the update
				this.callbacks.onDirectoryLoaded({
					node: updatedNode,
				})
			}

			onProgress?.({
				completed: 2,
				total: 2,
				currentOperation: 'Load more complete',
			})
			return updatedNode
		} catch (_error) {
			return null
		}
	}

	/**
	 * Perform cache management operations with progress tracking
	 */
	async performCacheManagement(
		operation: 'clear' | 'cleanup' | 'validate' | 'compact',
		options?: {
			maxAgeMs?: number
			onProgress?: (progress: {
				completed: number
				total: number
				currentOperation: string
				issues?: string[]
			}) => void
		}
	): Promise<any> {
		const { maxAgeMs = 7 * 24 * 60 * 60 * 1000, onProgress } = options || {}

		switch (operation) {
			case 'clear':
				await this.cacheController.clearCacheWithProgress(onProgress)
				return { success: true, message: 'Cache cleared successfully' }

			case 'cleanup':
				await this.cacheController.cleanupOldEntries(maxAgeMs, onProgress)
				return { success: true, message: 'Cache cleanup completed' }

			case 'validate':
				const validationResult =
					await this.cacheController.validateCacheIntegrity(onProgress)
				return validationResult

			case 'compact':
				const compactionResult =
					await this.cacheController.compactCache(onProgress)
				return compactionResult

			default:
				throw new Error(`Unknown cache management operation: ${operation}`)
		}
	}

	/**
	 * Get detailed cache information including size and performance metrics
	 */
	async getCacheInfo(): Promise<{
		stats: any
		size: {
			totalEntries: number
			estimatedSizeBytes: number
			oldestEntry: number
			newestEntry: number
		}
	}> {
		const [stats, size] = await Promise.all([
			this.cacheController.getCacheStats(),
			this.cacheController.getCacheSize(),
		])

		return { stats, size }
	}

	private async populateCacheFromScan(
		path: string,
		node: FsDirTreeNode
	): Promise<void> {
		try {
			await this.cacheController.setCachedDirectory(path, node)
		} catch (_error) {
			// Failed to populate cache from scan
		}
	}

	async clearCache(): Promise<void> {
		await this.cacheController.clearCache()
	}

	async getCacheStats() {
		return await this.cacheController.getCacheStats()
	}
}
