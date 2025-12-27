import localforage from 'localforage'
import type { CachedDirectoryEntry } from './treeCacheController'
import { CACHE_KEY_SCHEMA } from './treeCacheController'

/**
 * Worker-side cache interface for accessing LocalForage from prefetch workers.
 * Provides a simplified interface optimized for worker thread usage.
 */
export class WorkerTreeCache {
	private readonly store: LocalForage
	private readonly version = 1

	constructor(options: { dbName?: string; storeName?: string } = {}) {
		const dbName = options.dbName ?? 'tree-cache'
		const storeName = options.storeName ?? 'directories'

		// Create LocalForage instance using same configuration as main thread
		this.store = localforage.createInstance({
			name: dbName,
			storeName: storeName,
			driver: [localforage.INDEXEDDB],
		})
	}

	/**
	 * Get directory from cache
	 */
	async getDirectory(path: string): Promise<CachedDirectoryEntry | null> {
		try {
			const key = CACHE_KEY_SCHEMA.dir(path)
			const cached = await this.store.getItem<CachedDirectoryEntry>(key)
			return cached
		} catch (error) {
			console.warn(`WorkerTreeCache: Failed to get directory "${path}":`, error)
			return null
		}
	}

	/**
	 * Set directory in cache
	 */
	async setDirectory(path: string, entry: CachedDirectoryEntry): Promise<void> {
		try {
			const key = CACHE_KEY_SCHEMA.dir(path)
			await this.store.setItem(key, entry)
		} catch (error) {
			console.warn(`WorkerTreeCache: Failed to set directory "${path}":`, error)
			throw error
		}
	}

	/**
	 * Check if directory cache entry is fresh based on modification time
	 */
	async isDirectoryFresh(
		path: string,
		currentMtime?: number
	): Promise<boolean> {
		try {
			const cached = await this.getDirectory(path)

			if (!cached) {
				return false
			}

			// If no current mtime provided, assume fresh
			if (currentMtime === undefined) {
				return true
			}

			// Compare modification times
			return (
				cached.lastModified !== undefined && cached.lastModified >= currentMtime
			)
		} catch (error) {
			console.warn(
				`WorkerTreeCache: Failed to check freshness for "${path}":`,
				error
			)
			return false
		}
	}

	/**
	 * Batch set multiple directories for performance
	 */
	async batchSetDirectories(
		entries: Map<string, CachedDirectoryEntry>
	): Promise<void> {
		try {
			const promises: Promise<void>[] = []

			for (const [path, entry] of entries) {
				const key = CACHE_KEY_SCHEMA.dir(path)
				promises.push(this.store.setItem(key, entry).then(() => {}))
			}

			await Promise.all(promises)
		} catch (error) {
			console.warn('WorkerTreeCache: Failed to batch set directories:', error)
			throw error
		}
	}

}

/**
 * Factory function to create a WorkerTreeCache instance
 */
export function createWorkerTreeCache(options?: {
	dbName?: string
	storeName?: string
}): WorkerTreeCache {
	return new WorkerTreeCache(options)
}
