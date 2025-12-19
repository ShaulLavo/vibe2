import { describe, expect, it } from 'vitest'
import { Lexer, LexState } from '@repo/lexer'

describe('Lexer.tokenizeLine (regex literals)', () => {
	it('does not treat \\/\\* inside a regex literal as a block comment', () => {
		const lexer = Lexer.create()
		const line = "basename: path => path && path.match(/([^\\/]+|\\/)\\/*$/)[1],"

		const { tokens, endState } = lexer.tokenizeLine(line, Lexer.initialState())

		expect(endState.lexState).toBe(LexState.Normal)
		expect(tokens.some((t) => t.scope === 'comment.block')).toBe(false)
		expect(tokens.some((t) => t.scope === 'string.regex')).toBe(true)
	})
})

