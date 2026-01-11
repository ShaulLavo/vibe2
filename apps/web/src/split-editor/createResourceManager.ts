/**
 * Resource Manager
 *
 * Manages shared resources (tree-sitter workers, syntax highlighting, buffers)
 * across tabs showing the same file. Uses reference counting for cleanup.
 */

import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js'
import type { TabId } from './types'
import type {
	TreeSitterCapture,
	TreeSitterParseResult,
	BracketInfo,
	FoldRange,
	TreeSitterError,
} from '../workers/treeSitter/types'
import {
	ensureTreeSitterWorkerReady,
	parseBufferWithTreeSitter,
	applyTreeSitterEdit,
} from '../treeSitter/workerClient'
import type { TreeSitterEditPayload } from '../workers/treeSitter/types'

/** Text edit operation */
export interface TextEdit {
	startIndex: number
	oldEndIndex: number
	newEndIndex: number
	startPosition: { row: number; column: number }
	oldEndPosition: { row: number; column: number }
	newEndPosition: { row: number; column: number }
	insertedText: string
}

/** Highlight state for a file */
export interface HighlightState {
	captures: Accessor<TreeSitterCapture[]>
	brackets: Accessor<BracketInfo[]>
	folds: Accessor<FoldRange[]>
	errors: Accessor<TreeSitterError[]>
	setCaptures: (captures: TreeSitterCapture[]) => void
	setBrackets: (brackets: BracketInfo[]) => void
	setFolds: (folds: FoldRange[]) => void
	setErrors: (errors: TreeSitterError[]) => void
	updateFromParseResult: (result: TreeSitterParseResult) => void
}

/** Shared buffer for multi-tab editing */
export interface SharedBuffer {
	/** The file path */
	filePath: string

	/** Current content */
	content: Accessor<string>

	/** Set content directly */
	setContent: (content: string) => void

	/** Apply an edit from any tab */
	applyEdit: (edit: TextEdit) => Promise<void>

	/** Subscribe to edits */
	onEdit: (callback: (edit: TextEdit) => void) => () => void
}

/** Internal file resource entry */
interface FileResource {
	/** Tabs using this file */
	tabIds: Set<TabId>

	/** Shared buffer */
	buffer: SharedBuffer

	/** Highlight state */
	highlights: HighlightState

	/** Worker initialized flag */
	workerReady: boolean
}

/** Resource Manager interface */
export interface ResourceManager {
	/** Get shared buffer for a file */
	getBuffer: (filePath: string) => SharedBuffer | undefined

	/** Get highlight state for a file */
	getHighlightState: (filePath: string) => HighlightState | undefined

	/** Register a tab as using a file */
	registerTabForFile: (tabId: TabId, filePath: string) => void

	/** Unregister a tab from a file */
	unregisterTabFromFile: (tabId: TabId, filePath: string) => void

	/** Check if a file has resources */
	hasResourcesForFile: (filePath: string) => boolean

	/** Get tab count for a file */
	getTabCountForFile: (filePath: string) => number

	/** Get all tracked files */
	getTrackedFiles: () => string[]

	/** Cleanup all resources */
	cleanup: () => void

	// Legacy aliases for backward compatibility with tests
	registerPaneForFile: (paneId: string, filePath: string) => void
	unregisterPaneFromFile: (paneId: string, filePath: string) => void
	getPaneCountForFile: (filePath: string) => number
}

/** Apply text edit to content string */
function applyTextEdit(content: string, edit: TextEdit): string {
	const before = content.slice(0, edit.startIndex)
	const after = content.slice(edit.oldEndIndex)
	return before + edit.insertedText + after
}

/**
 * Create a shared buffer for a file
 *
 * The SharedBuffer provides signal-based content storage that coordinates
 * edits across multiple tabs showing the same file. When an edit is applied
 * from one tab, all other tabs are notified via the listener mechanism.
 */
