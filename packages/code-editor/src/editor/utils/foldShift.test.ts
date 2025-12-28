import { describe, expect, it } from 'vitest'
import { shiftFoldRanges } from './foldShift'
import type { FoldRange, HighlightOffset } from '../types'

describe('shiftFoldRanges', () => {
	describe('no offsets', () => {
		it('returns original folds when offsets is undefined', () => {
			const folds: FoldRange[] = [
				{ startLine: 2, endLine: 5, type: 'function' },
			]
			expect(shiftFoldRanges(folds, undefined)).toBe(folds)
		})

		it('returns original folds when offsets is empty', () => {
			const folds: FoldRange[] = [
				{ startLine: 2, endLine: 5, type: 'function' },
			]
			expect(shiftFoldRanges(folds, [])).toBe(folds)
		})

		it('returns undefined when folds is undefined', () => {
			const offsets: HighlightOffset[] = [
				{
					charDelta: 1,
					lineDelta: 1,
					fromCharIndex: 10,
					fromLineRow: 2,
					oldEndRow: 2,
					newEndRow: 3,
					oldEndIndex: 10,
					newEndIndex: 11,
				},
			]
			expect(shiftFoldRanges(undefined, offsets)).toBeUndefined()
		})
	})

	describe('line insertion', () => {
		it('shifts folds after insertion point down', () => {
			const folds: FoldRange[] = [
				{ startLine: 5, endLine: 8, type: 'function' },
			]
			// Insert 2 lines at row 2
			const offsets: HighlightOffset[] = [
				{
					charDelta: 20,
					lineDelta: 2,
					fromCharIndex: 10,
					fromLineRow: 2,
					oldEndRow: 2,
					newEndRow: 4,
					oldEndIndex: 10,
					newEndIndex: 30,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([{ startLine: 7, endLine: 10, type: 'function' }])
		})

		it('expands fold that contains insertion point', () => {
			const folds: FoldRange[] = [
				{ startLine: 2, endLine: 8, type: 'function' },
			]
			// Insert 2 lines at row 4 (inside the fold)
			const offsets: HighlightOffset[] = [
				{
					charDelta: 20,
					lineDelta: 2,
					fromCharIndex: 40,
					fromLineRow: 4,
					oldEndRow: 4,
					newEndRow: 6,
					oldEndIndex: 40,
					newEndIndex: 60,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([{ startLine: 2, endLine: 10, type: 'function' }])
		})

		it('does not affect folds before insertion point', () => {
			const folds: FoldRange[] = [
				{ startLine: 2, endLine: 5, type: 'function' },
			]
			// Insert 2 lines at row 10
			const offsets: HighlightOffset[] = [
				{
					charDelta: 20,
					lineDelta: 2,
					fromCharIndex: 100,
					fromLineRow: 10,
					oldEndRow: 10,
					newEndRow: 12,
					oldEndIndex: 100,
					newEndIndex: 120,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([{ startLine: 2, endLine: 5, type: 'function' }])
		})

		it('shifts fold down when inserting at the start of fold line', () => {
			const folds: FoldRange[] = [
				{ startLine: 5, endLine: 10, type: 'function' },
			]
			// Insert new line at the very start of line 5 (Enter at column 0)
			// This pushes the fold content (opening bracket) down to line 6
			const offsets: HighlightOffset[] = [
				{
					charDelta: 1,
					lineDelta: 1,
					fromCharIndex: 50, // Start of line 5
					fromLineRow: 5,
					oldEndRow: 5, // Single-point insertion
					newEndRow: 6,
					oldEndIndex: 50,
					newEndIndex: 51,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			// Fold should shift down because the content moved down
			expect(result).toEqual([{ startLine: 6, endLine: 11, type: 'function' }])
		})
	})

	describe('line deletion', () => {
		it('shifts folds after deletion point up', () => {
			const folds: FoldRange[] = [
				{ startLine: 8, endLine: 12, type: 'function' },
			]
			// Delete 2 lines at row 2-3
			const offsets: HighlightOffset[] = [
				{
					charDelta: -20,
					lineDelta: -2,
					fromCharIndex: 10,
					fromLineRow: 2,
					oldEndRow: 4,
					newEndRow: 2,
					oldEndIndex: 30,
					newEndIndex: 10,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([{ startLine: 6, endLine: 10, type: 'function' }])
		})

		it('shrinks fold that contains deletion point', () => {
			const folds: FoldRange[] = [
				{ startLine: 2, endLine: 10, type: 'function' },
			]
			// Delete 2 lines at row 4-5 (inside the fold)
			const offsets: HighlightOffset[] = [
				{
					charDelta: -20,
					lineDelta: -2,
					fromCharIndex: 40,
					fromLineRow: 4,
					oldEndRow: 6,
					newEndRow: 4,
					oldEndIndex: 60,
					newEndIndex: 40,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([{ startLine: 2, endLine: 8, type: 'function' }])
		})

		it('does not affect folds before deletion point', () => {
			const folds: FoldRange[] = [
				{ startLine: 2, endLine: 5, type: 'function' },
			]
			// Delete 2 lines at row 10-11
			const offsets: HighlightOffset[] = [
				{
					charDelta: -20,
					lineDelta: -2,
					fromCharIndex: 100,
					fromLineRow: 10,
					oldEndRow: 12,
					newEndRow: 10,
					oldEndIndex: 120,
					newEndIndex: 100,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([{ startLine: 2, endLine: 5, type: 'function' }])
		})
	})

	describe('multiple offsets', () => {
		it('applies multiple offsets in sequence', () => {
			const folds: FoldRange[] = [
				{ startLine: 10, endLine: 15, type: 'function' },
			]
			// First insert 2 lines at row 2, then delete 1 line at row 20
			const offsets: HighlightOffset[] = [
				{
					charDelta: 20,
					lineDelta: 2,
					fromCharIndex: 10,
					fromLineRow: 2,
					oldEndRow: 2,
					newEndRow: 4,
					oldEndIndex: 10,
					newEndIndex: 30,
				},
				{
					charDelta: -10,
					lineDelta: -1,
					fromCharIndex: 200,
					fromLineRow: 20,
					oldEndRow: 21,
					newEndRow: 20,
					oldEndIndex: 210,
					newEndIndex: 200,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			// Fold shifted from 10-15 to 12-17 by first offset
			// Second offset at row 20 doesn't affect the fold at 12-17
			expect(result).toEqual([{ startLine: 12, endLine: 17, type: 'function' }])
		})
	})

	describe('multiple folds', () => {
		it('shifts all affected folds', () => {
			const folds: FoldRange[] = [
				{ startLine: 2, endLine: 5, type: 'imports' },
				{ startLine: 8, endLine: 15, type: 'function' },
				{ startLine: 20, endLine: 25, type: 'class' },
			]
			// Insert 3 lines at row 10 (inside second fold)
			const offsets: HighlightOffset[] = [
				{
					charDelta: 30,
					lineDelta: 3,
					fromCharIndex: 100,
					fromLineRow: 10,
					oldEndRow: 10,
					newEndRow: 13,
					oldEndIndex: 100,
					newEndIndex: 130,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([
				{ startLine: 2, endLine: 5, type: 'imports' }, // before edit - unchanged
				{ startLine: 8, endLine: 18, type: 'function' }, // contains edit - expanded
				{ startLine: 23, endLine: 28, type: 'class' }, // after edit - shifted
			])
		})
	})

	describe('edge cases', () => {
		it('handles zero lineDelta (same-line edit)', () => {
			const folds: FoldRange[] = [
				{ startLine: 5, endLine: 10, type: 'function' },
			]
			const offsets: HighlightOffset[] = [
				{
					charDelta: 5,
					lineDelta: 0,
					fromCharIndex: 50,
					fromLineRow: 7,
					oldEndRow: 7,
					newEndRow: 7,
					oldEndIndex: 55,
					newEndIndex: 60,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			expect(result).toEqual([{ startLine: 5, endLine: 10, type: 'function' }])
		})

		it('preserves folds within deleted region at edit point', () => {
			const folds: FoldRange[] = [
				{ startLine: 6, endLine: 7, type: 'small' }, // Fold starts within deleted region
			]
			// Delete lines 5-8
			const offsets: HighlightOffset[] = [
				{
					charDelta: -40,
					lineDelta: -4,
					fromCharIndex: 50,
					fromLineRow: 5,
					oldEndRow: 9,
					newEndRow: 5,
					oldEndIndex: 90,
					newEndIndex: 50,
				},
			]

			const result = shiftFoldRanges(folds, offsets)
			// Fold is relocated to the edit point (optimistic update)
			// When tree-sitter re-parses, the correct fold will be provided
			expect(result).toEqual([{ startLine: 5, endLine: 6, type: 'small' }])
		})
	})
})
