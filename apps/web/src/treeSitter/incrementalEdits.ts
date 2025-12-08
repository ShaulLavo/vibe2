import type { DocumentIncrementalEdit } from '@repo/code-editor'
import { applyTreeSitterEdit } from './workerClient'

export const sendIncrementalTreeEdit = (
	path: string | undefined,
	edit: DocumentIncrementalEdit
) => {
	if (!path) return undefined
	const highlightPromise = applyTreeSitterEdit({
		path,
		startIndex: edit.startIndex,
		oldEndIndex: edit.oldEndIndex,
		newEndIndex: edit.newEndIndex,
		startPosition: edit.startPosition,
		oldEndPosition: edit.oldEndPosition,
		newEndPosition: edit.newEndPosition,
		insertedText: edit.insertedText
	})
	if (!highlightPromise) return undefined
	return highlightPromise.catch(error => {
		console.error('[Tree-sitter worker] incremental edit failed', error)
		return undefined
	})
}
