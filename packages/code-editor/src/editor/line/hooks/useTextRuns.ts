import { createMemo, type Accessor } from 'solid-js'
import type { LineBracketDepthMap, LineHighlightSegment } from '../../types'
import {
	buildTextRuns,
	buildTextRunsHtml,
	normalizeHighlightSegments,
	type TextRun,
} from '../utils/textRuns'
import { getBracketDepthTextClass } from '../../theme/bracketColors'

// Global counter for profiling
let textRunsHtmlRunCount = 0
let textRunsHtmlTotalTime = 0
let lastTextRunsHtmlReportTime = 0

const maybeReportTextRunsHtmlStats = () => {
	const now = performance.now()
	if (now - lastTextRunsHtmlReportTime > 100 && textRunsHtmlRunCount > 0) {
		console.log(
			`useTextRunsHtml: ${textRunsHtmlRunCount} runs, ${textRunsHtmlTotalTime.toFixed(2)}ms total`
		)
		textRunsHtmlRunCount = 0
		textRunsHtmlTotalTime = 0
		lastTextRunsHtmlReportTime = now
	}
}

export type UseTextRunsOptions = {
	text: Accessor<string>
	bracketDepths: Accessor<LineBracketDepthMap | undefined>
	highlightSegments: Accessor<LineHighlightSegment[] | undefined>
	columnStart: Accessor<number | undefined>
	columnEnd: Accessor<number | undefined>
}

/**
 * Reactive hook that computes text runs for syntax-highlighted line rendering.
 * Groups consecutive characters with identical styling into runs for efficient DOM rendering.
 */
export const useTextRuns = (
	options: UseTextRunsOptions
): Accessor<TextRun[]> => {
	const runs = createMemo(() => {
		const text = options.text()
		if (text.length === 0) {
			return []
		}

		const depthMap = options.bracketDepths()
		const rawSegments = options.highlightSegments()
		const highlights = normalizeHighlightSegments(rawSegments, text.length)

		const startIndex = Math.max(0, options.columnStart() ?? 0)
		const endIndex = options.columnEnd() ?? text.length

		const result = buildTextRuns(
			text,
			depthMap,
			highlights,
			startIndex,
			endIndex
		)

		return result
	})

	return runs
}

export const useTextRunsHtml = (
	options: UseTextRunsOptions
): Accessor<string> => {
	const html = createMemo(() => {
		const memoStart = performance.now()
		const text = options.text()
		if (text.length === 0) {
			return ''
		}

		const depthMap = options.bracketDepths()
		const rawSegments = options.highlightSegments()
		const highlights = normalizeHighlightSegments(rawSegments, text.length)

		const startIndex = Math.max(0, options.columnStart() ?? 0)
		const endIndex = options.columnEnd() ?? text.length

		const runs = buildTextRuns(text, depthMap, highlights, startIndex, endIndex)

		const result = buildTextRunsHtml(runs, getBracketDepthTextClass)
		textRunsHtmlRunCount++
		textRunsHtmlTotalTime += performance.now() - memoStart
		maybeReportTextRunsHtmlStats()
		return result
	})

	return html
}
