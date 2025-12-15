/**
 * Quick Lexer Initialization
 * Loads SCM highlight query files and initializes the quick lexer for fast syntax highlighting.
 */

// Import SCM sources as raw strings (via Vite's ?raw suffix)
import tsHighlightsSource from '../treeSitter/queries/typescript-highlights.scm?raw'
import jsHighlightsSource from '../treeSitter/queries/javascript-highlights.scm?raw'

// Import from main package entry which re-exports these
import {
	parseScmQuery,
	mergeScmRules,
	createQuickLexer,
} from '@repo/code-editor'

let initialized = false
let lexer: ReturnType<typeof createQuickLexer> | null = null

/**
 * Initialize the quick lexer with TypeScript/JavaScript highlight rules.
 * Should be called once at app startup.
 */
export const initQuickLexer = () => {
	if (initialized) return

	const tsRules = parseScmQuery(tsHighlightsSource)
	const jsRules = parseScmQuery(jsHighlightsSource)
	const rules = mergeScmRules(tsRules, jsRules)
	lexer = createQuickLexer(rules)

	initialized = true
	console.log('[QuickLexer] Initialized with SCM rules')
}

/**
 * Get the initialized quick lexer
 */
export const getQuickLexer = () => lexer

/**
 * Check if quick lexer is initialized
 */
export const isQuickLexerInitialized = () => initialized
