import localforage from 'localforage'
import type { FsDirTreeNode } from '@repo/fs'
import { logger } from '../../logger'

const cacheLogger = logger.withTag('tree-cache')

export const CACHE_KEY_SCHEMA = {
	root: (source: string) => `v1:tree:root:${source}`,
	dir: (path: string) => `v1:tree:dir:${path}`,
	meta: (path: string) => `v1:tree:meta:${path}`,
} as const

export interface CachedChildEntry {
	kind: 'file' | 'dir'
	name: string
	path: string
	depth: number
	parentPath?: string
	size?: number
	lastModified?: number
	isLoaded?: boolean
}

export interface CachedDirectoryEntry {
	path: string
	name: string
	depth: number
	parentPath?: string
	cachedAt: number
	lastModified?: number
	version: number
	children: CachedChildEntry[]
	isLoaded: boolean
	checksum?: string
}

/**
 * Statistics and metrics for cache performance monitoring
 */
export interface TreeCacheStats {
	totalEntries: number
	totalSizeBytes: number
	hitRate: number
	missRate: number
	averageLoadTime: number
	cacheValidationTime: number
	indexedDBSize: number
	oldestEntry: number
	newestEntry: number
	batchWrites: number
	averageBatchWriteTime: number
}

export class TreeCacheController {
	private readonly store: LocalForage
	private readonly metadataStore: LocalForage
	private readonly version = 1
	
	private stats = {
		hits: 0,
		misses: 0,
		totalLoadTime: 0,
		validationTime: 0,
		batchWrites: 0,
		batchWriteTime: 0,
	}

	constructor(options: { dbName?: string; storeName?: string } = {}) {
		const dbName = options.dbName ?? 'tree-cache'
		const storeName = options.storeName ?? 'directories'
		
		this.store = localforage.createInstance({
			name: dbName,
			storeName: storeName,
			driver: [localforage.INDEXEDDB]
		})
		
		this.metadataStore = localforage.createInstance({
			name: dbName,
			storeName: `${storeName}_metadata`,
			driver: [localforage.INDEXEDDB]
		})
		
		cacheLogger.debug('TreeCacheController initialized', { dbName, storeName })
	}

	async getCachedTree(rootPath: string): Promise<FsDirTreeNode | null> {
		const startTime = performance.now()
		
		try {
			const key = CACHE_KEY_SCHEMA.root(rootPath)
			const cached = await this.store.getItem<CachedDirectoryEntry>(key)
			
			if (!cached) {
				this.stats.misses++
				return null
			}
			
			this.stats.hits++
			const loadTime = performance.now() - startTime
			this.stats.totalLoadTime += loadTime
			
			cacheLogger.debug('Cache hit for root tree', { rootPath, loadTime })
			return this.convertCachedToTreeNode(cached)
		} catch (error) {
			this.stats.misses++
			cacheLogger.warn('Failed to get cached tree', { rootPath, error })
			return null
		}
	}

	async setCachedTree(rootPath: string, tree: FsDirTreeNode): Promise<void> {
		try {
			const key = CACHE_KEY_SCHEMA.root(rootPath)
			const cached = this.convertTreeNodeToCached(tree)
			
			await this.store.setItem(key, cached)
			cacheLogger.debug('Cached root tree', { rootPath, childrenCount: cached.children.length })
		} catch (error) {
			cacheLogger.warn('Failed to cache tree', { rootPath, error })
			throw error
		}
	}

	async getCachedDirectory(path: string): Promise<FsDirTreeNode | null> {
		const startTime = performance.now()
		
		try {
			const key = CACHE_KEY_SCHEMA.dir(path)
			const cached = await this.store.getItem<CachedDirectoryEntry>(key)
			
			if (!cached) {
				this.stats.misses++
				return null
			}
			
			this.stats.hits++
			const loadTime = performance.now() - startTime
			this.stats.totalLoadTime += loadTime
			
			cacheLogger.debug('Cache hit for directory', { path, loadTime })
			return this.convertCachedToTreeNode(cached)
		} catch (error) {
			this.stats.misses++
			cacheLogger.warn('Failed to get cached directory', { path, error })
			return null
		}
	}

	async setCachedDirectory(path: string, node: FsDirTreeNode): Promise<void> {
		try {
			const key = CACHE_KEY_SCHEMA.dir(path)
			const cached = this.convertTreeNodeToCached(node)
			
			await this.store.setItem(key, cached)
			cacheLogger.debug('Cached directory', { path, childrenCount: cached.children.length })
		} catch (error) {
			cacheLogger.warn('Failed to cache directory', { path, error })
			throw error
		}
	}

	async invalidateDirectory(path: string): Promise<void> {
		try {
			const key = CACHE_KEY_SCHEMA.dir(path)
			await this.store.removeItem(key)
			cacheLogger.debug('Invalidated directory cache', { path })
		} catch (error) {
			cacheLogger.warn('Failed to invalidate directory', { path, error })
		}
	}

	async invalidateSubtree(path: string): Promise<void> {
		try {
			const keys = await this.store.keys()
			const keysToRemove = keys.filter(key => {
				if (typeof key !== 'string') return false
				
				if (key.startsWith('v1:tree:dir:')) {
					const keyPath = key.substring('v1:tree:dir:'.length)
					return keyPath === path || keyPath.startsWith(path + '/')
				}
				
				return false
			})
			
			await Promise.all(keysToRemove.map(key => this.store.removeItem(key)))
			cacheLogger.debug('Invalidated subtree cache', { path, removedCount: keysToRemove.length })
		} catch (error) {
			cacheLogger.warn('Failed to invalidate subtree', { path, error })
		}
	}

