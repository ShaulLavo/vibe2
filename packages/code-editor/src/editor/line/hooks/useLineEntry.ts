import { createMemo, type Accessor } from 'solid-js'

import { useCursor } from '../../cursor'
import type { LineEntry } from '../../types'

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
		if (
			prev &&
			prev.lineId === lineId &&
			prev.length === length &&
			prev.text === text
		) {
			if (prev.index !== idx) prev.index = idx
			if (prev.start !== start) prev.start = start
			return prev
		}
		return {
			lineId,
			index: idx,
			start,
			length,
			text,
		}
	})
	return entry
}
