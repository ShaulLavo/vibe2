import { createMemo, onCleanup, type Accessor } from 'solid-js'
import { Lexer, type LineState } from '@repo/lexer'
import type { BracketDepthMap, VirtualItem } from '../types'

type CachedLineBrackets = {
	lineText: string
	startOffset: number
	startLexState: LineState['lexState']
	startBracketDepth: number
	brackets: { index: number; depth: number }[]
}

export type VisibleBracketDepthCache = Map<number, CachedLineBrackets>

export const createVisibleBracketDepthCache = (): VisibleBracketDepthCache =>
	new Map()

type ComputeVisibleBracketDepthsOptions = {
	lexer: Lexer
	lexerStates: LineState[] | undefined
	virtualItems: VirtualItem[]
	displayToLine: (displayIndex: number) => number
	getLineStart: (lineIndex: number) => number
	getLineText: (lineIndex: number) => string
	lineCache: VisibleBracketDepthCache
}

export const computeVisibleBracketDepths = (
	options: ComputeVisibleBracketDepthsOptions
): BracketDepthMap | undefined => {
	const lexerStates = options.lexerStates
	if (!lexerStates?.length) return undefined

	const depthMap: BracketDepthMap = {}
	let hasBrackets = false

	for (const item of options.virtualItems) {
		const lineIndex = options.displayToLine(item.index)
		if (lineIndex < 0 || lineIndex >= lexerStates.length) continue

		const lineStart = options.getLineStart(lineIndex)
		const lineText = options.getLineText(lineIndex)
		const startStateFromLexer = lexerStates[lineIndex] ?? Lexer.initialState()
		const startState = { ...startStateFromLexer, offset: lineStart }

		const cached = options.lineCache.get(lineIndex)
		const hasCached = Boolean(cached)

		const hasSameText = cached?.lineText === lineText
		const hasSameStartOffset = cached?.startOffset === lineStart
		const hasSameStartLexState = cached?.startLexState === startState.lexState
		const hasSameStartBracketDepth =
			cached?.startBracketDepth === startState.bracketDepth

		const isCacheValid =
			hasCached &&
			hasSameText &&
			hasSameStartOffset &&
			hasSameStartLexState &&
			hasSameStartBracketDepth

		let nextCached = cached
		if (isCacheValid === false) {
			const { brackets } = options.lexer.tokenizeLine(lineText, startState)
			nextCached = {
				lineText,
				startOffset: lineStart,
				startLexState: startState.lexState,
				startBracketDepth: startState.bracketDepth,
				brackets,
			}
			options.lineCache.set(lineIndex, nextCached)
		}

		if (nextCached === undefined) continue

		for (const bracket of nextCached.brackets) {
			hasBrackets = true
			depthMap[bracket.index] = bracket.depth
		}
	}

	return hasBrackets ? depthMap : undefined
}

export type UseVisibleBracketDepthsOptions = {
	lexer: Lexer
	lexerStates: Accessor<LineState[] | undefined>
	virtualItems: Accessor<VirtualItem[]>
	displayToLine: (displayIndex: number) => number
	getLineStart: (lineIndex: number) => number
	getLineText: (lineIndex: number) => string
}

export const useVisibleBracketDepths = (
	options: UseVisibleBracketDepthsOptions
) => {
	const lineCache = createVisibleBracketDepthCache()

	onCleanup(() => {
		lineCache.clear()
	})

	const memo = createMemo<BracketDepthMap | undefined>(() => {
		return computeVisibleBracketDepths({
			lexer: options.lexer,
			lexerStates: options.lexerStates(),
			virtualItems: options.virtualItems(),
			displayToLine: options.displayToLine,
			getLineStart: options.getLineStart,
			getLineText: options.getLineText,
			lineCache,
		})
	})

	return memo
}
