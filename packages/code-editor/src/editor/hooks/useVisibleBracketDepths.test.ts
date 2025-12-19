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

		const tokenBrackets = lexer.tokenizeLine(lines[1] ?? '', {
			...(lexer.getLineState(1) ?? Lexer.initialState()),
			offset: afterStart,
		}).brackets
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

	it('evicts least recently used items when cache is full', () => {
		const lexer = Lexer.create()
		const lineCache = createVisibleBracketDepthCache()
		const MAX_SIZE = 1000 // Internal constant in implementation

		const numLines = MAX_SIZE + 10
		const lines = Array(numLines).fill('{')
		const lexerStates = lexer.computeAllStates(lines.join('\n'))

		const computeForLine = (lineIndex: number) => {
			computeVisibleBracketDepths({
				lexer,
				lexerStates,
				virtualItems: [{ index: lineIndex, start: 0, size: 0 }],
				displayToLine: (d) => d,
				getLineStart: (l) => l * 2,
				getLineText: (l) => lines[l] ?? '',
				lineCache,
			})
		}

		// Fill cache to MAX_SIZE
		for (let i = 0; i < MAX_SIZE; i++) {
			computeForLine(i)
		}

		expect(lineCache.size).toBe(MAX_SIZE)
		expect(lineCache.has(0)).toBe(true)

		// Access line 0 again to make it MRU
		computeForLine(0)

		// Add one more line (MAX_SIZE) which should trigger eviction
		computeForLine(MAX_SIZE)

		expect(lineCache.size).toBe(MAX_SIZE)

		// Line 0 should still be cached because we refreshed it
		expect(lineCache.has(0)).toBe(true)

		// Line 1 should be evicted (it became LRU after 0 was refreshed)
		expect(lineCache.has(1)).toBe(false)

		// The new line should be cached
		expect(lineCache.has(MAX_SIZE)).toBe(true)
	})
})
