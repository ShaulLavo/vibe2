import { fontMetadataService } from './FontMetadataService'

export type CacheErrorType =
	| 'cache_api_unavailable'
	| 'indexeddb_unavailable'
	| 'storage_quota_exceeded'
	| 'cache_corruption'
	| 'metadata_corruption'
	| 'permission_denied'

export type CacheRecoveryStrategy =
	| 'fallback_memory'
	| 'fallback_localstorage'
	| 'clear_and_rebuild'
	| 'reduce_cache_size'
	| 'disable_caching'

export type CacheRecoveryResult = {
	success: boolean
	strategy: CacheRecoveryStrategy
	message: string
	fallbackActive: boolean
}

/**
 * Service for handling cache errors and implementing recovery strategies
 * Provides fallback storage options when Cache API or IndexedDB fail
 */
export class CacheErrorRecoveryService {
	private static instance: CacheErrorRecoveryService | null = null
	private fallbackStorage = new Map<string, ArrayBuffer>()
	private fallbackMetadata = new Map<string, any>()
	private cacheApiAvailable = true
	private indexedDBAvailable = true
	private fallbackMode = false

	static getInstance(): CacheErrorRecoveryService {
		if (!CacheErrorRecoveryService.instance) {
			CacheErrorRecoveryService.instance = new CacheErrorRecoveryService()
		}
		return CacheErrorRecoveryService.instance
	}

	/**
	 * Detect and categorize cache errors
	 */
	categorizeError(error: Error): CacheErrorType {
		const message = error.message.toLowerCase()

		if (message.includes('cache') && message.includes('not supported')) {
			return 'cache_api_unavailable'
		}

		if (message.includes('indexeddb') || message.includes('database')) {
			return 'indexeddb_unavailable'
		}

		if (message.includes('quota') || message.includes('storage full')) {
			return 'storage_quota_exceeded'
		}

		if (message.includes('corrupt') || message.includes('invalid')) {
			return 'cache_corruption'
		}

		if (message.includes('permission') || message.includes('access denied')) {
			return 'permission_denied'
		}

		return 'cache_corruption' // Default fallback
	}

	/**
	 * Determine the best recovery strategy for a given error type
	 */
	getRecoveryStrategy(errorType: CacheErrorType): CacheRecoveryStrategy {
		switch (errorType) {
			case 'cache_api_unavailable':
				return 'fallback_localstorage'

			case 'indexeddb_unavailable':
				return 'fallback_localstorage'

			case 'storage_quota_exceeded':
				return 'reduce_cache_size'

			case 'cache_corruption':
			case 'metadata_corruption':
				return 'clear_and_rebuild'

			case 'permission_denied':
				return 'fallback_memory'

			default:
				return 'fallback_memory'
		}
	}

	/**
	 * Execute recovery strategy for cache errors
	 */
	async recoverFromError(error: Error): Promise<CacheRecoveryResult> {
		const errorType = this.categorizeError(error)
		const strategy = this.getRecoveryStrategy(errorType)

		console.log(
			`[CacheErrorRecovery] Attempting recovery with strategy: ${strategy} for error: ${errorType}`
		)

		try {
			switch (strategy) {
				case 'fallback_memory':
					return await this.enableMemoryFallback()

				case 'fallback_localstorage':
					return await this.enableLocalStorageFallback()

				case 'clear_and_rebuild':
					return await this.clearAndRebuildCache()

				case 'reduce_cache_size':
					return await this.reduceCacheSize()

				case 'disable_caching':
					return await this.disableCaching()

				default:
					return {
						success: false,
						strategy,
						message: 'Unknown recovery strategy',
						fallbackActive: false,
					}
			}
		} catch (recoveryError) {
			console.error('[CacheErrorRecovery] Recovery failed:', recoveryError)

			// Last resort: disable caching entirely
			return await this.disableCaching()
		}
	}

	/**
	 * Enable memory-only fallback storage
	 */
	private async enableMemoryFallback(): Promise<CacheRecoveryResult> {
		console.log('[CacheErrorRecovery] Enabling memory-only fallback')

		this.fallbackMode = true
		this.cacheApiAvailable = false
		this.indexedDBAvailable = false

		return {
			success: true,
			strategy: 'fallback_memory',
			message:
				'Using memory-only storage. Fonts will be lost when the page is refreshed.',
			fallbackActive: true,
		}
	}

	/**
	 * Enable localStorage fallback for metadata
	 */
	private async enableLocalStorageFallback(): Promise<CacheRecoveryResult> {
		console.log('[CacheErrorRecovery] Enabling localStorage fallback')

		try {
			// Test localStorage availability
			const testKey = 'font-cache-test'
			localStorage.setItem(testKey, 'test')
			localStorage.removeItem(testKey)

			this.fallbackMode = true
			this.indexedDBAvailable = false

			return {
				success: true,
				strategy: 'fallback_localstorage',
				message:
					'Using localStorage for font metadata. Some features may be limited.',
				fallbackActive: true,
			}
		} catch (error) {
			console.error('[CacheErrorRecovery] localStorage not available:', error)
			return await this.enableMemoryFallback()
		}
	}

