import type { LineHighlightSegment, BracketInfo } from '../types'
import type { ScmRules } from './scmParser'

// Bracket pair mappings
const BRACKET_PAIRS: Record<string, string> = {
	'(': ')',
	'[': ']',
	'{': '}',
}
const OPEN_BRACKETS = new Set(Object.keys(BRACKET_PAIRS))
const CLOSE_BRACKETS = new Set(Object.values(BRACKET_PAIRS))

/**
 * Quick lexer token output
 */
export type QuickToken = {
	start: number
	end: number
	scope: string
}

/**
 * Lexer states for tracking multi-line constructs
 */
export const enum LexState {
	Normal,
	String,
	Template,
	LineComment,
	BlockComment,
}

// Regex patterns
const WORD_CHAR = /[a-zA-Z0-9_$]/
const DIGIT = /[0-9]/
const HEX_DIGIT = /[0-9a-fA-F]/

/**
 * Check if identifier is SCREAMING_CASE (all uppercase with underscores)
 */
const isScreamingCase = (s: string): boolean =>
	s.length > 1 && /^[A-Z][A-Z0-9_]+$/.test(s)

/**
 * Create a quick lexer from SCM rules
 */
export const createQuickLexer = (rules: ScmRules) => {
	const { keywords, regexRules } = rules

	/**
	 * Get scope for an identifier using SCM-derived rules
	 */
	const getIdentifierScope = (
		word: string,
		prevChar: string,
		nextNonSpace: string,
		afterDot: boolean
	): string | null => {
		// First check if it's a keyword from SCM
		const keywordScope = keywords.get(word)
		if (keywordScope) return keywordScope

		// Apply regex rules from SCM (like PascalCase → type)
		for (const rule of regexRules) {
			if (rule.pattern.test(word)) {
				// Context-sensitive refinements
				if (rule.scope === 'type' || rule.scope === 'constructor') {
					if (prevChar === ':' || prevChar === '<') return 'type'
					if (nextNonSpace === '<') return 'type'
					if (nextNonSpace === '(') return 'function'
					return 'type'
				}
				return rule.scope
			}
		}

		// SCREAMING_CASE → constant
		if (isScreamingCase(word)) return 'constant'

		// Function/method call heuristics
		if (nextNonSpace === '(') {
			return afterDot ? 'function.method' : 'function'
		}

		// Property access
		if (afterDot) return 'property'

		// Default variable
		return 'variable'
	}

	/**
	 * Tokenize a single line
	 */
	const tokenizeLine = (
		line: string,
		initialState: LexState = LexState.Normal,
		initialBracketDepth: number = 0,
		lineStartOffset: number = 0
	): {
		tokens: QuickToken[]
		brackets: BracketInfo[]
		endState: LexState
		endBracketDepth: number
	} => {
		const tokens: QuickToken[] = []
		const brackets: BracketInfo[] = []
		let state = initialState
		let bracketDepth = initialBracketDepth
		let i = 0
		const len = line.length

		const peekNextNonSpace = (from: number): string => {
			for (let j = from; j < len; j++) {
				const c = line[j]
				if (c !== ' ' && c !== '\t') return c!
			}
			return ''
		}

		const peekPrevNonSpace = (from: number): string => {
			for (let j = from - 1; j >= 0; j--) {
				const c = line[j]
				if (c !== ' ' && c !== '\t') return c!
			}
			return ''
		}

		while (i < len) {
			const c = line[i]!
			const next = i + 1 < len ? line[i + 1] : ''

			// Handle block comment continuation
			if (state === LexState.BlockComment) {
				const start = i
				while (i < len) {
					if (line[i] === '*' && i + 1 < len && line[i + 1] === '/') {
						i += 2
						state = LexState.Normal
						break
					}
					i++
				}
				tokens.push({ start, end: i, scope: 'comment.block' })
				continue
			}

			// Handle template literal continuation
			if (state === LexState.Template) {
				const start = i
				while (i < len) {
					if (line[i] === '\\' && i + 1 < len) {
						i += 2
						continue
					}
					if (line[i] === '`') {
						i++
						state = LexState.Normal
						break
					}
					if (line[i] === '$' && i + 1 < len && line[i + 1] === '{') {
						i += 2
						let braceDepth = 1
						while (i < len && braceDepth > 0) {
							if (line[i] === '{') braceDepth++
							else if (line[i] === '}') braceDepth--
							i++
						}
						continue
					}
					i++
				}
				if (start < i) {
					tokens.push({ start, end: i, scope: 'string' })
				}
				continue
			}

			// Line comment
			if (c === '/' && next === '/') {
				tokens.push({ start: i, end: len, scope: 'comment' })
				return {
					tokens,
					brackets,
					endState: LexState.Normal,
					endBracketDepth: bracketDepth,
				}
			}

			// Block comment start
			if (c === '/' && next === '*') {
				const start = i
				i += 2
				while (i < len) {
					if (line[i] === '*' && i + 1 < len && line[i + 1] === '/') {
						i += 2
						break
					}
					i++
				}
				tokens.push({ start, end: i, scope: 'comment.block' })
				if (i >= len && !(line[len - 2] === '*' && line[len - 1] === '/')) {
					return {
						tokens,
						brackets,
						endState: LexState.BlockComment,
						endBracketDepth: bracketDepth,
					}
				}
				continue
			}

			// String literals
			if (c === '"' || c === "'") {
				const quote = c
				const start = i
				i++
				while (i < len) {
					if (line[i] === '\\' && i + 1 < len) {
						i += 2
						continue
					}
					if (line[i] === quote) {
						i++
						break
					}
					i++
				}
				tokens.push({ start, end: i, scope: 'string' })
				continue
			}

			// Template literal
			if (c === '`') {
				const start = i
				i++
				while (i < len) {
					if (line[i] === '\\' && i + 1 < len) {
						i += 2
						continue
					}
					if (line[i] === '`') {
						i++
						break
					}
					if (line[i] === '$' && i + 1 < len && line[i + 1] === '{') {
						i += 2
						let braceDepth = 1
						while (i < len && braceDepth > 0) {
							if (line[i] === '{') braceDepth++
							else if (line[i] === '}') braceDepth--
							i++
						}
						continue
					}
					i++
				}
				tokens.push({ start, end: i, scope: 'string' })
				if (i >= len && line[len - 1] !== '`') {
					return {
						tokens,
						brackets,
						endState: LexState.Template,
						endBracketDepth: bracketDepth,
					}
				}
				continue
			}

			// Numbers
			if (DIGIT.test(c) || (c === '.' && next && DIGIT.test(next))) {
				const start = i
				if (c === '0' && (next === 'x' || next === 'X')) {
					i += 2
					while (i < len && HEX_DIGIT.test(line[i]!)) i++
				} else {
					while (i < len && (DIGIT.test(line[i]!) || line[i] === '.')) i++
					if (i < len && (line[i] === 'e' || line[i] === 'E')) {
						i++
						if (i < len && (line[i] === '+' || line[i] === '-')) i++
						while (i < len && DIGIT.test(line[i]!)) i++
					}
				}
				if (i < len && line[i] === 'n') i++
				tokens.push({ start, end: i, scope: 'number' })
				continue
			}

			// Identifiers/keywords
			if (WORD_CHAR.test(c)) {
				const start = i
				while (i < len && WORD_CHAR.test(line[i]!)) i++
				const word = line.slice(start, i)
				const prevChar = peekPrevNonSpace(start)
				const nextChar = peekNextNonSpace(i)
				const afterDot = prevChar === '.'

				const scope = getIdentifierScope(word, prevChar, nextChar, afterDot)
				if (scope) {
					tokens.push({ start, end: i, scope })
				}
				continue
			}

			// JSX tag detection
			if (c === '<' && next && /[A-Z]/.test(next)) {
				i++
				const start = i
				while (i < len && WORD_CHAR.test(line[i]!)) i++
				tokens.push({ start, end: i, scope: 'type' })
				continue
			}

			// Brackets - track them for depth coloring
			if (OPEN_BRACKETS.has(c)) {
				bracketDepth++
				brackets.push({
					index: lineStartOffset + i,
					char: c,
					depth: bracketDepth,
				})
				i++
				continue
			}

			if (CLOSE_BRACKETS.has(c)) {
				const depth = bracketDepth > 0 ? bracketDepth : 1
				brackets.push({
					index: lineStartOffset + i,
					char: c,
					depth,
				})
				if (bracketDepth > 0) bracketDepth--
				i++
				continue
			}

			i++
		}

		return { tokens, brackets, endState: state, endBracketDepth: bracketDepth }
	}

	return { tokenizeLine, getIdentifierScope }
}

