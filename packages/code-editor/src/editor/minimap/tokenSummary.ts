/**
 * Minimap Token Summary Types
 *
 * Compact binary format for passing minimap rendering data between workers.
 * Uses typed arrays for efficient transfer/serialization.
 */

/**
 * Scope to colorId mapping.
 * Keep colorId space small (0-255) for packed representation.
 */
export const MINIMAP_SCOPE_TO_COLOR_ID: Record<string, number> = {
	// Keywords
	keyword: 1,
	'keyword.declaration': 1,
	'keyword.modifier': 1,
	'keyword.control': 2,
	'keyword.operator': 3,

	// Types
	type: 4,
	'type.builtin': 4,

	// Functions
	function: 5,
	'function.method': 5,
	'function.builtin': 5,

	// Variables
	variable: 6,
	'variable.parameter': 6,
	'variable.builtin': 7,

	// Constants
	constant: 8,
	'constant.builtin': 8,

	// Strings
	string: 9,
	'string.escape': 9,

	// Numbers
	number: 10,

	// Comments
	comment: 11,
	'comment.block': 11,

	// Punctuation
	punctuation: 12,
	'punctuation.bracket': 12,
	'punctuation.delimiter': 12,

	// Operators
	operator: 13,

	// Properties
	property: 14,

	// Errors
	error: 15,
	missing: 16,

	// Default
	default: 0,
}

/**
 * Default color palette (packed RGBA, little-endian: 0xAABBGGRR when read as Uint32)
 * Colors are designed to be visible on dark backgrounds.
 */
export const MINIMAP_DEFAULT_PALETTE = new Uint32Array([
	0xd9e4e4e7, // 0: default - zinc-300 with alpha
	0xfff472b6, // 1: keyword - pink-400
	0xfff472b6, // 2: keyword.control - pink-400
	0xfff472b6, // 3: keyword.operator - pink-400
	0xff38bdf8, // 4: type - sky-400
	0xff34d399, // 5: function - emerald-400
	0xfff8fafc, // 6: variable - slate-50
	0xfffdba74, // 7: variable.builtin - orange-300
	0xfffacc15, // 8: constant - yellow-400
	0xffa5f3fc, // 9: string - cyan-200
	0xfffcd34d, // 10: number - amber-300
	0xff6b7280, // 11: comment - gray-500
	0xff9ca3af, // 12: punctuation - gray-400
	0xfff472b6, // 13: operator - pink-400
	0xff94a3b8, // 14: property - slate-400
	0xffef4444, // 15: error - red-500
	0xfffacc15, // 16: missing/warning - yellow-400
])

/**
 * Minimap token summary - compact per-line data.
 * Fixed stride array for character-level color sampling.
 */
export type MinimapTokenSummary = {
	/**
	 * Token color data (index into palette).
	 * Stride is `maxChars`.
	 * `tokens[line * maxChars + char]` = colorId
	 * 0 = empty space / whitespace
	 */
	tokens: Uint8Array
	/** Maximum characters sampled per line (stride) */
	maxChars: number
	/** Number of lines */
	lineCount: number
	/** Document version (for staleness checks) */
	version: number
}

/**
 * Message to request minimap token summary from Tree-sitter worker
 */
export type MinimapSummaryRequest = {
	type: 'minimap/request-summary'
	path: string
	version: number
	/** Line range to compute (inclusive). If omitted, compute all lines. */
	startLine?: number
	endLine?: number
}

/**
 * Response with minimap token summary
 */
export type MinimapSummaryResponse = {
	type: 'minimap/summary'
	path: string
	version: number
	summary: MinimapTokenSummary
}

/**
 * Incremental update after edit
 */
export type MinimapSummaryUpdate = {
	type: 'minimap/update'
	path: string
	version: number
	/** Start of dirty range */
	dirtyStartLine: number
	/** End of dirty range (inclusive) */
	dirtyEndLine: number
	/** Updated densities for dirty range */
	densities: Uint8Array
	/** Updated colorIds for dirty range */
	colorIds: Uint8Array
}

/**
 * Compute density for a line (0-255 scaled)
 */
export const computeLineDensityPacked = (
	text: string,
	maxChars: number
): number => {
	const length = Math.min(text.length, maxChars)
	if (length <= 0) return 0

	let nonWhitespace = 0
	for (let i = 0; i < length; i++) {
		const code = text.charCodeAt(i)
		if (code === 32 || code === 9 || code === 13 || code === 10) continue
		nonWhitespace++
	}

	return Math.round((nonWhitespace / length) * 255)
}

/**
 * Get colorId for a scope name
 */
