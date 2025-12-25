import { describe, expect, it } from 'vitest'
import type { DocumentIncrementalEdit } from '@repo/code-editor'
import { getShiftableWhitespaceEditKind } from './shiftableEdits'

const baseEdit: DocumentIncrementalEdit = {
	startIndex: 0,
	oldEndIndex: 0,
	newEndIndex: 0,
	startPosition: { row: 0, column: 0 },
	oldEndPosition: { row: 0, column: 0 },
	newEndPosition: { row: 0, column: 0 },
	deletedText: '',
	insertedText: '',
}

const makeEdit = (
	overrides: Partial<DocumentIncrementalEdit>
): DocumentIncrementalEdit => ({
	...baseEdit,
	...overrides,
})

describe('getShiftableWhitespaceEditKind', () => {
	it('returns insert for whitespace-only insertion', () => {
		const edit = makeEdit({
			startIndex: 5,
			oldEndIndex: 5,
			newEndIndex: 7,
			insertedText: '  ',
		})

		expect(getShiftableWhitespaceEditKind(edit)).toBe('insert')
	})

	it('returns delete for whitespace-only deletion', () => {
		const edit = makeEdit({
			startIndex: 3,
			oldEndIndex: 6,
			newEndIndex: 3,
			deletedText: '\n\t',
		})

		expect(getShiftableWhitespaceEditKind(edit)).toBe('delete')
	})

	it('ignores non-whitespace insertions', () => {
		const edit = makeEdit({
			startIndex: 1,
			oldEndIndex: 1,
			newEndIndex: 2,
			insertedText: 'x',
		})

		expect(getShiftableWhitespaceEditKind(edit)).toBeNull()
	})

	it('ignores non-whitespace deletions', () => {
		const edit = makeEdit({
			startIndex: 2,
			oldEndIndex: 3,
			newEndIndex: 2,
			deletedText: 'y',
		})

		expect(getShiftableWhitespaceEditKind(edit)).toBeNull()
	})

	it('ignores replacements', () => {
		const edit = makeEdit({
			startIndex: 4,
			oldEndIndex: 5,
			newEndIndex: 5,
			deletedText: 'z',
			insertedText: ' ',
		})

		expect(getShiftableWhitespaceEditKind(edit)).toBeNull()
	})

	it('ignores empty edits', () => {
		expect(getShiftableWhitespaceEditKind(baseEdit)).toBeNull()
	})
})
