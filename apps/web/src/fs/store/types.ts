/**
 * Unified File State Store Types
 *
 * Defines the shape of file state in the unified store.
 * Each file has exactly one FileState entry that contains
 * all its data with freshness metadata.
 */

import type { Accessor } from 'solid-js'
import type { FilePath } from '@repo/fs'
import type { ParseResult, PieceTableSnapshot } from '@repo/utils'
import type { VisibleContentSnapshot } from '@repo/code-editor'
import type {
	TreeSitterCapture,
	BracketInfo,
	TreeSitterError,
	FoldRange,
} from '../../workers/treeSitter/types'
import type { Timestamped } from '../freshness'
import type { ViewMode } from '../types/ViewMode'

/**
 * Text edit operation for buffer updates.
 */
export interface TextEdit {
	readonly startOffset: number
	readonly endOffset: number
	readonly newText: string
}

/**
 * Transform for highlight offset adjustments.
 * Used when content changes to adjust highlight positions.
 */
export interface HighlightTransform {
	readonly charDelta: number
	readonly lineDelta: number
	readonly fromCharIndex: number
	readonly fromLineRow: number
	readonly oldEndRow: number
	readonly newEndRow: number
	readonly oldEndIndex: number
	readonly newEndIndex: number
}

/**
 * Scroll position within a file.
 */
export interface ScrollPosition {
	readonly lineIndex: number
	readonly scrollLeft: number
}

/**
 * Shared buffer for multi-tab editing.
 * This is the live content that editors read from and write to.
 */
export interface SharedBuffer {
	/** The file path */
	readonly filePath: FilePath

	/** Current content (reactive) */
	readonly content: Accessor<string>

	/** Version that increments on every content change */
	readonly contentVersion: Accessor<number>

	/** Set content directly (replaces entire buffer) */
	setContent: (content: string) => void

	/** Apply an edit from any tab */
	applyEdit: (edit: TextEdit) => Promise<void>

	/** Subscribe to edits */
	onEdit: (callback: (edit: TextEdit) => void) => () => void

	/** Dispose the buffer */
	dispose: () => void
}

/**
 * Loading state for a file.
 */
export type FileLoadingState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'loaded' }
	| { status: 'error'; error: Error }

/**
 * Tree-sitter derived data for syntax highlighting.
 */
export interface SyntaxData {
	readonly highlights: TreeSitterCapture[]
	readonly brackets: BracketInfo[]
	readonly folds: FoldRange[]
	readonly errors: TreeSitterError[]
}

/**
 * Per-file state in the unified store.
 *
 * Single source of truth for all file data.
 * No duplication - each piece of data lives here.
 */
export interface FileState {
	/** The file path (identity) */
	readonly path: FilePath

	// === Content (owned by editor) ===

	/** Live buffer for editing - null if file not opened */
	buffer: SharedBuffer | null

	/** Piece table snapshot for persistence - may be stale */
	pieceTable: Timestamped<PieceTableSnapshot> | null

	// === Metadata (owned by parser) ===

	/** File stats from parsing (line count, etc.) */
	stats: Timestamped<ParseResult> | null

	/** Syntax highlighting data from tree-sitter */
	syntax: Timestamped<SyntaxData> | null

	// === View State (owned by editor UI) ===

	/** Scroll position within the file */
	scrollPosition: Timestamped<ScrollPosition> | null

	/** Visible content snapshot for instant tab switching */
	visibleContent: Timestamped<VisibleContentSnapshot> | null

	/** Current view mode (text, hex, image, etc.) */
	viewMode: ViewMode | null

	// === Lifecycle ===

	/** Current loading state */
	loadingState: FileLoadingState

	/** When this file was last accessed */
	lastAccessed: number

	/** File modification time on disk (if known) */
	diskMtime: number | null

	/** Whether file has unsaved local changes */
	isDirty: boolean

	/** Preview bytes for binary files */
	previewBytes: Uint8Array | null

	/** Cached line start offsets for instant rendering */
	lineStarts: number[] | null
}

/**
 * Create an empty FileState for a path.
 */
export function createEmptyFileState(path: FilePath): FileState {
	return {
		path,
		buffer: null,
		pieceTable: null,
		stats: null,
		syntax: null,
		scrollPosition: null,
		visibleContent: null,
		viewMode: null,
		loadingState: { status: 'idle' },
		lastAccessed: Date.now(),
		diskMtime: null,
		isDirty: false,
		previewBytes: null,
		lineStarts: null,
	}
}

/**
 * Partial update to a FileState.
 * All fields are optional - only specified fields are updated.
 */
export type FileStateUpdate = Partial<Omit<FileState, 'path'>>

/**
 * Subscription callback for file state changes.
 */
export type FileStateSubscriber = (state: FileState) => void

/**
 * Events emitted by the file state store.
 */
export type FileStateEvent =
	| { type: 'created'; path: FilePath; state: FileState }
	| { type: 'updated'; path: FilePath; state: FileState; fields: (keyof FileState)[] }
	| { type: 'removed'; path: FilePath }

/**
 * Event handler for file state events.
 */
export type FileStateEventHandler = (event: FileStateEvent) => void
