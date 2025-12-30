import { describe, expect, it } from 'vitest'
import { shouldResetWidthScan } from './createTextEditorLayout'

describe('shouldResetWidthScan', () => {
	it('resets when tab size changes', () => {
		expect(shouldResetWidthScan(4, 2)).toBe(true)
	})

	it('does not reset when tab size is unchanged', () => {
		expect(shouldResetWidthScan(2, 2)).toBe(false)
	})
})