export const getScopeColorId = (scope: string): number => {
	// Try exact match first
	const exact = MINIMAP_SCOPE_TO_COLOR_ID[scope]
	if (exact !== undefined) return exact

	// Try prefix match (e.g., "keyword.declaration" -> "keyword")
	const dot = scope.indexOf('.')
	if (dot > 0) {
		const prefix = scope.slice(0, dot)
		const prefixMatch = MINIMAP_SCOPE_TO_COLOR_ID[prefix]
		if (prefixMatch !== undefined) return prefixMatch
	}

	return 0 // default
}

/**
 * Create an empty token summary for the given line count
 */
export const createEmptyTokenSummary = (
	lineCount: number,
	maxChars: number,
	version: number
): MinimapTokenSummary => {
	const totalBytes = lineCount * maxChars
	return {
		tokens: new Uint8Array(totalBytes),
		maxChars,
		lineCount,
		version,
	}
}

// ============================================================================
// Transferable & SharedArrayBuffer Utilities
// ============================================================================

/**
 * Check if SharedArrayBuffer is available
 * (requires COOP/COEP headers to be set)
 */
export const isSharedArrayBufferAvailable = (): boolean => {
	return typeof SharedArrayBuffer !== 'undefined'
}

/**
 * Create a token summary using SharedArrayBuffer (zero-copy shared memory)
 * Falls back to regular ArrayBuffer if SharedArrayBuffer is not available.
 */
export const createSharedTokenSummary = (
	lineCount: number,
	maxChars: number,
	version: number
): MinimapTokenSummary => {
	if (isSharedArrayBufferAvailable()) {
		// Use SharedArrayBuffer for true zero-copy between workers
		const totalBytes = lineCount * maxChars
		const buffer = new SharedArrayBuffer(totalBytes)
		return {
			tokens: new Uint8Array(buffer),
			maxChars,
			lineCount,
			version,
		}
	}
	// Fallback to regular arrays (can be transferred)
	return createEmptyTokenSummary(lineCount, maxChars, version)
}

/**
 * Get transferable ArrayBuffers from a token summary.
 * Use with postMessage(data, getTransferables(summary)).
 *
 * Note: After transfer, the original arrays become "neutered" (empty).
 * Only use for one-way transfer when you don't need the data anymore.
 */
export const getTransferables = (
	summary: MinimapTokenSummary
): ArrayBuffer[] => {
	// SharedArrayBuffer cannot be transferred, only shared
	if (summary.tokens.buffer instanceof SharedArrayBuffer) {
		return []
	}

	return [summary.tokens.buffer as ArrayBuffer]
}

/**
 * Clone a token summary (creates new buffers).
 * Use when you need to keep the original after transfer.
 */
export const cloneTokenSummary = (
	summary: MinimapTokenSummary
): MinimapTokenSummary => {
	return {
		tokens: new Uint8Array(summary.tokens),
		maxChars: summary.maxChars,
		lineCount: summary.lineCount,
		version: summary.version,
	}
}

/**
 * Create a compact token summary with both arrays in a single buffer.
 * More efficient for transfer (single buffer to transfer).
 */
export const createCompactTokenSummary = (
	lineCount: number,
	maxChars: number,
	version: number
): MinimapTokenSummary => {
	// Single buffer just for tokens
	const totalBytes = lineCount * maxChars
	const buffer = new ArrayBuffer(totalBytes)
	return {
		tokens: new Uint8Array(buffer),
		maxChars,
		lineCount,
		version,
	}
}

/**
 * Serialize token summary to a single transferable buffer.
 * Format: [4 bytes lineCount][4 bytes version][densities...][colorIds...]
 */
export const serializeTokenSummary = (
	summary: MinimapTokenSummary
): ArrayBuffer => {
	const headerSize = 12 // 4 bytes lineCount + 4 bytes maxChars + 4 bytes version
	const totalBytes = summary.lineCount * summary.maxChars
	const buffer = new ArrayBuffer(headerSize + totalBytes)
	const view = new DataView(buffer)

	view.setUint32(0, summary.lineCount, true) // little-endian
	view.setUint32(4, summary.maxChars, true)
	view.setUint32(8, summary.version, true)

	const tokens = new Uint8Array(buffer, headerSize, totalBytes)
	tokens.set(summary.tokens)

	return buffer
}

/**
 * Deserialize token summary from a buffer.
 */
export const deserializeTokenSummary = (
	buffer: ArrayBuffer
): MinimapTokenSummary => {
	const view = new DataView(buffer)
	const lineCount = view.getUint32(0, true)
	const maxChars = view.getUint32(4, true)
	const version = view.getUint32(8, true)

	const headerSize = 12
	const totalBytes = lineCount * maxChars

	return {
		tokens: new Uint8Array(buffer, headerSize, totalBytes),
		maxChars,
		lineCount,
		version,
	}
}
