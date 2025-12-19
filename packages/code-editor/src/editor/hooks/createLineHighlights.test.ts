import { describe, expect, it } from 'vitest'
import { createRoot } from 'solid-js'
import { Lexer } from '@repo/lexer'
import { createLineHighlights } from './createLineHighlights'

describe('createLineHighlights', () => {
	it('invalidates cached line highlights when line text changes', () => {
		createRoot((dispose) => {
			const lexer = Lexer.create()
			const { getLineHighlights } = createLineHighlights({ lexer })

			const entryA = { index: 0, start: 0, length: 5, text: 'hello' }
			const segmentsA = getLineHighlights(entryA)
			expect(segmentsA.some((s) => s.scope.includes('variable'))).toBe(true)

			const segmentsA2 = getLineHighlights(entryA)
			expect(segmentsA2).toBe(segmentsA)

			const entryB = { index: 0, start: 0, length: 5, text: '12345' }
			const segmentsB = getLineHighlights(entryB)
			expect(segmentsB.some((s) => s.scope.includes('number'))).toBe(true)

			const segmentsB2 = getLineHighlights(entryB)
			expect(segmentsB2).toBe(segmentsB)

			dispose()
		})
	})
})

