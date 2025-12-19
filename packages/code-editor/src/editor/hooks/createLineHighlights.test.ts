import { describe, expect, it } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
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

	it('updates highlights below edit when lexer state changes', () => {
		createRoot((dispose) => {
			const lexer = Lexer.create()

			const original = 'const x = 1; /*\nfoo\nbar'
			const initialStates = lexer.computeAllStates(original)
			const [lexerStates, setLexerStates] = createSignal(initialStates)

			const { getLineHighlights } = createLineHighlights({
				lexer,
				lexerStates,
			})

			const line1Start = original.indexOf('\n') + 1
			const entryLine1 = { index: 1, start: line1Start, length: 4, text: 'foo' }

			expect(
				getLineHighlights(entryLine1).some((segment) =>
					segment.scope.includes('comment.block')
				)
			).toBe(true)

			const cached = getLineHighlights(entryLine1)
			expect(cached).toBe(getLineHighlights(entryLine1))

			const updated = 'const x = 1; //\nfoo\nbar'
			const lines = updated.split('\n')
			const nextStates = lexer.updateStatesFromEdit(
				0,
				(lineIndex) => lines[lineIndex] ?? '',
				lines.length
			)
			setLexerStates(nextStates)

			expect(getLineHighlights(entryLine1)).not.toBe(cached)
			expect(
				getLineHighlights(entryLine1).some((segment) =>
					segment.scope.includes('variable')
				)
			).toBe(true)

			dispose()
		})
	})
})
