export { Editor } from './components/Editor'
export type * from './types'
export * from './theme/bracketColors'

// SCM parser and quick lexer utilities
export { parseScmQuery, mergeScmRules } from './utils/scmParser'
export {
	createQuickLexer,
	quickTokenizeLine,
	quickTokensToSegments,
	LexState,
} from './utils/quickLexer'
export type { QuickToken } from './utils/quickLexer'
export type { ScmRules } from './utils/scmParser'
