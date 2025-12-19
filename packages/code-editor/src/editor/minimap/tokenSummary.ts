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
 * For color #RRGGBB, pack as 0xFFBBGGRR
 * Colors matched to editor theme from highlights.ts
 */
export const MINIMAP_DEFAULT_PALETTE = new Uint32Array([
	0xd9e7e4e4, // 0: default - zinc-300 (#e4e4e7) with alpha 0xd9
	0xfffa8ba7, // 1: keyword - violet-400 (#a78bfa)
	0xffb7e76e, // 2: keyword.control - emerald-300 (#6ee7b7)
	0xffb7e76e, // 3: keyword.operator - emerald-300 (#6ee7b7)
	0xfffcd37d, // 4: type - sky-300 (#7dd3fc)
	0xffd3cdfe, // 5: function - rose-200 (#fecdd3)
	0xffe7e4e4, // 6: variable - zinc-200 (#e4e4e7)
	0xff74bafd, // 7: variable.builtin - orange-300 (#fdba74)
	0xfffcabf0, // 8: constant - fuchsia-300 (#f0abfc)
	0xff8ae6fd, // 9: string - amber-200 (#fde68a)
	0xfffed2c7, // 10: number - indigo-200 (#c7d2fe)
	0xff7a7171, // 11: comment - zinc-500 (#71717a)
	0xffd8d4d4, // 12: punctuation - zinc-300 (#d4d4d8)
	0xffb7e76e, // 13: operator - emerald-300
	0xffffd5e9, // 14: property - purple-200 (#e9d5ff)
	0xff4444ef, // 15: error - red-500 (#ef4444)
	0xff15ccfa, // 16: missing/warning - yellow-400 (#facc15)
])

/**
 * Minimap token summary - compact per-line data.
 * Fixed stride array for character-level color sampling.
 */
export type MinimapTokenSummary = {
	/**
	 * Token data (packed).
	 * low byte (0-7): char code (ASCII)
	 * high byte (8-15): colorId
	 * Stride is `maxChars`.
	 * `tokens[line * maxChars + char]` = (colorId << 8) | charCode
	 */
	tokens: Uint16Array
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
	/** Updated tokens for dirty range */
	tokens: Uint16Array
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
	const totalTokens = lineCount * maxChars
	return {
		tokens: new Uint16Array(totalTokens),
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
		const totalBytes = lineCount * maxChars * 2 // Uint16
		const buffer = new SharedArrayBuffer(totalBytes)
		return {
			tokens: new Uint16Array(buffer),
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
		tokens: new Uint16Array(summary.tokens),
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
	const totalBytes = lineCount * maxChars * 2 // Uint16
	const buffer = new ArrayBuffer(totalBytes)
	return {
		tokens: new Uint16Array(buffer),
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
	const totalBytes = summary.lineCount * summary.maxChars * 2 // Uint16
	const buffer = new ArrayBuffer(headerSize + totalBytes)
	const view = new DataView(buffer)

	view.setUint32(0, summary.lineCount, true) // little-endian
	view.setUint32(4, summary.maxChars, true)
	view.setUint32(8, summary.version, true)

	const tokens = new Uint16Array(
		buffer,
		headerSize,
		summary.lineCount * summary.maxChars
	)
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
	const totalTokens = lineCount * maxChars

	return {
		tokens: new Uint16Array(buffer, headerSize, totalTokens),
		maxChars,
		lineCount,
		version,
	}
}
