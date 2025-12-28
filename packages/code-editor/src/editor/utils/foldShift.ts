import type { FoldRange, HighlightOffset } from '../types'

/**
 * Shift fold ranges based on edit offsets.
 * Similar to highlight offset logic, but operates on line numbers instead of character indices.
 *
 * When a line is added/removed, folds that start or end after the edit need to be shifted.
 */
export const shiftFoldRanges = (
	folds: FoldRange[] | undefined,
	offsets: HighlightOffset[] | undefined
): FoldRange[] | undefined => {
	if (!folds?.length || !offsets?.length) {
		return folds
	}

	const result: FoldRange[] = []

	for (const fold of folds) {
		let startLine = fold.startLine
		let endLine = fold.endLine

		for (const offset of offsets) {
			const lineDelta = offset.lineDelta
			const fromRow = offset.fromLineRow
			const oldEndRow = offset.oldEndRow
			const newEndRow = offset.newEndRow

			if (lineDelta === 0 && oldEndRow === newEndRow) {
				continue
			}

			if (endLine < fromRow) {
				continue
			}

			if (startLine > oldEndRow) {
				startLine += lineDelta
				endLine += lineDelta
				continue
			}

			const isInsertAtFoldStart =
				lineDelta > 0 && startLine === fromRow && oldEndRow === fromRow

			if (isInsertAtFoldStart) {
				startLine += lineDelta
				endLine += lineDelta
				continue
			}

			if (startLine <= fromRow) {
				if (endLine > oldEndRow) {
					endLine += lineDelta
				} else if (endLine >= fromRow && endLine <= oldEndRow) {
					if (lineDelta < 0) {
						endLine = Math.max(startLine + 1, newEndRow)
					} else {
						endLine = newEndRow
					}
				}
			} else {
				if (lineDelta > 0) {
					const shiftAmount = startLine - fromRow
					startLine = newEndRow + shiftAmount - (oldEndRow - fromRow)
					endLine += lineDelta
				} else {
					startLine = fromRow
					endLine = Math.max(startLine + 1, endLine + lineDelta)
				}
			}
		}

		if (endLine > startLine && startLine >= 0) {
			result.push({
				startLine,
				endLine,
				type: fold.type,
			})
		}
	}

	return result.length > 0 ? result : undefined
}
