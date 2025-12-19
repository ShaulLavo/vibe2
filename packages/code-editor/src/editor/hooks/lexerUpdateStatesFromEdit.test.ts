import { describe, expect, it } from 'vitest'
import { Lexer } from '@repo/lexer'

describe('Lexer.updateStatesFromEdit', () => {
	it('propagates through inserted lines before early-stopping', () => {
		const lexer = Lexer.create()

		const original = ['const a = 1', 'const b = 2'].join('\n')
		lexer.computeAllStates(original)

		const updatedLines = ['const a = 1', '{', '', 'const b = 2']
		const updated = updatedLines.join('\n')

		lexer.updateStatesFromEdit(
			0,
			(lineIndex) => updatedLines[lineIndex] ?? '',
			updatedLines.length
		)

		const expected = Lexer.create().computeAllStates(updated)

		expect(lexer.getAllLineStates()).toEqual(expected)
		expect(lexer.getLineState(3)?.bracketDepth).toBe(1)
	})

	it('handles inserting a newline that splits a line', () => {
		const lexer = Lexer.create()

		const originalLines = ['const x = { a: 1, b: 2 }', 'const y = 1']
		lexer.computeAllStates(originalLines.join('\n'))

		const updatedLines = ['const x = {', ' a: 1, b: 2 }', 'const y = 1']

		lexer.updateStatesFromEdit(
			0,
			(lineIndex) => updatedLines[lineIndex] ?? '',
			updatedLines.length
		)

		const expected = Lexer.create().computeAllStates(updatedLines.join('\n'))

		expect(lexer.getAllLineStates()).toEqual(expected)
		expect(lexer.getLineState(1)?.bracketDepth).toBe(1)
	})

	it('handles deleting a newline that merges lines', () => {
		const lexer = Lexer.create()

		const originalLines = ['const x = {', ' a: 1, b: 2 }', 'const y = 1']
		lexer.computeAllStates(originalLines.join('\n'))

		const updatedLines = ['const x = { a: 1, b: 2 }', 'const y = 1']

		lexer.updateStatesFromEdit(
			0,
			(lineIndex) => updatedLines[lineIndex] ?? '',
			updatedLines.length
		)

		const expected = Lexer.create().computeAllStates(updatedLines.join('\n'))

		expect(lexer.getAllLineStates()).toEqual(expected)
		expect(lexer.getLineState(1)?.bracketDepth).toBe(0)
	})

	it('matches computeAllStates after repeated newline insertions', () => {
		const lexer = Lexer.create()

		let lines = [
			'export const a = () => {',
			"\tconst basename = (path: string) => path && path.match(/([^\\\\/]+|\\\\/)\\\\/*$/)[1]",
			'\tconst tpl = `hello',
			'\tworld`',
			'\tif (basename(tpl)) {',
			'\t\treturn ({ a: [1, 2, 3] })',
			'\t}',
			'}',
		]

		lexer.computeAllStates(lines.join('\n'))

		const getReturnLineIndex = () =>
			lines.findIndex((line) => line.includes('return ({ a: [1, 2, 3] })'))

		// Simulate pressing Enter at the end of a line, three times.
		for (let i = 0; i < 3; i++) {
			const editedLineIndex = 2 + i
			lines = [
				...lines.slice(0, editedLineIndex + 1),
				'',
				...lines.slice(editedLineIndex + 1),
			]

			lexer.updateStatesFromEdit(
				editedLineIndex,
				(lineIndex) => lines[lineIndex] ?? '',
				lines.length
			)

			const expected = Lexer.create().computeAllStates(lines.join('\n'))
			expect(lexer.getAllLineStates()).toEqual(expected)
		}

		const returnLineIndex = getReturnLineIndex()
		expect(returnLineIndex).toBeGreaterThan(0)

		const expectedFinal = Lexer.create().computeAllStates(lines.join('\n'))
		expect(lexer.getLineState(returnLineIndex)?.bracketDepth).toBe(
			expectedFinal[returnLineIndex]?.bracketDepth
		)
		expect(lexer.getLineState(lines.length - 1)?.bracketDepth).toBe(
			expectedFinal[lines.length - 1]?.bracketDepth
		)
	})

	it('matches computeAllStates when inserting 3 new lines in a single edit', () => {
		const lexer = Lexer.create()

		const originalLines = [
			'export const a = () => {',
			'\tif (true) {',
			'\t\treturn ({ a: [1, 2, 3] })',
			'\t}',
			'}',
		]
		lexer.computeAllStates(originalLines.join('\n'))

		const updatedLines = [
			...originalLines.slice(0, 1),
			'',
			'',
			'',
			...originalLines.slice(1),
		]

		lexer.updateStatesFromEdit(
			0,
			(lineIndex) => updatedLines[lineIndex] ?? '',
			updatedLines.length
		)

		const expected = Lexer.create().computeAllStates(updatedLines.join('\n'))
		expect(lexer.getAllLineStates()).toEqual(expected)
	})
})
