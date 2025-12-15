/**
 * SCM Rules Loader
 * Loads and parses tree-sitter SCM highlight query files and creates a quick lexer.
 */

import { parseScmQuery, mergeScmRules, type ScmRules } from './scmParser'
import { createQuickLexer, type QuickToken, LexState } from './quickLexer'

// SCM file sources - these will be imported at build time
// For now, we'll use dynamic loading or raw imports from the app layer

let cachedRules: ScmRules | null = null
let cachedLexer: ReturnType<typeof createQuickLexer> | null = null

/**
 * Initialize the quick lexer with SCM rules from source strings
 */
export const initQuickLexerFromSources = (...sources: string[]) => {
	const rules = sources.map(parseScmQuery)
	cachedRules = mergeScmRules(...rules)
	cachedLexer = createQuickLexer(cachedRules)
	return cachedLexer
}

/**
 * Get the current quick lexer (or create default if not initialized)
 */
export const getQuickLexer = () => {
	if (!cachedLexer) {
		// Use default built-in rules if SCM not loaded
		const { defaultQuickLexer } = require('./quickLexer')
		return defaultQuickLexer
	}
	return cachedLexer
}

/**
 * Get current cached rules (for debugging/inspection)
 */
export const getCachedRules = () => cachedRules

/**
 * Quick tokenize a line using the current lexer
 */
export const quickTokenizeLine = (
	line: string,
	initialState: LexState = LexState.Normal
): { tokens: QuickToken[]; endState: LexState } => {
	return getQuickLexer().tokenizeLine(line, initialState)
}

/**
 * Reset the cached lexer (for testing or reloading)
 */
export const resetQuickLexer = () => {
	cachedRules = null
	cachedLexer = null
}

export { LexState }
export type { QuickToken }
