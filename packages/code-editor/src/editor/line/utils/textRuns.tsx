import type { LineBracketDepthMap, LineHighlightSegment } from '../../types'

export type NormalizedHighlightSegment = {
	start: number
	end: number
	className: string
	scope: string
}

/**
 * A text run with optional styling. Represents a contiguous chunk of text
 * that can be rendered as a single DOM node or span.
 */
export type TextRun = {
	text: string
	// For bracket coloring
	depth?: number
	// For syntax highlighting
	highlightClass?: string
	highlightScope?: string
}

export const normalizeHighlightSegments = (
	segments: LineHighlightSegment[] | undefined,
	textLength: number
): NormalizedHighlightSegment[] => {
	if (!segments?.length) {
		return []
	}

	const clamped = segments
		.map((segment) => {
			const start = Math.max(0, Math.min(textLength, segment.start))
			const end = Math.max(0, Math.min(textLength, segment.end))
			return {
				start,
				end,
				className: segment.className,
				scope: segment.scope,
			}
		})
		.filter((segment) => segment.end > segment.start)
		.sort((a, b) => a.start - b.start)

	const normalized: NormalizedHighlightSegment[] = []
	let cursor = 0

	for (const segment of clamped) {
		const start = Math.max(cursor, segment.start)
		const end = Math.max(start, segment.end)
		if (end <= start) continue
		normalized.push({
			start,
			end,
			className: segment.className,
			scope: segment.scope,
		})
		cursor = end
	}

	return normalized
}

/**
 * Build text runs by iterating through the text and grouping consecutive
 * characters with the same styling (bracket depth + highlight) together.
 * This is much more efficient than creating a span per character.
 */
export const buildTextRuns = (
	text: string,
	depthMap: LineBracketDepthMap | undefined,
	highlights: NormalizedHighlightSegment[],
	startIndex: number,
	endIndex: number
): TextRun[] => {
	if (text.length === 0) return []

	const runs: TextRun[] = []
	let currentRun: TextRun | null = null

	let highlightIdx = 0
	// Optimization: Skip highlights that end before our start index
	while (
		highlightIdx < highlights.length &&
		highlights[highlightIdx]!.end <= startIndex
	) {
		highlightIdx++
	}

	const numHighlights = highlights.length
	let currentHighlight: NormalizedHighlightSegment | undefined =
		highlightIdx < numHighlights ? highlights[highlightIdx] : undefined

	// Clamp endIndex to text length
	const actualEndIndex = Math.min(text.length, endIndex)

	for (let i = startIndex; i < actualEndIndex; i++) {
		// 1. Advance the highlight cursor if we've passed the current one
		while (currentHighlight && i >= currentHighlight.end) {
			highlightIdx++
			currentHighlight =
				highlightIdx < numHighlights ? highlights[highlightIdx] : undefined
		}

		// 2. Simply check if we are inside the current highlight (no searching needed)
		let activeHighlight: NormalizedHighlightSegment | undefined
		if (currentHighlight && i >= currentHighlight.start) {
			activeHighlight = currentHighlight
		}

		const char = text[i]!
		const isBracketChar =
			char === '(' ||
			char === ')' ||
			char === '[' ||
			char === ']' ||
			char === '{' ||
			char === '}'
		const depth = isBracketChar ? depthMap?.[i] : undefined

		// Check if we can extend the current run
		const canExtend =
			currentRun &&
			currentRun.depth === depth &&
			currentRun.highlightClass === activeHighlight?.className &&
			currentRun.highlightScope === activeHighlight?.scope

		if (canExtend) {
			currentRun!.text += char
		} else {
			// Start a new run
			currentRun = {
				text: char,
				depth,
				highlightClass: activeHighlight?.className,
				highlightScope: activeHighlight?.scope,
			}
			runs.push(currentRun)
		}
	}

	return runs
}