	/**
	 * Clear corrupted cache and rebuild
	 */
	private async clearAndRebuildCache(): Promise<CacheRecoveryResult> {
		console.log('[CacheErrorRecovery] Clearing and rebuilding cache')

		try {
			// Clear Cache API if available
			if ('caches' in window) {
				try {
					await caches.delete('nerdfonts-v1')
					console.log('[CacheErrorRecovery] Cache API cleared')
				} catch (error) {
					console.warn('[CacheErrorRecovery] Failed to clear Cache API:', error)
				}
			}

			// Clear IndexedDB if available
			try {
				await fontMetadataService.clearAllMetadata()
				console.log('[CacheErrorRecovery] IndexedDB metadata cleared')
			} catch (error) {
				console.warn('[CacheErrorRecovery] Failed to clear IndexedDB:', error)
			}

			// Clear localStorage fallback
			try {
				const keys = Object.keys(localStorage)
				for (const key of keys) {
					if (key.startsWith('font-')) {
						localStorage.removeItem(key)
					}
				}
				console.log('[CacheErrorRecovery] localStorage font data cleared')
			} catch (error) {
				console.warn(
					'[CacheErrorRecovery] Failed to clear localStorage:',
					error
				)
			}

			return {
				success: true,
				strategy: 'clear_and_rebuild',
				message:
					'Cache cleared and rebuilt. You may need to re-download fonts.',
				fallbackActive: false,
			}
		} catch (error) {
			console.error('[CacheErrorRecovery] Failed to clear cache:', error)
			return await this.enableMemoryFallback()
		}
	}

	/**
	 * Reduce cache size by removing oldest fonts
	 */
	private async reduceCacheSize(): Promise<CacheRecoveryResult> {
		console.log('[CacheErrorRecovery] Reducing cache size')

		try {
			// Get all font metadata sorted by last accessed
			const allMetadata = await fontMetadataService.getAllFontMetadata()
			const sortedByAccess = allMetadata.sort(
				(a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
			)

			// Remove oldest 50% of fonts
			const fontsToRemove = sortedByAccess.slice(
				0,
				Math.floor(sortedByAccess.length / 2)
			)

			for (const metadata of fontsToRemove) {
				try {
					// Remove from Cache API
					if ('caches' in window) {
						const cache = await caches.open('nerdfonts-v1')
						await cache.delete(`/fonts/${metadata.name}`)
					}

					// Remove metadata
					await fontMetadataService.removeFontMetadata(metadata.name)

					console.log(`[CacheErrorRecovery] Removed font: ${metadata.name}`)
				} catch (error) {
					console.warn(
						`[CacheErrorRecovery] Failed to remove font ${metadata.name}:`,
						error
					)
				}
			}

			return {
				success: true,
				strategy: 'reduce_cache_size',
				message: `Removed ${fontsToRemove.length} fonts to free up storage space.`,
				fallbackActive: false,
			}
		} catch (error) {
			console.error('[CacheErrorRecovery] Failed to reduce cache size:', error)
			return await this.clearAndRebuildCache()
		}
	}

	/**
	 * Disable caching entirely
	 */
	private async disableCaching(): Promise<CacheRecoveryResult> {
		console.log('[CacheErrorRecovery] Disabling caching entirely')

		this.fallbackMode = true
		this.cacheApiAvailable = false
		this.indexedDBAvailable = false

		return {
			success: true,
			strategy: 'disable_caching',
			message:
				'Font caching disabled. Fonts will be downloaded fresh each time.',
			fallbackActive: true,
		}
	}

	/**
	 * Store font data in fallback storage
	 */
	async storeFontFallback(name: string, data: ArrayBuffer): Promise<void> {
		if (!this.fallbackMode) {
			throw new Error('Fallback mode not enabled')
		}

		this.fallbackStorage.set(name, data)
		console.log(`[CacheErrorRecovery] Stored font ${name} in fallback storage`)
	}

	/**
	 * Retrieve font data from fallback storage
	 */
	async getFontFallback(name: string): Promise<ArrayBuffer | null> {
		if (!this.fallbackMode) {
			return null
		}

		return this.fallbackStorage.get(name) || null
	}

	/**
	 * Store metadata in fallback storage
	 */
	async storeMetadataFallback(name: string, metadata: any): Promise<void> {
		if (!this.fallbackMode) {
			throw new Error('Fallback mode not enabled')
		}

		if (this.indexedDBAvailable) {
			// Try localStorage first
			try {
				localStorage.setItem(`font-metadata-${name}`, JSON.stringify(metadata))
				return
			} catch (error) {
				console.warn(
					'[CacheErrorRecovery] localStorage failed, using memory:',
					error
				)
			}
		}

		// Fall back to memory storage
		this.fallbackMetadata.set(name, metadata)
		console.log(
			`[CacheErrorRecovery] Stored metadata for ${name} in fallback storage`
		)
	}

	/**
	 * Retrieve metadata from fallback storage
	 */
	async getMetadataFallback(name: string): Promise<any | null> {
		if (!this.fallbackMode) {
			return null
		}

		// Try localStorage first
		if (!this.indexedDBAvailable) {
			try {
				const stored = localStorage.getItem(`font-metadata-${name}`)
				if (stored) {
					return JSON.parse(stored)
				}
			} catch (error) {
				console.warn(
					'[CacheErrorRecovery] Failed to read from localStorage:',
					error
				)
			}
		}

		// Fall back to memory storage
		return this.fallbackMetadata.get(name) || null
	}

	/**
	 * Check if fallback mode is active
	 */
	isFallbackMode(): boolean {
		return this.fallbackMode
	}

	/**
	 * Get current cache availability status
	 */
	getCacheStatus(): {
		cacheAPI: boolean
		indexedDB: boolean
		fallback: boolean
	} {
		return {
			cacheAPI: this.cacheApiAvailable,
			indexedDB: this.indexedDBAvailable,
			fallback: this.fallbackMode,
		}
	}

	/**
	 * Reset recovery service (for testing)
	 */
	reset(): void {
		this.fallbackStorage.clear()
		this.fallbackMetadata.clear()
		this.cacheApiAvailable = true
		this.indexedDBAvailable = true
		this.fallbackMode = false
	}
}

// Export singleton instance
export const cacheErrorRecovery = CacheErrorRecoveryService.getInstance()
