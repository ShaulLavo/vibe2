import type { LineEntry, DocumentIncrementalEdit, EditorPoint } from '../types'

const clampOffsetToEntries = (lineEntries: LineEntry[], offset: number) => {
	if (lineEntries.length === 0) {
		return 0
	}

	const lastEntry = lineEntries[lineEntries.length - 1]!
	const documentEnd = lastEntry.start + lastEntry.length
	const positiveOffset = Math.max(0, offset)

	return Math.min(positiveOffset, documentEnd)
}

const offsetToPoint = (lineEntries: LineEntry[], offset: number): EditorPoint => {
	if (lineEntries.length === 0) {
		return { row: 0, column: 0 }
	}

	const lookupOffset = clampOffsetToEntries(lineEntries, offset)

	let low = 0
	let high = lineEntries.length - 1
	let foundIndex = 0

	while (low <= high) {
		const mid = (low + high) >> 1
		const entry = lineEntries[mid]!

		if (entry.start <= lookupOffset) {
			foundIndex = mid
			low = mid + 1
		} else {
			high = mid - 1
		}
	}

	const entry = lineEntries[foundIndex]!
	const relativeOffset = Math.max(0, lookupOffset - entry.start)
	const column = Math.min(relativeOffset, entry.text.length)

	return {
		row: entry.index,
		column
	}
}

const advancePointByText = (point: EditorPoint, text: string): EditorPoint => {
	if (text.length === 0) {
		return { row: point.row, column: point.column }
	}

	let row = point.row
	let column = point.column

	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (char === '\n') {
			row += 1
			column = 0
		} else {
			column += 1
		}
	}

	return { row, column }
}

export const describeIncrementalEdit = (
	lineEntries: LineEntry[],
	startIndex: number,
	deletedText: string,
	insertedText: string
): DocumentIncrementalEdit | null => {
	if (deletedText.length === 0 && insertedText.length === 0) {
		return null
	}

	const startPosition = offsetToPoint(lineEntries, startIndex)
	const oldEndIndex = startIndex + deletedText.length
	const oldEndPosition = offsetToPoint(lineEntries, oldEndIndex)
	const newEndIndex = startIndex + insertedText.length
	const newEndPosition = advancePointByText(startPosition, insertedText)

	return {
		startIndex,
		oldEndIndex,
		newEndIndex,
		startPosition,
		oldEndPosition,
		newEndPosition,
		deletedText,
		insertedText
	}
}
