import { expose } from 'comlink'
import { Parser, Language, Query, Tree } from 'web-tree-sitter'
import type {
	TreeSitterWorkerApi,
	TreeSitterEditPayload,
	TreeSitterCapture,
	BracketInfo,
	TreeSitterParseResult,
	TreeSitterError
} from './treeSitterWorkerTypes'
// Import highlight queries - custom ones + JSX from npm
import jsHighlightsQuerySource from '../treeSitter/queries/javascript-highlights.scm?raw'
import jsJsxHighlightsQuerySource from 'tree-sitter-javascript/queries/highlights-jsx.scm?raw'
import tsHighlightsQuerySource from '../treeSitter/queries/typescript-highlights.scm?raw'



type CachedTreeEntry = {
	tree: Tree
	text: string
}

let parserInstance: Parser | null = null
let parserInitPromise: Promise<void> | null = null
let languageInstance: Language | null = null
let highlightQueries: Query[] = []
const textDecoder = new TextDecoder()
const astCache = new Map<string, CachedTreeEntry>()

const locateWasm = () => '/tree-sitter/tree-sitter.wasm'
const tsxGrammarPath = '/tree-sitter/tree-sitter-tsx.wasm'

const ensureParser = async () => {
	if (!parserInitPromise) {
		parserInitPromise = (async () => {
			await Parser.init({ locateFile: locateWasm })
			const parser = new Parser()
				const tsLanguage = await Language.load(tsxGrammarPath)
				parser.setLanguage(tsLanguage)
				parserInstance = parser
				languageInstance = tsLanguage
				highlightQueries = []
		})().catch(error => {
			parserInitPromise = null
			console.error('[Tree-sitter worker demo] parser init failed', error)
			throw error
		})
	}

	await parserInitPromise
	return parserInstance
}

const applyTextEdit = (
	text: string,
	startIndex: number,
	oldEndIndex: number,
	insertedText: string
) => text.slice(0, startIndex) + insertedText + text.slice(oldEndIndex)

const setCachedEntry = (path: string, entry: CachedTreeEntry) => {
	const existing = astCache.get(path)
	if (existing && existing.tree !== entry.tree) {
		existing.tree.delete()
	}
	astCache.set(path, entry)
}

const highlightQuerySources = [
	tsHighlightsQuerySource,
	jsHighlightsQuerySource,
	jsJsxHighlightsQuerySource,
].filter(Boolean)

const ensureHighlightQueries = async () => {
	if (highlightQueries.length > 0) return highlightQueries
	const parser = await ensureParser()
	if (!parser) return []
	const language = languageInstance ?? parser.language
	if (!language) return []

	try {
		const source = highlightQuerySources.join('\n')
		highlightQueries = [new Query(language, source)]
	} catch (error) {
		console.error('[Tree-sitter worker] failed to init query', error)
		highlightQueries = []
	}
	return highlightQueries
}

// Bracket types we care about
const BRACKET_PAIRS: Record<string, string> = {
	'(': ')',
	'[': ']',
	'{': '}'
}

const OPEN_BRACKETS = new Set(Object.keys(BRACKET_PAIRS))
const CLOSE_BRACKETS = new Set(Object.values(BRACKET_PAIRS))

// Type alias for SyntaxNode (not directly exported from web-tree-sitter)
type SyntaxNode = ReturnType<Tree['rootNode']['child']>

const extractBrackets = (tree: Tree): BracketInfo[] => {
	const brackets: BracketInfo[] = []
	const stack: { char: string; index: number }[] = []

	const walk = (node: SyntaxNode) => {
		if (!node) return
		const type = node.type
		
		if (OPEN_BRACKETS.has(type)) {
			stack.push({ char: type, index: node.startIndex })
			brackets.push({
				index: node.startIndex,
				char: type,
				depth: stack.length
			})
		} else if (CLOSE_BRACKETS.has(type)) {
			const depth = stack.length > 0 ? stack.length : 1
			brackets.push({
				index: node.startIndex,
				char: type,
				depth
			})
			// Pop matching open bracket
			const last = stack[stack.length - 1]
			if (last && BRACKET_PAIRS[last.char] === type) {
				stack.pop()
			}
		}

		// Recurse into children
		for (let i = 0; i < node.childCount; i++) {
			walk(node.child(i)!)
		}
	}

	walk(tree.rootNode)
    if (brackets.length > 0) {
        console.log('[Tree-sitter worker] extracted brackets:', brackets.length, brackets[0])
    } else {
        console.log('[Tree-sitter worker] no brackets found')
    }
	return brackets
}

