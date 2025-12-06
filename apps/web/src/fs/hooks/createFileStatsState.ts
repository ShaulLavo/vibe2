/* eslint-disable solid/reactivity */
import { createStore } from 'solid-js/store'
import type { ParseResult } from '@repo/utils'
import {
	evictCacheEntries,
	removeCacheEntry,
	touchCacheEntry
} from '../../utils/cache'

const MAX_FILE_STATS_CACHE = 100

export const createFileStatsState = () => {
	const [fileStats, setFileStatsStore] = createStore<
		Record<string, ParseResult | undefined>
	>({})
	const fileStatsOrder: string[] = []

	const evictFileStatsEntry = (path: string) => {
		setFileStatsStore(path, undefined)
	}

	const setFileStats = (path: string, result?: ParseResult) => {
		if (!path) return
		if (!result) {
			removeCacheEntry(fileStatsOrder, path)
			evictFileStatsEntry(path)
			return
		}

		setFileStatsStore(path, result)
		touchCacheEntry(fileStatsOrder, path)
		evictCacheEntries(fileStatsOrder, MAX_FILE_STATS_CACHE, evictFileStatsEntry)
	}

	const clearParseResults = () => {
		fileStatsOrder.length = 0
		for (const path of Object.keys(fileStats)) {
			evictFileStatsEntry(path)
		}
	}

	return {
		fileStats,
		setFileStats,
		clearParseResults
	}
}
