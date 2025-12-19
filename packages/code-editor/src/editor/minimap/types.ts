import type { Accessor } from 'solid-js'
import type { EditorError } from '../types'

/**
 * Minimap Props
 *
 * Most rendering is handled by the minimap worker.
 * Main thread only needs scroll element for overlay positioning
 * and error markers for diagnostic display.
 */
export type MinimapProps = {
	/** Scroll element for calculating slider position */
	scrollElement: Accessor<HTMLDivElement | null>
	/** Optional errors for diagnostic markers on overlay */
	errors?: Accessor<EditorError[] | undefined>
	/** Tree-sitter worker for token summary data */
	treeSitterWorker?: Worker
	/** File path for Tree-sitter lookup */
	filePath?: string
	/** Document version for staleness check */
	version?: Accessor<number>
	// TODO: Add searchMatches prop when search feature is implemented
}
