import { expose } from 'comlink'
import { Parser, Language, Query, Tree } from 'web-tree-sitter'
import type {
	TreeSitterWorkerApi,
	TreeSitterEditPayload,
	TreeSitterCapture
} from './treeSitterWorkerTypes'
import jsHighlightsQuerySource from 'tree-sitter-javascript/queries/highlights.scm?raw'
import jsJsxHighlightsQuerySource from 'tree-sitter-javascript/queries/highlights-jsx.scm?raw'
import tsHighlightsQuerySource from 'tree-sitter-typescript/queries/highlights.scm?raw'

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
	jsHighlightsQuerySource,
	jsJsxHighlightsQuerySource,
	tsHighlightsQuerySource
].filter(Boolean)

const ensureHighlightQueries = async () => {
	if (highlightQueries.length > 0) return highlightQueries
	const parser = await ensureParser()
	if (!parser) return []
	const language = languageInstance ?? parser.language
	if (!language) return []
	const queries: Query[] = []
	for (const source of highlightQuerySources) {
		try {
			queries.push(new Query(language, source))
		} catch (error) {
			console.error('[Tree-sitter worker] failed to init query', error)
		}
	}
	highlightQueries = queries
	return highlightQueries
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
): Promise<TreeSitterCapture[] | undefined> => {
	const parser = await ensureParser()
	if (!parser) return undefined
	const tree = parser.parse(text)
	if (!tree) return undefined
	setCachedEntry(path, { tree, text })
	const highlights = await runHighlightQueries(tree)
	return highlights
}

const reparseWithEdit = async (
	path: string,
	payload: TreeSitterEditPayload
): Promise<TreeSitterCapture[] | undefined> => {
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
	const highlights = await runHighlightQueries(nextTree)
	return highlights
}

const api: TreeSitterWorkerApi = {
	async init() {
		await ensureParser()
	},
	async parse(source) {
		const parser = await ensureParser()
		const tree = parser?.parse(source)
			const results = await runHighlightQueries(tree ?? null)
		tree?.delete()
		return results
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
