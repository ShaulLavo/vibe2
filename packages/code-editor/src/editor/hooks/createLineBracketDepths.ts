import type { Accessor } from 'solid-js'
import { Lexer, type LineState } from '@repo/lexer'
import type { LineBracketDepthMap, LineEntry } from '../types'

type CachedLineBracketDepths = {
	start: number
	text: string
	lexState: LineState['lexState']
	bracketDepth: number
	offset: number
	depths: LineBracketDepthMap | undefined
}

export type CreateLineBracketDepthsOptions = {
	lexer: Lexer
	lexerStates: Accessor<LineState[] | undefined>
}

const MAX_CACHE_SIZE = 500

export const createLineBracketDepths = (options: CreateLineBracketDepthsOptions) => {
	let cache = new Map<number, CachedLineBracketDepths>()

	const getLineBracketDepths = (
		entry: LineEntry
	): LineBracketDepthMap | undefined => {
		const lexerStates = options.lexerStates()
		if (!lexerStates?.length) {
			if (cache.size) cache = new Map()
			return undefined
		}

		const startStateFromLexer =
			lexerStates[entry.index] ??
			options.lexer.getLineState(entry.index) ??
			Lexer.initialState()
		const startState = { ...startStateFromLexer, offset: entry.start }

		const cached = cache.get(entry.index)
		if (
			cached &&
			cached.start === entry.start &&
			cached.text === entry.text &&
			cached.lexState === startState.lexState &&
			cached.bracketDepth === startState.bracketDepth &&
			cached.offset === startState.offset
		) {
			cache.delete(entry.index)
			cache.set(entry.index, cached)
			return cached.depths
		}

		const { brackets } = options.lexer.tokenizeLine(entry.text, startState)

		let depths: LineBracketDepthMap | undefined
		if (brackets.length > 0) {
			const map: LineBracketDepthMap = {}
			let hasDepths = false

			for (const bracket of brackets) {
				const offset = bracket.index - entry.start
				if (offset < 0 || offset >= entry.text.length) continue
				map[offset] = bracket.depth
				hasDepths = true
			}

			if (hasDepths) depths = map
		}

		cache.set(entry.index, {
			start: entry.start,
			text: entry.text,
			lexState: startState.lexState,
			bracketDepth: startState.bracketDepth,
			offset: startState.offset,
			depths,
		})

		if (cache.size > MAX_CACHE_SIZE) {
			const firstKey = cache.keys().next().value
			if (typeof firstKey === 'number') {
				cache.delete(firstKey)
			}
		}

		return depths
	}

	return { getLineBracketDepths }
}