/**
 * Convert quick tokens to LineHighlightSegment format
 */
export const quickTokensToSegments = (
	tokens: QuickToken[],
	getClass: (scope: string) => string | undefined
): LineHighlightSegment[] => {
	const segments: LineHighlightSegment[] = []
	for (const token of tokens) {
		const className = getClass(token.scope)
		if (className) {
			segments.push({
				start: token.start,
				end: token.end,
				className,
				scope: token.scope,
			})
		}
	}
	return segments
}

// Default lexer with built-in rules (fallback if no SCM loaded)
const DEFAULT_KEYWORDS = new Map([
	['const', 'keyword.declaration'],
	['let', 'keyword.declaration'],
	['var', 'keyword.declaration'],
	['function', 'keyword.declaration'],
	['class', 'keyword.declaration'],
	['import', 'keyword.import'],
	['export', 'keyword.import'],
	['from', 'keyword.import'],
	['as', 'keyword.import'],
	['default', 'keyword.import'],
	['type', 'keyword.type'],
	['interface', 'keyword.type'],
	['if', 'keyword.control'],
	['else', 'keyword.control'],
	['return', 'keyword.control'],
	['for', 'keyword.control'],
	['while', 'keyword.control'],
	['try', 'keyword.control'],
	['catch', 'keyword.control'],
	['await', 'keyword.control'],
	['async', 'keyword.control'],
	['true', 'constant.builtin'],
	['false', 'constant.builtin'],
	['null', 'constant.builtin'],
	['undefined', 'constant.builtin'],
	['this', 'constant.builtin'],
])

const DEFAULT_REGEX_RULES = [
	{ pattern: /^[A-Z]/, scope: 'type' }, // PascalCase
]

const DEFAULT_RULES: ScmRules = {
	keywords: DEFAULT_KEYWORDS,
	regexRules: DEFAULT_REGEX_RULES,
	nodeTypes: new Map(),
}

/**
 * Default quick lexer with built-in TypeScript/JavaScript rules
 */
export const defaultQuickLexer = createQuickLexer(DEFAULT_RULES)

/**
 * Convenience: tokenize a line using default rules
 */
export const quickTokenizeLine = defaultQuickLexer.tokenizeLine
