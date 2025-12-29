import { createMemo, type Accessor } from 'solid-js'

import { useCursor } from '../../cursor'
import type { VirtualItem2D } from '../../types'

// Global counter for profiling
let lineTextRunCount = 0
let lineTextTotalTime = 0
let lastLineTextReportTime = 0

const maybeReportLineTextStats = () => {
	const now = performance.now()
	if (now - lastLineTextReportTime > 100 && lineTextRunCount > 0) {
		console.log(
			`lineText memo: ${lineTextRunCount} runs, ${lineTextTotalTime.toFixed(2)}ms total`
		)
		lineTextRunCount = 0
		lineTextTotalTime = 0
		lastLineTextReportTime = now
	}
}

export type UseLineResolutionOptions = {
	virtualRow: Accessor<VirtualItem2D>
	displayToLine: Accessor<((displayIndex: number) => number) | undefined>
}

export type UseLineResolutionResult = {
	resolvedLineId: Accessor<number>
	lineIndex: Accessor<number>
	isLineValid: Accessor<boolean>
	lineText: Accessor<string>
}

export const useLineResolution = (
	options: UseLineResolutionOptions
): UseLineResolutionResult => {
	const cursor = useCursor()

	const resolvedLineId = createMemo(() => {
		const vr = options.virtualRow()
		const lineId = vr.lineId
		if (lineId > 0) return lineId

		const idx = vr.index
		if (idx >= 0) {
			const resolved = cursor.lines.getLineId(idx)
			if (resolved > 0) return resolved
		}

		return lineId
	})

	const lineIndex = createMemo(() => {
		const lineId = resolvedLineId()
		if (lineId > 0) {
			const resolved = cursor.lines.getLineIndex(lineId)
			if (resolved >= 0) return resolved
		}

		const rawIndex = options.virtualRow().index
		if (rawIndex < 0) return -1
		const displayToLine = options.displayToLine()
		return displayToLine ? displayToLine(rawIndex) : rawIndex
	})

	const isLineValid = createMemo(() => {
		const idx = lineIndex()
		const count = cursor.lines.lineCount()
		return idx >= 0 && idx < count
	})

	const lineText = createMemo(() => {
		const memoStart = performance.now()
		const lineId = resolvedLineId()
		let result: string
		if (lineId > 0) {
			result = cursor.lines.getLineTextById(lineId)
		} else if (!isLineValid()) {
			result = ''
		} else {
			result = cursor.lines.getLineText(lineIndex())
		}
		lineTextRunCount++
		lineTextTotalTime += performance.now() - memoStart
		maybeReportLineTextStats()
		return result
	})

	return {
		resolvedLineId,
		lineIndex,
		isLineValid,
		lineText,
	}
}
