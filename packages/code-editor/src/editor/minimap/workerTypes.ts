/**
 * Minimap Renderer Worker Types
 *
 * Defines message types for communication between the main thread and the minimap renderer worker.
 */

export type MinimapMode = 'blocks' | 'text'

export type MinimapSize = {
	cssWidth: number
	cssHeight: number
	dpr: number
	deviceWidth: number
	deviceHeight: number
}

export type MinimapLayout = {
	mode: MinimapMode
	minimapLineHeightCss: number
	maxChars: number
	paddingXCss: number
	size: MinimapSize
}

/**
 * Line data for rendering - sent from main thread to worker
 */
export type MinimapLineData = {
	/** Model line index */
	index: number
	/** Non-whitespace density (0-1) */
	density: number
	/** Packed RGBA color for this line */
	color: number
}

/**
 * Initialize the renderer with the OffscreenCanvas
 */
export type RendererInitMessage = {
	type: 'init'
	canvas: OffscreenCanvas
	layout: MinimapLayout
	/** Color palette for rendering (colorId -> packed RGBA) */
	palette?: Uint32Array
}

/**
 * Update layout (resize, DPR change)
 */
export type RendererLayoutMessage = {
	type: 'layout'
	layout: MinimapLayout
}

/**
 * Update color palette
 */
export type RendererPaletteMessage = {
	type: 'palette'
	palette: Uint32Array
}

/**
 * Render lines with the provided data (object array format)
 */
export type RendererRenderMessage = {
	type: 'render'
	lines: MinimapLineData[]
	lineCount: number
}

/**
 * Render from binary token summary (compact format from Tree-sitter)
 * This is the efficient path - uses transferable Uint8Arrays.
 */
export type RendererRenderSummaryMessage = {
	type: 'render-summary'
	/** Line densities (0-255 per line) */
	densities: Uint8Array
	/** Color IDs per line (0-255, index into palette) */
	colorIds: Uint8Array
	/** Total line count */
	lineCount: number
}

/**
 * Clear the canvas
 */
export type RendererClearMessage = {
	type: 'clear'
}

/**
 * Dispose the worker
 */
export type RendererDisposeMessage = {
	type: 'dispose'
}

export type MinimapWorkerMessage =
	| RendererInitMessage
	| RendererLayoutMessage
	| RendererPaletteMessage
	| RendererRenderMessage
	| RendererRenderSummaryMessage
	| RendererClearMessage
	| RendererDisposeMessage

/**
 * Response from the worker
 */
export type MinimapWorkerResponse = {
	type: 'ready' | 'rendered' | 'error'
	error?: string
}