const extractErrors = (tree: Tree): TreeSitterError[] => {
	const errors: TreeSitterError[] = []

	const walk = (node: SyntaxNode) => {
		if (!node) return

		if (node.type === 'ERROR' || node.isMissing) {
			errors.push({
				startIndex: node.startIndex,
				endIndex: node.endIndex,
				isMissing: node.isMissing,
				message: node.type
			})
			return
		}

		if (node.hasError) {
			for (let i = 0; i < node.childCount; i++) {
				walk(node.child(i)!)
			}
		}
	}

	walk(tree.rootNode)
	return errors
}

const runHighlightQueries = async (
	tree: Tree | null
): Promise<TreeSitterCapture[] | undefined> => {
	if (!tree) return undefined
	const queries = await ensureHighlightQueries()
	if (!queries.length) return undefined
	const results: TreeSitterCapture[] = []
	const seen = new Set<string>()
	for (const query of queries) {
		for (const match of query.matches(tree.rootNode)) {
			for (const capture of match.captures) {
				const captureName = capture.name ?? ''
				const startIndex = capture.node.startIndex
				const endIndex = capture.node.endIndex
				const key = `${startIndex}:${endIndex}:${captureName}`
				if (seen.has(key)) continue
				seen.add(key)
				results.push({
					startIndex,
					endIndex,
					captureName
				})
			}
		}
	}
	return results
}

const parseAndCacheText = async (
	path: string,
	text: string
): Promise<TreeSitterParseResult | undefined> => {
	const parser = await ensureParser()
	if (!parser) return undefined
	const tree = parser.parse(text)
	if (!tree) return undefined
	setCachedEntry(path, { tree, text })
	const captures = await runHighlightQueries(tree)
	const brackets = extractBrackets(tree)
	const errors = extractErrors(tree)
	return { captures: captures ?? [], brackets, errors }
}

const reparseWithEdit = async (
	path: string,
	payload: TreeSitterEditPayload
): Promise<TreeSitterParseResult | undefined> => {
	const parser = await ensureParser()
	if (!parser) return undefined
	const cached = astCache.get(path)
	if (!cached) return undefined
	const updatedText = applyTextEdit(
		cached.text,
		payload.startIndex,
		payload.oldEndIndex,
		payload.insertedText
	)

	cached.tree.edit({
		startIndex: payload.startIndex,
		oldEndIndex: payload.oldEndIndex,
		newEndIndex: payload.newEndIndex,
		startPosition: payload.startPosition,
		oldEndPosition: payload.oldEndPosition,
		newEndPosition: payload.newEndPosition
	})

	const nextTree = parser.parse(updatedText, cached.tree)
	if (!nextTree) return undefined

	setCachedEntry(path, { tree: nextTree, text: updatedText })
	const captures = await runHighlightQueries(nextTree)
	const brackets = extractBrackets(nextTree)
	const errors = extractErrors(nextTree)
	return { captures: captures ?? [], brackets, errors }
}

const api: TreeSitterWorkerApi = {
	async init() {
		await ensureParser()
	},
	async parse(source) {
		const parser = await ensureParser()
		const tree = parser?.parse(source)
		if (!tree) return undefined
		const captures = await runHighlightQueries(tree)
		const brackets = extractBrackets(tree)
		const errors = extractErrors(tree)
		tree.delete()
		return { captures: captures ?? [], brackets, errors }
	},
	async parseBuffer(payload) {
		const text = textDecoder.decode(new Uint8Array(payload.buffer))
		return parseAndCacheText(payload.path, text)
	},
	async applyEdit(payload) {
		return reparseWithEdit(payload.path, payload)
	},
	async dispose() {
		parserInstance?.delete()
		parserInstance = null
		parserInitPromise = null
			for (const query of highlightQueries) {
				query.delete()
			}
			highlightQueries = []
		for (const entry of astCache.values()) {
			entry.tree.delete()
		}
		astCache.clear()
	}
}

expose(api)
