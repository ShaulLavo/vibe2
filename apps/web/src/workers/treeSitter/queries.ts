import type { Tree } from 'web-tree-sitter'
import type { TreeSitterCapture, FoldRange, SyntaxNode } from './types'
import { queryCache } from './parser'

export const runHighlightQueries = (
	tree: Tree,
	languageId: string
): TreeSitterCapture[] => {
	const queries = queryCache.get(languageId)?.highlight || []
	if (!queries.length) return []

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
					captureName,
				})
			}
		}
	}
	results.sort((a, b) => a.startIndex - b.startIndex || a.endIndex - b.endIndex)
	return results
}

/**
 * Check if a node type requires a block body to be foldable.
 * Returns true if the node has substantive content to fold.
 */
const hasFoldableBody = (node: NonNullable<SyntaxNode>): boolean => {
	const type = node.type

	// Arrow functions: only foldable if body is a statement_block
	if (type === 'arrow_function') {
		const body = node.childForFieldName('body')
		return body?.type === 'statement_block'
	}

	// Control flow statements: only foldable if they have a statement_block
	const controlFlowTypes = [
		'if_statement',
		'for_statement',
		'for_in_statement',
		'while_statement',
		'do_statement',
	]

	if (controlFlowTypes.includes(type)) {
		// Check for any statement_block child (consequence, body, etc.)
		for (let i = 0; i < node.childCount; i++) {
			const child = node.child(i)
			if (child?.type === 'statement_block') {
				// Additionally check that the block has content (not just `{}`)
				// A block with just `{` and `}` has 2 or fewer children
				// and the named children count will be 0
				if (child.namedChildCount > 0) {
					return true
				}
			}
		}
		return false
	}

	// All other node types are foldable by default
	return true
}

export const runFoldQueries = (tree: Tree, languageId: string): FoldRange[] => {
	const queries = queryCache.get(languageId)?.fold || []
	if (!queries.length) return []

	const results: FoldRange[] = []
	const seen = new Set<string>()

	for (const query of queries) {
		for (const match of query.matches(tree.rootNode)) {
			for (const capture of match.captures) {
				const node = capture.node
				const startLine = node.startPosition.row
				const endLine = node.endPosition.row
				if (endLine <= startLine) continue

				// Check if node has actual foldable content
				if (!hasFoldableBody(node)) continue

				const key = `${startLine}:${endLine}:${node.type}`
				if (seen.has(key)) continue
				seen.add(key)
				results.push({
					startLine,
					endLine,
					type: node.type,
				})
			}
		}
	}

	results.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine)
	return results
}
