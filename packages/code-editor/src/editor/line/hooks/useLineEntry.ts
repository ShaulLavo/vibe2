import { createMemo, type Accessor } from 'solid-js'

import { useCursor } from '../../cursor'
import type { LineEntry } from '../../types'

// Global counter for profiling
let lineEntryRunCount = 0
let lineEntryTotalTime = 0
let lastReportTime = 0

const maybeReportLineEntryStats = () => {
	const now = performance.now()
	if (now - lastReportTime > 100 && lineEntryRunCount > 0) {
		console.log(
			`useLineEntry: ${lineEntryRunCount} runs, ${lineEntryTotalTime.toFixed(2)}ms total`
		)
		lineEntryRunCount = 0
		lineEntryTotalTime = 0
		lastReportTime = now
	}
}

export type UseLineEntryOptions = {
	resolvedLineId: Accessor<number>
	lineIndex: Accessor<number>
	isLineValid: Accessor<boolean>
	lineText: Accessor<string>
}

export const useLineEntry = (
	options: UseLineEntryOptions
): Accessor<LineEntry | null> => {
	const cursor = useCursor()

	const entry = createMemo<LineEntry | null>((prev) => {
		const memoStart = performance.now()
		if (!options.isLineValid()) return null
		const idx = options.lineIndex()
		const lineId = options.resolvedLineId()
		const start =
			lineId > 0
				? cursor.lines.getLineStartById(lineId)
				: cursor.lines.getLineStart(idx)
		const length =
			lineId > 0
				? cursor.lines.getLineLengthById(lineId)
				: cursor.lines.getLineLength(idx)
		const text = options.lineText()
		// Reuse previous entry if only index/start changed (common during line shifts)
		let result: LineEntry | null
		if (
			prev &&
			prev.lineId === lineId &&
			prev.length === length &&
			prev.text === text
		) {
			if (prev.index !== idx) prev.index = idx
			if (prev.start !== start) prev.start = start
			result = prev
		} else {
			result = {
				lineId,
				index: idx,
				start,
				length,
				text,
			}
		}
		lineEntryRunCount++
		lineEntryTotalTime += performance.now() - memoStart
		maybeReportLineEntryStats()
		return result
	})
	return entry
}
