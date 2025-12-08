/* eslint-disable solid/reactivity */
import { createStore } from 'solid-js/store'
import type { ParseResult } from '@repo/utils'
export const createFileStatsState = () => {
	const [fileStats, setFileStatsStore] = createStore<
		Record<string, ParseResult | undefined>
	>({})

	const evictFileStatsEntry = (path: string) => {
		setFileStatsStore(path, undefined)
	}

	const setFileStats = (path: string, result?: ParseResult) => {
		if (!path) return
		setFileStatsStore(path, result)
	}

	const clearParseResults = () => {
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
