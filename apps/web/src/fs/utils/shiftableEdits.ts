import type { DocumentIncrementalEdit } from '@repo/code-editor'

export type ShiftableEditKind = 'insert' | 'delete'

const isWhitespaceOnly = (text: string) => /^\s*$/.test(text)

export const getShiftableWhitespaceEditKind = (
	edit: DocumentIncrementalEdit
): ShiftableEditKind | null => {
	const hasInsert = edit.insertedText.length > 0
	const hasDelete = edit.deletedText.length > 0

	if (hasInsert && !hasDelete) {
		if (edit.oldEndIndex !== edit.startIndex) return null
		return isWhitespaceOnly(edit.insertedText) ? 'insert' : null
	}

	if (hasDelete && !hasInsert) {
		if (edit.newEndIndex !== edit.startIndex) return null
		return isWhitespaceOnly(edit.deletedText) ? 'delete' : null
	}

	return null
}