function createSharedBuffer(filePath: string): SharedBuffer {
	// Signal-based content storage for reactivity
	const [content, setContent] = createSignal('')

	// Edit listeners for coordinating across panes
	const listeners = new Set<(edit: TextEdit) => void>()

	// Track edit version for ordering
	let editVersion = 0

	return {
		filePath,
		content,

		setContent(newContent: string) {
			setContent(newContent)
			editVersion++
		},

		async applyEdit(edit: TextEdit) {
			// Apply edit to content atomically
			const previousContent = content()
			const newContent = applyTextEdit(previousContent, edit)
			setContent(newContent)
			editVersion++

			// Notify all listeners (other tabs showing same file)
			// This allows tabs to update their view state accordingly
			listeners.forEach((cb) => {
				try {
					cb(edit)
				} catch (error) {
					console.error(
						`[SharedBuffer] Listener error for ${filePath}:`,
						error
					)
				}
			})

			// Send to tree-sitter worker for incremental re-parsing
			try {
				const payload: TreeSitterEditPayload = {
					path: filePath,
					startIndex: edit.startIndex,
					oldEndIndex: edit.oldEndIndex,
					newEndIndex: edit.newEndIndex,
					startPosition: edit.startPosition,
					oldEndPosition: edit.oldEndPosition,
					newEndPosition: edit.newEndPosition,
					insertedText: edit.insertedText,
				}

				await applyTreeSitterEdit(payload)
			} catch (error) {
				console.error(
					`[SharedBuffer] Tree-sitter edit failed for ${filePath}:`,
					error
				)
			}
		},

		onEdit(callback) {
			listeners.add(callback)
			return () => {
				listeners.delete(callback)
			}
		},
	}
}

/**
 * Create highlight state for a file
 *
 * Provides reactive signals for syntax highlighting data that can be
 * shared across multiple tabs showing the same file.
 */
function createHighlightStateForFile(): HighlightState {
	const [captures, setCaptures] = createSignal<TreeSitterCapture[]>([])
	const [brackets, setBrackets] = createSignal<BracketInfo[]>([])
	const [folds, setFolds] = createSignal<FoldRange[]>([])
	const [errors, setErrors] = createSignal<TreeSitterError[]>([])

	return {
		captures,
		brackets,
		folds,
		errors,
		setCaptures,
		setBrackets,
		setFolds,
		setErrors,
		updateFromParseResult(result: TreeSitterParseResult) {
			setCaptures(result.captures)
			setBrackets(result.brackets)
			setFolds(result.folds)
			setErrors(result.errors)
		},
	}
}

/** Create the resource manager */
export function createResourceManager(): ResourceManager {
	// Track resources per file
	const resources = new Map<string, FileResource>()

	/** Get or create resources for a file */
	function getOrCreateResource(filePath: string): FileResource {
		let resource = resources.get(filePath)
		if (!resource) {
			resource = {
				tabIds: new Set(),
				buffer: createSharedBuffer(filePath),
				highlights: createHighlightStateForFile(),
				workerReady: false,
			}
			resources.set(filePath, resource)
		}
		return resource
	}

	/** Initialize worker for a file */
	async function initializeWorkerForFile(
		filePath: string,
		resource: FileResource
	): Promise<void> {
		if (resource.workerReady) return

		try {
			await ensureTreeSitterWorkerReady()
			resource.workerReady = true
		} catch (error) {
			console.error(
				`[ResourceManager] Failed to initialize worker for ${filePath}:`,
				error
			)
		}
	}

	/** Register a tab as using a file */
	function registerTabForFile(tabId: TabId, filePath: string): void {
		const resource = getOrCreateResource(filePath)
		resource.tabIds.add(tabId)

		// Initialize worker lazily
		void initializeWorkerForFile(filePath, resource)
	}

	/** Unregister a tab from a file */
	function unregisterTabFromFile(tabId: TabId, filePath: string): void {
		const resource = resources.get(filePath)
		if (!resource) return

		resource.tabIds.delete(tabId)

		// Cleanup if no more tabs using this file
		if (resource.tabIds.size === 0) {
			resources.delete(filePath)
		}
	}

	/** Get shared buffer for a file */
	function getBuffer(filePath: string): SharedBuffer | undefined {
		return resources.get(filePath)?.buffer
	}

	/** Get highlight state for a file */
	function getHighlightState(filePath: string): HighlightState | undefined {
		return resources.get(filePath)?.highlights
	}

	/** Check if a file has resources */
	function hasResourcesForFile(filePath: string): boolean {
		return resources.has(filePath)
	}

	/** Get tab count for a file */
	function getTabCountForFile(filePath: string): number {
		return resources.get(filePath)?.tabIds.size ?? 0
	}

	/** Get all tracked files */
	function getTrackedFiles(): string[] {
		return Array.from(resources.keys())
	}

	/** Cleanup all resources */
	function cleanup(): void {
		resources.clear()
	}

	return {
		getBuffer,
		getHighlightState,
		registerTabForFile,
		unregisterTabFromFile,
		hasResourcesForFile,
		getTabCountForFile,
		getTrackedFiles,
		cleanup,
		// Legacy aliases for backward compatibility with tests
		registerPaneForFile: registerTabForFile,
		unregisterPaneFromFile: unregisterTabFromFile,
		getPaneCountForFile: getTabCountForFile,
	}
}

export type { TreeSitterCapture, BracketInfo, FoldRange, TreeSitterError }
