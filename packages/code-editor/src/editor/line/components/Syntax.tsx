import { createMemo } from 'solid-js'
import type { LineBracketDepthMap, LineHighlightSegment } from '../../types'
import { useTextRunsHtml } from '../hooks/useTextRuns'
import { getBracketDepthTextClass } from '../../theme/bracketColors'
import { buildTextRunsHtml, type TextRun } from '../utils/textRuns'

type SyntaxProps = {
	text: string
	bracketDepths?: LineBracketDepthMap
	highlightSegments?: LineHighlightSegment[]
	columnStart?: number
	columnEnd?: number
	/** Pre-computed TextRuns from cache for instant rendering */
	cachedRuns?: TextRun[]
}

/**
 * Renders a line of text with syntax highlighting and bracket coloring.
 * Text is grouped into styled "runs" for efficient DOM rendering.
 * If cachedRuns are provided, uses them directly for instant rendering.
 */
export const Syntax = (props: SyntaxProps) => {
	const computedHtml = useTextRunsHtml({
		text: () => props.text,
		bracketDepths: () => props.bracketDepths,
		highlightSegments: () => props.highlightSegments,
		columnStart: () => props.columnStart,
		columnEnd: () => props.columnEnd,
	})

	const cachedHtml = createMemo(() => {
		const runs = props.cachedRuns
		if (!runs) return undefined

		return buildTextRunsHtml(runs, getBracketDepthTextClass)
	})

	return <span innerHTML={cachedHtml() ?? computedHtml()} />
}
