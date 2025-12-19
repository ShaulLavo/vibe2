import { Constants } from './constants'

// ============================================================================
// Partial Repainting State
// ============================================================================

let previousTokens: Uint16Array | null = null
let previousMaxChars: number = 0
let previousLineCount: number = 0
let cachedImageData: ImageData | null = null

// ============================================================================
// State Accessors
// ============================================================================

export const getCachedImageData = (): ImageData | null => cachedImageData

export const setCachedImageData = (data: ImageData | null): void => {
	cachedImageData = data
}

export const setPreviousState = (
	tokens: Uint16Array,
	maxChars: number,
	lineCount: number
): void => {
	previousTokens = new Uint16Array(tokens)
	previousMaxChars = maxChars
	previousLineCount = lineCount
}

export const resetPartialRepaintState = (): void => {
	previousTokens = null
	previousMaxChars = 0
	previousLineCount = 0
	cachedImageData = null
}

export const invalidateCache = (): void => {
	cachedImageData = null
}

// ============================================================================
// Dirty Line Detection
// ============================================================================

/**
 * Find dirty lines by comparing token buffers
 */
export const findDirtyLines = (
	newTokens: Uint16Array,
	newMaxChars: number,
	newLineCount: number
): Set<number> => {
	const dirtyLines = new Set<number>()

	// If dimensions changed, repaint everything
	if (!previousTokens || previousMaxChars !== newMaxChars) {
		for (let i = 0; i < newLineCount; i++) {
			dirtyLines.add(i)
		}
		return dirtyLines
	}

	// Compare line by line
	const maxLines = Math.max(previousLineCount, newLineCount)
	for (let line = 0; line < maxLines; line++) {
		// New line added
		if (line >= previousLineCount) {
			dirtyLines.add(line)
			continue
		}
		// Line removed
		if (line >= newLineCount) {
			dirtyLines.add(line)
			continue
		}

		// Compare tokens in this line
		const offset = line * newMaxChars
		let isDirty = false
		for (let char = 0; char < newMaxChars; char++) {
			if (newTokens[offset + char] !== previousTokens[offset + char]) {
				isDirty = true
				break
			}
		}
		if (isDirty) {
			dirtyLines.add(line)
		}
	}

	return dirtyLines
}

/**
 * Clear specific lines in the image data
 */
export const clearLines = (
	dest: Uint8ClampedArray,
	dirtyLines: Set<number>,
	charH: number,
	deviceWidth: number,
	deviceHeight: number
): void => {
	const destWidth = deviceWidth * Constants.RGBA_CHANNELS_CNT

	for (const line of dirtyLines) {
		const yStart = line * charH
		if (yStart >= deviceHeight) continue

		const yEnd = Math.min(yStart + charH, deviceHeight)
		const startIdx = yStart * destWidth
		const endIdx = yEnd * destWidth

		// Clear to transparent
		for (let i = startIdx; i < endIdx; i++) {
			dest[i] = 0
		}
	}
}
