import { createStore } from 'solid-js/store'
import { createResource, useTransition, batch } from 'solid-js'
import { client } from '~/client'
import { fontCacheService, fontInstallationService } from '../services'

export type FontInfo = {
	name: string
	displayName: string
	isInstalled: boolean
	isDownloading: boolean
	downloadProgress?: number
	installedAt?: Date
	size?: number
}

export type FontStoreState = {
	downloadQueue: Set<string>
	cacheStats: {
		totalSize: number
		fontCount: number
		lastCleanup: Date
	}
}

export type FontActions = {
	downloadFont: (name: string) => Promise<void>
	removeFont: (name: string) => Promise<void>
	isFontInstalled: (name: string) => boolean
	getCacheStats: () => Promise<{ totalSize: number; fontCount: number }>
	cleanupCache: () => Promise<void>
	refreshAvailableFonts: () => Promise<void>
}

export type FontStore = {
	state: FontStoreState
	availableFonts: () => Record<string, string> | undefined
	installedFonts: () => Set<string> | undefined
	cacheStats: () => { totalSize: number; fontCount: number } | undefined
	pending: () => boolean
	startTransition: (fn: () => void) => void
	actions: FontActions
}

export const createFontStore = (): FontStore => {
	const [state, setState] = createStore<FontStoreState>({
		downloadQueue: new Set(),
		cacheStats: {
			totalSize: 0,
			fontCount: 0,
			lastCleanup: new Date()
		}
	})

	const [availableFonts, { refetch: refetchAvailableFonts }] = createResource(async () => {
		const response = await client.fonts.get()
		if (response.data) {
			return response.data
		}
		throw new Error('Failed to fetch available fonts')
	})

	const [installedFonts, { refetch: refetchInstalledFonts }] = createResource(async () => {
		try {
			await fontCacheService.init()
			await fontInstallationService.initialize()
			
			const cachedFonts = await fontCacheService.getInstalledFonts()
			const installedInDocument = fontInstallationService.getInstalledFonts()
			
			const installedFonts = new Set<string>()
			for (const fontName of cachedFonts) {
				if (installedInDocument.has(fontName)) {
					installedFonts.add(fontName)
				}
			}
			
			return installedFonts
		} catch {
			return new Set<string>()
		}
	})

	const [cacheStats, { refetch: refetchCacheStats }] = createResource(async () => {
		try {
			await fontCacheService.init()
			const stats = await fontCacheService.getCacheStats()
			return stats
		} catch {
			return { totalSize: 0, fontCount: 0 }
		}
	})

	const [pending, startTransition] = useTransition()

	const downloadFont = async (name: string): Promise<void> => {
		setState('downloadQueue', (queue) => new Set([...Array.from(queue), name]))
		
		try {
			const available = availableFonts()
			if (!available || !available[name]) {
				throw new Error(`Font ${name} not found in available fonts`)
			}

			const { fontDownloadService } = await import('../services/FontDownloadService')
			
			await fontDownloadService.downloadAndInstallFont(name, available[name])
			
			batch(() => {
				refetchInstalledFonts()
				refetchCacheStats()
			})
		} catch (error) {
			throw error
		} finally {
			setState('downloadQueue', (queue) => {
				const newQueue = new Set(queue)
				newQueue.delete(name)
				return newQueue
			})
		}
	}

	const removeFont = async (name: string): Promise<void> => {
		await fontCacheService.init()
		
		await fontCacheService.removeFont(name)
		await fontInstallationService.uninstallFont(name)
		
		batch(() => {
			refetchInstalledFonts()
			refetchCacheStats()
		})
	}

	const isFontInstalled = (name: string): boolean => {
		const installed = installedFonts()
		return installed ? installed.has(name) : false
	}

	const getCacheStatsAction = async (): Promise<{ totalSize: number; fontCount: number }> => {
		try {
			await fontCacheService.init()
			return await fontCacheService.getCacheStats()
		} catch {
			return { totalSize: 0, fontCount: 0 }
		}
	}

	const cleanupCache = async (): Promise<void> => {
		await fontCacheService.init()
		await fontCacheService.cleanupCache()
		refetchCacheStats()
	}

	const refreshAvailableFonts = async (): Promise<void> => {
		refetchAvailableFonts()
	}

	const actions: FontActions = {
		downloadFont,
		removeFont,
		isFontInstalled,
		getCacheStats: getCacheStatsAction,
		cleanupCache,
		refreshAvailableFonts,
	}

	return {
		state,
		availableFonts,
		installedFonts,
		cacheStats,
		pending,
		startTransition,
		actions,
	}
}