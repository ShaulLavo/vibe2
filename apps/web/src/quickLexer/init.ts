/**
 * Lexer Initialization
 * Loads SCM highlight query files and initializes the lexer for fast syntax highlighting.
 */

// Import SCM sources as raw strings (via Vite's ?raw suffix)
import tsHighlightsSource from '../treeSitter/queries/typescript-highlights.scm?raw'
import jsHighlightsSource from '../treeSitter/queries/javascript-highlights.scm?raw'

// Import from main package entry
import { Lexer, parseScmQuery, mergeScmRules } from '@repo/code-editor'

let initialized = false
let lexer: Lexer | null = null

/**
 * Initialize the lexer with TypeScript/JavaScript highlight rules.
 * Should be called once at app startup.
 */
export const initLexer = () => {
	if (initialized) return lexer

	lexer = Lexer.fromScmSources(
		parseScmQuery,
		mergeScmRules,
		tsHighlightsSource,
		jsHighlightsSource
	)

	initialized = true
	console.log('[Lexer] Initialized with SCM rules')
	return lexer
}

/**
 * Get the initialized lexer
 */
export const getLexer = () => lexer

/**
 * Check if lexer is initialized
 */
export const isLexerInitialized = () => initialized
