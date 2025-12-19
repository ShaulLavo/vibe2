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

	it('handles large number of highlights using spatial index', () => {
		createRoot((dispose) => {
			const lexer = Lexer.create()

			// Generate many highlights properly sorted
			const largeHighlights = Array.from({ length: 5000 }, (_, i) => ({
				startIndex: i * 10,
				endIndex: i * 10 + 5,
				scope: 'variable',
			}))

				const [highlights] = createSignal(largeHighlights)

				const { getLineHighlights } = createLineHighlights({
					lexer,
					highlights,
				})

			// Test a line in the middle
			// Line corresponds to index 2500 -> start char 25000
			const entry = {
				index: 0,
				start: 25000,
				length: 100,
				text: ' '.repeat(100),
			}
			const segments = getLineHighlights(entry)

			// Should return highlights falling in range [25000, 25100]
			// i=2500 -> 25000-25005 (in range)
			// i=2501 -> 25010-25015 (in range)
			// ...
			// i=2510 -> 25100-25105 (touching end)

			expect(segments.length).toBeGreaterThan(0)

			const firstSegment = segments[0]
			expect(firstSegment).toBeDefined()
			expect(firstSegment!.scope).toBe('variable')

			dispose()
		})
	})
})
