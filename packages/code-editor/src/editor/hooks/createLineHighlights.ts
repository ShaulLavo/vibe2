import { createMemo, type Accessor } from 'solid-js'
import { Lexer, type LineState } from '@repo/lexer'
import {
	mergeLineSegments,
	toLineHighlightSegmentsForLine,
	getHighlightClassForScope,
} from '../utils/highlights'
import type {
	EditorError,
	EditorSyntaxHighlight,
	LineEntry,
	LineHighlightSegment,
} from '../types'

type ErrorHighlight = { startIndex: number; endIndex: number; scope: string }

type CachedLineHighlights = {
	start: number
	length: number
	text: string
	lexState: LineState['lexState']
	bracketDepth: number
	offset: number
	segments: LineHighlightSegment[]
}

export type CreateLineHighlightsOptions = {
	lexer: Lexer
	highlights?: Accessor<EditorSyntaxHighlight[] | undefined>
	errors?: Accessor<EditorError[] | undefined>
	lexerStates?: Accessor<LineState[] | undefined>
}

export const createLineHighlights = (options: CreateLineHighlightsOptions) => {
	const EMPTY_HIGHLIGHTS: EditorSyntaxHighlight[] = []
	const EMPTY_ERRORS: ErrorHighlight[] = []

	const sortedHighlights = createMemo(() => {
		const highlights = options.highlights?.()
		if (!highlights?.length) return EMPTY_HIGHLIGHTS
		return highlights.slice().sort((a, b) => a.startIndex - b.startIndex)
	})

	const sortedErrorHighlights = createMemo<ErrorHighlight[]>(() => {
		const errors = options.errors?.()
		if (!errors?.length) return EMPTY_ERRORS

		return errors
			.map((error) => ({
				startIndex: error.startIndex,
				endIndex: error.endIndex,
				scope: error.isMissing ? 'missing' : 'error',
			}))
			.sort((a, b) => a.startIndex - b.startIndex)
	})

	let highlightCache = new Map<number, CachedLineHighlights>()
	let lastHighlightsRef: EditorSyntaxHighlight[] | undefined
	let lastErrorsRef: ErrorHighlight[] | undefined
	let lastLexerStatesRef: LineState[] | undefined
	const MAX_HIGHLIGHT_CACHE_SIZE = 500

	const getLineHighlights = (entry: LineEntry): LineHighlightSegment[] => {
		const lineStart = entry.start
		const lineLength = entry.length
		const lineTextLength = entry.text.length
		const highlights = sortedHighlights()
		const errors = sortedErrorHighlights()
		const lexerStates = options.lexerStates?.()

		if (
			highlights !== lastHighlightsRef ||
			errors !== lastErrorsRef ||
			lexerStates !== lastLexerStatesRef
		) {
			highlightCache = new Map()
			lastHighlightsRef = highlights
			lastErrorsRef = errors
			lastLexerStatesRef = lexerStates
		}

		const cached = highlightCache.get(entry.index)
		if (
			cached !== undefined &&
			cached.start === lineStart &&
			cached.length === lineLength &&
			cached.text === entry.text
		) {
			const lineState =
				lexerStates?.[entry.index] ??
				options.lexer.getLineState(entry.index) ??
				Lexer.initialState()

			if (
				cached.lexState === lineState.lexState &&
				cached.bracketDepth === lineState.bracketDepth &&
				cached.offset === lineState.offset
			) {
				return cached.segments
			}
		}

		let highlightSegments: LineHighlightSegment[]
		if (highlights.length > 0) {
			highlightSegments = toLineHighlightSegmentsForLine(
				lineStart,
				lineLength,
				lineTextLength,
				highlights
			)
		} else {
			const lineState =
				lexerStates?.[entry.index] ?? options.lexer.getLineState(entry.index)
			const { tokens } = options.lexer.tokenizeLine(
				entry.text,
				lineState ?? Lexer.initialState()
			)
			highlightSegments = options.lexer.tokensToSegments(
				tokens,
				getHighlightClassForScope
			)
		}

		const errorSegments = toLineHighlightSegmentsForLine(
			lineStart,
			lineLength,
			lineTextLength,
			errors
		)

		const result = mergeLineSegments(highlightSegments, errorSegments)

		const lineState =
			lexerStates?.[entry.index] ??
			options.lexer.getLineState(entry.index) ??
			Lexer.initialState()

		highlightCache.set(entry.index, {
			start: lineStart,
			length: lineLength,
			text: entry.text,
			lexState: lineState.lexState,
			bracketDepth: lineState.bracketDepth,
			offset: lineState.offset,
			segments: result,
		})
		if (highlightCache.size > MAX_HIGHLIGHT_CACHE_SIZE) {
			const firstKey = highlightCache.keys().next().value
			if (typeof firstKey === 'number') {
				highlightCache.delete(firstKey)
			}
		}

		return result
	}

	return { getLineHighlights }
}
