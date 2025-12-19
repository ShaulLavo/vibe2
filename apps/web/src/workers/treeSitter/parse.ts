import type { Tree } from 'web-tree-sitter'
import type {
	TreeSitterParseResult,
	TreeSitterEditPayload,
	LanguageId,
} from './types'
import { detectLanguage } from './constants'
import { astCache, setCachedEntry } from './cache'
import { ensureParser } from './parser'
import { runHighlightQueries, runFoldQueries } from './queries'
import { collectTreeData } from './treeWalk'
import {
	applyTextEdit,
	isShiftableEdit,
	getEditCharDelta,
	getEditLineDelta,
	shiftCaptures,
	shiftBrackets,
	shiftFolds,
} from './edits'
import { logger } from '../../logger'

const log = logger.withTag('treeSitter')
const textDecoder = new TextDecoder()

export const processTree = async (
	tree: Tree,
	languageId: string
): Promise<TreeSitterParseResult> => {
	const { brackets, errors } = collectTreeData(tree)
	const captures = runHighlightQueries(tree, languageId)
	const folds = runFoldQueries(tree, languageId)
	return {
		captures,
		folds,
		brackets,
		errors,
	}
}

export const parseAndCacheText = async (
	path: string,
	text: string
): Promise<TreeSitterParseResult | undefined> => {
	const languageId = detectLanguage(path)
	if (!languageId) return undefined

	const res = await ensureParser(languageId)
	if (!res) return undefined
	const { parser } = res

	const tree = parser.parse(text)
	if (!tree) return undefined
	const result = await processTree(tree, languageId)
	setCachedEntry(path, {
		tree,
		text,
		captures: result.captures,
		brackets: result.brackets,
		folds: result.folds,
		languageId,
	})
	return result
}

export const parseBufferAndCache = async (
	path: string,
	buffer: ArrayBuffer
): Promise<TreeSitterParseResult | undefined> => {
	const text = textDecoder.decode(new Uint8Array(buffer))
	return parseAndCacheText(path, text)
}

export const reparseWithEdit = async (
	path: string,
	payload: TreeSitterEditPayload
): Promise<TreeSitterParseResult | undefined> => {
	const cached = astCache.get(path)
	if (!cached) return undefined
	const { languageId } = cached

	const res = await ensureParser(languageId as LanguageId)
	if (!res) return undefined
	const { parser } = res

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
		newEndPosition: payload.newEndPosition,
	})

	const nextTree = parser.parse(updatedText, cached.tree)
	if (!nextTree) return undefined

	// Check if edit is shiftable
	const hasCachedData = cached.captures && cached.brackets && cached.folds
	const editIsShiftable =
		hasCachedData &&
		isShiftableEdit(
			payload.insertedText,
			payload.startIndex,
			payload.oldEndIndex
		)

	if (editIsShiftable) {
		const charDelta = getEditCharDelta(payload)
		const lineDelta = getEditLineDelta(payload)

		const shiftedCaptures = shiftCaptures(
			cached.captures!,
			payload.startIndex,
			charDelta
		)
		const shiftedBrackets = shiftBrackets(
			cached.brackets!,
			payload.startIndex,
			charDelta
		)
		const shiftedFolds = shiftFolds(
			cached.folds!,
			payload.startPosition.row,
			lineDelta
		)

		const { errors } = collectTreeData(nextTree)

		const result: TreeSitterParseResult = {
			captures: shiftedCaptures,
			brackets: shiftedBrackets,
			folds: shiftedFolds,
			errors,
		}

		setCachedEntry(path, {
			tree: nextTree,
			text: updatedText,
			captures: shiftedCaptures,
			brackets: shiftedBrackets,
			folds: shiftedFolds,
			languageId,
		})

		return result
	}

	// Full reparse with queries
	const result = await processTree(nextTree, languageId)
	setCachedEntry(path, {
		tree: nextTree,
		text: updatedText,
		captures: result.captures,
		brackets: result.brackets,
		folds: result.folds,
		languageId,
	})
	return result
}

export const reparseWithEditBatch = async (
	path: string,
	edits: Omit<TreeSitterEditPayload, 'path'>[]
): Promise<TreeSitterParseResult | undefined> => {
	if (edits.length === 0) return undefined
	const cached = astCache.get(path)
	if (!cached) {
		log.warn('[reparseWithEditBatch] No cached entry for path:', path)
		return undefined
	}
	const { languageId } = cached
	const res = await ensureParser(languageId as LanguageId)
	if (!res) return undefined
	const { parser } = res

	// Check if all edits are shiftable (whitespace-only insertions)
	const hasCachedData = cached?.captures && cached.brackets && cached.folds
	const allEditsShiftable =
		hasCachedData &&
		edits.every((edit) =>
			isShiftableEdit(edit.insertedText, edit.startIndex, edit.oldEndIndex)
		)

	let currentText = cached.text
	let currentTree = cached.tree

	// Apply each edit sequentially to both text and tree
	for (const edit of edits) {
		currentText = applyTextEdit(
			currentText,
			edit.startIndex,
			edit.oldEndIndex,
			edit.insertedText
		)

		currentTree.edit({
			startIndex: edit.startIndex,
			oldEndIndex: edit.oldEndIndex,
			newEndIndex: edit.newEndIndex,
			startPosition: edit.startPosition,
			oldEndPosition: edit.oldEndPosition,
			newEndPosition: edit.newEndPosition,
		})

		const nextTree = parser.parse(currentText, currentTree)
		if (!nextTree) return undefined

		// Clean up old tree if it's not the original cached one
		if (currentTree !== cached.tree) {
			currentTree.delete()
		}
		currentTree = nextTree
	}

	// If all edits were shiftable, use index shifting instead of re-querying
	if (allEditsShiftable) {
		let shiftedCaptures = cached.captures!
		let shiftedBrackets = cached.brackets!
		let shiftedFolds = cached.folds!

		let cumulativeCharDelta = 0
		let cumulativeLineDelta = 0

		for (const edit of edits) {
			const charDelta = getEditCharDelta(edit)
			const lineDelta = getEditLineDelta(edit)

			const adjustedIndex = edit.startIndex + cumulativeCharDelta
			const adjustedRow = edit.startPosition.row + cumulativeLineDelta

			shiftedCaptures = shiftCaptures(shiftedCaptures, adjustedIndex, charDelta)
			shiftedBrackets = shiftBrackets(shiftedBrackets, adjustedIndex, charDelta)
			shiftedFolds = shiftFolds(shiftedFolds, adjustedRow, lineDelta)

			cumulativeCharDelta += charDelta
			cumulativeLineDelta += lineDelta
		}

		// Walk tree for errors (still useful to update error locations)
		const { errors } = collectTreeData(currentTree)

		const result: TreeSitterParseResult = {
			captures: shiftedCaptures,
			brackets: shiftedBrackets,
			folds: shiftedFolds,
			errors,
		}

		setCachedEntry(path, {
			tree: currentTree,
			text: currentText,
			captures: shiftedCaptures,
			brackets: shiftedBrackets,
			folds: shiftedFolds,
			languageId,
		})

		return result
	}

	// Full reparse with queries
	const result = await processTree(currentTree, languageId)
	setCachedEntry(path, {
		tree: currentTree,
		text: currentText,
		captures: result.captures,
		brackets: result.brackets,
		folds: result.folds,
		languageId,
	})
	return result
}