	async clearCache(): Promise<void> {
		try {
			await this.store.clear()
			await this.metadataStore.clear()
			
			this.stats = {
				hits: 0,
				misses: 0,
				totalLoadTime: 0,
				validationTime: 0,
				batchWrites: 0,
				batchWriteTime: 0,
			}
			
			cacheLogger.info('Cleared all cache data')
		} catch (error) {
			cacheLogger.warn('Failed to clear cache', { error })
		}
	}

	async isDirectoryFresh(path: string, currentMtime?: number): Promise<boolean> {
		const startTime = performance.now()
		
		try {
			const key = CACHE_KEY_SCHEMA.dir(path)
			const cached = await this.store.getItem<CachedDirectoryEntry>(key)
			
			if (!cached) {
				return false
			}
			
			if (currentMtime === undefined) {
				return true
			}
			
			const isFresh = cached.lastModified !== undefined && cached.lastModified >= currentMtime
			
			const validationTime = performance.now() - startTime
			this.stats.validationTime += validationTime
			
			cacheLogger.debug('Directory freshness check', { 
				path, 
				isFresh, 
				cachedMtime: cached.lastModified, 
				currentMtime,
				validationTime 
			})
			
			return isFresh
		} catch (error) {
			cacheLogger.warn('Failed to check directory freshness', { path, error })
			return false
		}
	}

	async markDirectoryStale(path: string): Promise<void> {
		await this.invalidateDirectory(path)
	}

	async batchSetDirectories(entries: Map<string, FsDirTreeNode>): Promise<void> {
		const startTime = performance.now()
		
		try {
			const promises: Promise<void>[] = []
			
			for (const [path, node] of entries) {
				const key = CACHE_KEY_SCHEMA.dir(path)
				const cached = this.convertTreeNodeToCached(node)
				promises.push(this.store.setItem(key, cached).then(() => {}))
			}
			
			await Promise.all(promises)
			
			const batchTime = performance.now() - startTime
			this.stats.batchWrites++
			this.stats.batchWriteTime += batchTime
			
			cacheLogger.debug('Batch cached directories', { 
				count: entries.size, 
				batchTime 
			})
		} catch (error) {
			cacheLogger.warn('Failed to batch cache directories', { 
				count: entries.size, 
				error 
			})
			throw error
		}
	}

	async getCacheStats(): Promise<TreeCacheStats> {
		try {
			const keys = await this.store.keys()
			const totalEntries = keys.length
			
			const sampleSize = Math.min(10, totalEntries)
			let estimatedSize = 0
			
			if (sampleSize > 0) {
				const sampleKeys = keys.slice(0, sampleSize)
				let sampleTotalSize = 0
				
				for (const key of sampleKeys) {
					const item = await this.store.getItem(key)
					if (item) {
						sampleTotalSize += this.estimateItemSize(item)
					}
				}
				
				estimatedSize = (sampleTotalSize / sampleSize) * totalEntries
			}
			
			const totalRequests = this.stats.hits + this.stats.misses
			const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0
			const missRate = totalRequests > 0 ? this.stats.misses / totalRequests : 0
			const averageLoadTime = this.stats.hits > 0 ? this.stats.totalLoadTime / this.stats.hits : 0
			const averageBatchWriteTime = this.stats.batchWrites > 0 ? this.stats.batchWriteTime / this.stats.batchWrites : 0
			
			return {
				totalEntries,
				totalSizeBytes: estimatedSize,
				hitRate,
				missRate,
				averageLoadTime,
				cacheValidationTime: this.stats.validationTime,
				indexedDBSize: estimatedSize,
				oldestEntry: 0,
				newestEntry: Date.now(),
				batchWrites: this.stats.batchWrites,
				averageBatchWriteTime,
			}
		} catch (error) {
			cacheLogger.warn('Failed to get cache stats', { error })
			return {
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
			}
		}
	}

	private convertTreeNodeToCached(node: FsDirTreeNode): CachedDirectoryEntry {
		const children: CachedChildEntry[] = node.children.map(child => ({
			kind: child.kind,
			name: child.name,
			path: child.path,
			depth: child.depth,
			parentPath: child.parentPath,
			size: child.kind === 'file' ? child.size : undefined,
			lastModified: child.kind === 'file' ? child.lastModified : undefined,
			isLoaded: child.kind === 'dir' ? child.isLoaded : undefined,
		}))

		return {
			path: node.path,
			name: node.name,
			depth: node.depth,
			parentPath: node.parentPath,
			cachedAt: Date.now(),
			lastModified: undefined,
			version: this.version,
			children,
			isLoaded: node.isLoaded ?? false,
		}
	}

	private convertCachedToTreeNode(cached: CachedDirectoryEntry): FsDirTreeNode {
		const children = cached.children.map(child => {
			if (child.kind === 'file') {
				return {
					kind: 'file' as const,
					name: child.name,
					path: child.path,
					depth: child.depth,
					parentPath: child.parentPath,
					size: child.size,
					lastModified: child.lastModified,
				}
			} else {
				return {
					kind: 'dir' as const,
					name: child.name,
					path: child.path,
					depth: child.depth,
					parentPath: child.parentPath,
					children: [],
					isLoaded: child.isLoaded ?? false,
				}
			}
		})

		return {
			kind: 'dir',
			name: cached.name,
			path: cached.path,
			depth: cached.depth,
			parentPath: cached.parentPath,
			children,
			isLoaded: cached.isLoaded,
		}
	}

	private estimateItemSize(item: unknown): number {
		if (item === null || item === undefined) {
			return 0
		}
		
		try {
			return JSON.stringify(item).length * 2
		} catch {
			return 100
		}
	}
}