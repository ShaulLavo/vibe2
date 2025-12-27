import type { FsDirTreeNode } from '@repo/fs'
import { logger } from '~/logger'
import { PrefetchQueue } from '../prefetch/prefetchQueue'
import type {
	PrefetchTarget,
	TreePrefetchWorkerCallbacks,
} from '../prefetch/treePrefetchWorkerTypes'
import { TreeCacheController } from './treeCacheController'

const cacheLogger = logger.withTag('cached-prefetch')

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

	constructor(options: CachedPrefetchQueueOptions) {
		const originalLoader = options.loadDirectory

		super({
			workerCount: options.workerCount,
			loadDirectory: (target) => this.loadDirectoryWithCache(target),
			callbacks: options.callbacks,
		})

		this.originalLoadDirectory = originalLoader
		this.cacheController = options.cacheController ?? new TreeCacheController()
		cacheLogger.debug('CachedPrefetchQueue initialized')
	}

	async seedTree(tree?: FsDirTreeNode) {
		if (!tree) return

		const cachedTree = await this.cacheController.getCachedTree(tree.path)
		if (cachedTree) {
			cacheLogger.debug('Loading tree from cache for instant display', {
				path: tree.path,
			})

			super.seedTree(cachedTree)

			await this.cacheController.setCachedTree(tree.path, tree)
		} else {
			cacheLogger.debug(
				'No cached tree available, proceeding with normal loading',
				{ path: tree.path }
			)
			super.seedTree(tree)

			await this.cacheController.setCachedTree(tree.path, tree)
		}
	}

	private async loadDirectoryWithCache(
		target: PrefetchTarget
	): Promise<FsDirTreeNode | undefined> {
		const startTime = performance.now()

		try {
			const shouldSkip = await this.shouldSkipCachedTarget(target)
			if (shouldSkip) {
				cacheLogger.debug('Skipping cached target', { path: target.path })
				return undefined
			}

			const freshNode = await this.originalLoadDirectory(target)

			if (!freshNode) {
				return undefined
			}

			await this.populateCacheFromScan(target.path, freshNode)

			const loadTime = performance.now() - startTime
			cacheLogger.debug('Loaded and cached directory', {
				path: target.path,
				childrenCount: freshNode.children.length,
				loadTime,
			})

			return freshNode
		} catch (error) {
			cacheLogger.warn('Failed to load directory with cache', {
				path: target.path,
				error,
			})
			throw error
		}
	}

	private async shouldSkipCachedTarget(
		target: PrefetchTarget
	): Promise<boolean> {
		if (!target.path) return false

		try {
			const cachedNode = await this.cacheController.getCachedDirectory(
				target.path
			)
			if (!cachedNode) {
				return false
			}

			// TODO: Implement modification time checking when directory handles provide mtime
			const isFresh = await this.cacheController.isDirectoryFresh(target.path)

			if (isFresh) {
				cacheLogger.debug('Using fresh cached data, skipping load', {
					path: target.path,
				})
				return true
			}

			return false
		} catch (error) {
			cacheLogger.warn('Error checking cache freshness, proceeding with load', {
				path: target.path,
				error,
			})
			return false
		}
	}

	private async populateCacheFromScan(
		path: string,
		node: FsDirTreeNode
	): Promise<void> {
		try {
			await this.cacheController.setCachedDirectory(path, node)
			cacheLogger.debug('Populated cache from scan', {
				path,
				childrenCount: node.children.length,
			})
		} catch (error) {
			cacheLogger.warn('Failed to populate cache from scan', { path, error })
		}
	}

	private async validateCacheEntry(
		path: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		entry: FsDirTreeNode
	): Promise<boolean> {
		try {
			// TODO: Implement proper validation using directory modification times
			return true
		} catch (error) {
			cacheLogger.warn('Failed to validate cache entry', { path, error })
			return false
		}
	}

	async clearCache(): Promise<void> {
		await this.cacheController.clearCache()
		cacheLogger.info('Cleared cache data')
	}

	async getCacheStats() {
		return await this.cacheController.getCacheStats()
	}
}
