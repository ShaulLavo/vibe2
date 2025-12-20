import type { TreeSitterCapture, BracketInfo, FoldRange } from './types'

// Apply a text edit to a string
export const applyTextEdit = (
	text: string,
	startIndex: number,
	oldEndIndex: number,
	insertedText: string
) => text.slice(0, startIndex) + insertedText + text.slice(oldEndIndex)

/**
 * Determines if an edit can be handled by shifting indices
 * rather than re-running tree-sitter queries.
 * Safe for pure insertions of whitespace/newlines.
 */
export const isShiftableEdit = (
	insertedText: string,
	startIndex: number,
	oldEndIndex: number
): boolean => {
	const isInsertion = oldEndIndex === startIndex
	const isWhitespaceOnly = /^\s*$/.test(insertedText)
	const hasContent = insertedText.length > 0
	return isInsertion && isWhitespaceOnly && hasContent
}

export const getEditCharDelta = (edit: {
	insertedText: string
	newEndIndex?: number
	oldEndIndex?: number
}): number => {
	if (
		typeof edit.newEndIndex === 'number' &&
		typeof edit.oldEndIndex === 'number'
	) {
		return edit.newEndIndex - edit.oldEndIndex
	}

	return edit.insertedText.length
}

export const getEditLineDelta = (edit: {
	startPosition?: { row: number }
	oldEndPosition?: { row: number }
	newEndPosition?: { row: number }
}): number => {
	const startRow = edit.startPosition?.row
	const oldEndRow = edit.oldEndPosition?.row
	const newEndRow = edit.newEndPosition?.row

	const hasNewEndRow = typeof newEndRow === 'number'
	const hasOldEndRow = typeof oldEndRow === 'number'
	const hasStartRow = typeof startRow === 'number'

	if (hasNewEndRow && hasOldEndRow) return newEndRow - oldEndRow
	if (hasNewEndRow && hasStartRow) return newEndRow - startRow
	return 0
}

/**
 * Shifts capture indices after a text edit.
 */
export const shiftCaptures = (
	captures: TreeSitterCapture[],
	insertPosition: number,
	delta: number
): TreeSitterCapture[] => {
	return captures.map((capture) => {
		const startsAfterInsert = capture.startIndex >= insertPosition
		const endsAfterInsert = capture.endIndex > insertPosition

		const newStartIndex = startsAfterInsert
			? capture.startIndex + delta
			: capture.startIndex
		const newEndIndex = endsAfterInsert
			? capture.endIndex + delta
			: capture.endIndex

		return {
			...capture,
			startIndex: newStartIndex,
			endIndex: newEndIndex,
		}
	})
}

/**
 * Shifts bracket indices after a text edit.
 */
export const shiftBrackets = (
	brackets: BracketInfo[],
	insertPosition: number,
	delta: number
): BracketInfo[] => {
	return brackets.map((bracket) => {
		const isAfterInsert = bracket.index >= insertPosition
		const newIndex = isAfterInsert ? bracket.index + delta : bracket.index

		return {
			...bracket,
			index: newIndex,
		}
	})
}

/**
 * Shifts fold ranges after a line edit.
 * Filters out folds that become invalid (endLine <= startLine) after shifting.
 */
export const shiftFolds = (
	folds: FoldRange[],
	insertLineRow: number,
	lineDelta: number
): FoldRange[] => {
	return folds
		.map((fold) => {
			const startAfterInsert = fold.startLine >= insertLineRow
			const endAfterInsert = fold.endLine >= insertLineRow

			const newStartLine = startAfterInsert
				? fold.startLine + lineDelta
				: fold.startLine
			const newEndLine = endAfterInsert
				? fold.endLine + lineDelta
				: fold.endLine

			return {
				...fold,
				startLine: newStartLine,
				endLine: newEndLine,
			}
		})
		.filter((fold) => fold.endLine > fold.startLine)
}
