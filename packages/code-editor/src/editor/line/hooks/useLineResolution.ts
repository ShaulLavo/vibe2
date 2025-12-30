import { createMemo, type Accessor } from 'solid-js'

import { useCursor } from '../../cursor'
import type { VirtualItem2D } from '../../types'

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
		const lineId = resolvedLineId()
		if (lineId > 0) {
			return cursor.lines.getLineTextById(lineId)
		} else if (!isLineValid()) {
			return ''
		} else {
			return cursor.lines.getLineText(lineIndex())
		}
	})

	return {
		resolvedLineId,
		lineIndex,
		isLineValid,
		lineText,
	}
}
