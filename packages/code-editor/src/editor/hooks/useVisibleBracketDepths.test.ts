import { describe, expect, it } from 'vitest'
import { Lexer } from '@repo/lexer'
import type { VirtualItem } from '../types'
import {
	computeVisibleBracketDepths,
	createVisibleBracketDepthCache,
} from './useVisibleBracketDepths'

describe('useVisibleBracketDepths', () => {
	it('invalidates cached brackets when line start offset changes', () => {
		const lexer = Lexer.create()
		const lineCache = createVisibleBracketDepthCache()

		let lines = ['{', '()']
		let lineStarts = [0, (lines[0]?.length ?? 0) + 1]

		let lexerStates = lexer.computeAllStates(lines.join('\n'))

		const virtualItems: VirtualItem[] = [{ index: 1, start: 0, size: 0 }]

		const compute = () =>
			computeVisibleBracketDepths({
				lexer,
				lexerStates,
				virtualItems,
				displayToLine: (displayIndex) => displayIndex,
				getLineStart: (lineIndex) => lineStarts[lineIndex] ?? 0,
				getLineText: (lineIndex) => lines[lineIndex] ?? '',
				lineCache,
			})

		const beforeStart = lineStarts[1] ?? 0
		const before = compute()
		expect(before).toBeDefined()
		expect(before![beforeStart]).toBe(2)
		expect(before![beforeStart + 1]).toBe(2)

		lines = ['x{', '()']
		lineStarts = [0, (lines[0]?.length ?? 0) + 1]
		lexerStates = lexer.updateStatesFromEdit(
			0,
			(lineIndex) => lines[lineIndex] ?? '',
			lines.length
		)

		const afterStart = lineStarts[1] ?? 0
		expect(afterStart).toBe(beforeStart + 1)

		const tokenBrackets = lexer.tokenizeLine(
			lines[1] ?? '',
			{
				...(lexer.getLineState(1) ?? Lexer.initialState()),
				offset: afterStart,
			}
		).brackets
		expect(tokenBrackets.map((b) => b.index)).toEqual([
			afterStart,
			afterStart + 1,
		])

		const after = compute()
		expect(after).toBeDefined()
		const afterKeys = Object.keys(after!).sort((a, b) => Number(a) - Number(b))
		expect(afterKeys).toEqual([String(afterStart), String(afterStart + 1)])
		expect(after![afterStart]).toBe(2)
		expect(after![afterStart + 1]).toBe(2)
		expect(after![beforeStart]).toBeUndefined()
	})
})
