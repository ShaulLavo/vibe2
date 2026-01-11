import type { DocumentIncrementalEdit } from '@repo/code-editor'
import type {
	TreeSitterParseResult,
	TreeSitterEditPayload,
} from '../workers/treeSitter/types'
import { applyTreeSitterEditBatch } from './workerClient'

const DEBOUNCE_MS = 50

let debounceTimeout: ReturnType<typeof setTimeout> | null = null
let pendingEdits: {
	path: string
	edits: Omit<TreeSitterEditPayload, 'path'>[]
} | null = null
let pendingResolve:
	| ((result: TreeSitterParseResult | undefined) => void)
	| null = null
let currentRequestId = 0
let pendingBatchStartedAt = 0
let pendingBatchId = 0

export const sendIncrementalTreeEdit = (
	path: string | undefined,
	edit: DocumentIncrementalEdit
): Promise<TreeSitterParseResult | undefined> | undefined => {
	if (!path) return undefined

	const editPayload: Omit<TreeSitterEditPayload, 'path'> = {
		startIndex: edit.startIndex,
		oldEndIndex: edit.oldEndIndex,
		newEndIndex: edit.newEndIndex,
		startPosition: edit.startPosition,
		oldEndPosition: edit.oldEndPosition,
		newEndPosition: edit.newEndPosition,
		insertedText: edit.insertedText,
	}

	if (pendingEdits && pendingEdits.path !== path) {
		if (debounceTimeout) {
			clearTimeout(debounceTimeout)
			debounceTimeout = null
		}
		pendingResolve?.(undefined)
		pendingEdits = null
		pendingResolve = null
	}

	if (pendingEdits && pendingEdits.path === path) {
		pendingEdits.edits.push(editPayload)
	} else {
		pendingEdits = { path, edits: [editPayload] }
		pendingBatchStartedAt = performance.now()
		pendingBatchId += 1
	}

	if (debounceTimeout) {
		clearTimeout(debounceTimeout)
	}

	return new Promise((resolve) => {
		if (pendingResolve) {
			pendingResolve(undefined)
		}
		pendingResolve = resolve

		debounceTimeout = setTimeout(() => {
			debounceTimeout = null
			const batch = pendingEdits!
			pendingEdits = null
			pendingResolve = null

			const batchStartedAt = pendingBatchStartedAt || performance.now()
			const batchId = pendingBatchId
			const editCount = batch.edits.length

			const requestId = ++currentRequestId
			const requestStartedAt = performance.now()

			applyTreeSitterEditBatch(batch.path, batch.edits)
				.then((result) => {
					if (requestId === currentRequestId) {
						resolve(result)
					} else {
						resolve(undefined)
					}
				})
				.catch(() => {
					resolve(undefined)
				})
		}, DEBOUNCE_MS)
	})
}

export const clearPendingTreeEdit = () => {
	if (debounceTimeout) {
		clearTimeout(debounceTimeout)
		debounceTimeout = null
	}
	pendingEdits = null
	pendingResolve?.(undefined)
	pendingResolve = null

	currentRequestId++
}
