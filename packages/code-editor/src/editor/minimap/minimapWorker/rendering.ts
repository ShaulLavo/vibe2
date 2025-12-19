import { loggers } from '@repo/logger'
import type { MinimapTokenSummary, MinimapLayout } from './types'
import {
	Constants,
	BACKGROUND_R,
	BACKGROUND_G,
	BACKGROUND_B,
} from './constants'
import {
	createFontAtlas,
	getActiveAtlas,
	getAtlasScale,
	hasAtlas,
	getCharIndex,
} from './fontAtlas'
import {
	findDirtyLines,
	clearLines,
	getCachedImageData,
	setCachedImageData,
	setPreviousState,
} from './partialRepaint'

const log = loggers.codeEditor.withTag('minimap')

// ============================================================================
// Waiter System for Tree-sitter Ready Notifications
// ============================================================================

const readyWaiters = new Map<string, Set<() => void>>()
let renderNonce = 0

export const incrementRenderNonce = (): number => ++renderNonce

export const getCurrentNonce = (): number => renderNonce

export const wakeWaiters = (path: string): void => {
	const waiters = readyWaiters.get(path)
	if (!waiters) return
	for (const wake of [...waiters]) wake()
}

export const waitForMinimapReady = (path: string, nonce: number) =>
	new Promise<boolean>((resolve) => {
		if (nonce !== renderNonce) return resolve(false)

		let waiters = readyWaiters.get(path)
		if (!waiters) {
			waiters = new Set()
			readyWaiters.set(path, waiters)
		}

		const wake = () => {
			waiters?.delete(wake)
			if (waiters && waiters.size === 0) readyWaiters.delete(path)
			resolve(nonce === renderNonce)
		}

		waiters.add(wake)
	})

export const clearWaiters = (): void => {
	readyWaiters.clear()
}

// ============================================================================
// Line Rendering
// ============================================================================

/**
 * Render a single line
 */
export const renderLine = (
	line: number,
	tokens: Uint16Array,
	maxChars: number,
	dest: Uint8ClampedArray,
	charW: number,
	charH: number,
	pixelsPerChar: number,
	scale: number,
	deviceWidth: number,
	deviceHeight: number,
	palette: Uint32Array
): void => {
	const yStart = line * charH
	if (yStart >= deviceHeight) return

	const tokenOffset = line * maxChars
	const safeMaxChars = Math.min(maxChars, Math.ceil(deviceWidth / charW))
	const destWidth = deviceWidth * Constants.RGBA_CHANNELS_CNT
	const fontAtlas = getActiveAtlas()

	for (let char = 0; char < safeMaxChars; char++) {
		const val = tokens[tokenOffset + char]!
		const charCode = val & 0xff

		if (charCode <= 32) continue

		const colorId = val >> 8
		const rawColor = palette[colorId] ?? palette[0]!

		const colorR = rawColor & 0xff
		const colorG = (rawColor >> 8) & 0xff
		const colorB = (rawColor >> 16) & 0xff
		const foregroundAlpha = (rawColor >> 24) & 0xff

		const deltaR = colorR - BACKGROUND_R
		const deltaG = colorG - BACKGROUND_G
		const deltaB = colorB - BACKGROUND_B

		const charIndex = getCharIndex(charCode, scale)
		const atlasOffset = charIndex * pixelsPerChar
		const xStart = char * charW

		let sourceIdx = atlasOffset
		let rowStart = yStart * destWidth + xStart * Constants.RGBA_CHANNELS_CNT

		for (let dy = 0; dy < charH; dy++) {
			const py = yStart + dy
			if (py >= deviceHeight) break

			let destIdx = rowStart

			for (let dx = 0; dx < charW; dx++) {
				const px = xStart + dx
				if (px >= deviceWidth) break

				const charAlpha = fontAtlas[sourceIdx++]!
				const c = (charAlpha / 255) * (foregroundAlpha / 255)

				if (c > 0.02) {
					dest[destIdx] = BACKGROUND_R + deltaR * c
					dest[destIdx + 1] = BACKGROUND_G + deltaG * c
					dest[destIdx + 2] = BACKGROUND_B + deltaB * c
					dest[destIdx + 3] = Math.max(foregroundAlpha, 200)
				}

				destIdx += Constants.RGBA_CHANNELS_CNT
			}

			rowStart += destWidth
		}
	}
}

// ============================================================================
// Full/Partial Render
// ============================================================================

/**
 * Render from binary token summary with partial repainting
 */
export const renderFromSummary = (
	summary: MinimapTokenSummary,
	ctx: OffscreenCanvasRenderingContext2D,
	layout: MinimapLayout,
	palette: Uint32Array,
	forceFullRepaint = false
): void => {
	const { dpr, deviceWidth, deviceHeight } = layout.size
	const scale = Math.round(dpr)

	// Create atlas if needed
	if (!hasAtlas() || getAtlasScale() !== scale) {
		createFontAtlas('monospace', scale)
	}

	const { tokens, maxChars, lineCount } = summary

	const charW = Constants.BASE_CHAR_WIDTH * scale
	const charH = Constants.BASE_CHAR_HEIGHT * scale
	const pixelsPerChar = charW * charH

	// Find dirty lines
	const dirtyLines = forceFullRepaint
		? new Set(Array.from({ length: lineCount }, (_, i) => i))
		: findDirtyLines(tokens, maxChars, lineCount)

	// Check if dimensions changed - always requires full repaint
	const cachedImageData = getCachedImageData()
	const dimensionsChanged =
		!cachedImageData ||
		cachedImageData.width !== deviceWidth ||
		cachedImageData.height !== deviceHeight

	// Optimization: if no dirty lines AND dimensions unchanged, skip render
	if (dirtyLines.size === 0 && !dimensionsChanged) {
		return
	}

	// Full repaint if dimensions changed or too many dirty lines (threshold: 30%)
	const fullRepaint =
		forceFullRepaint || dimensionsChanged || dirtyLines.size > lineCount * 0.3

	let imageData: ImageData

	if (fullRepaint) {
		// Full repaint
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, deviceWidth, deviceHeight)
		imageData = ctx.createImageData(deviceWidth, deviceHeight)

		// Render all visible lines
		const rows = Math.min(lineCount, Math.floor(deviceHeight / charH))
		for (let row = 0; row < rows; row++) {
			renderLine(
				row,
				tokens,
				maxChars,
				imageData.data,
				charW,
				charH,
				pixelsPerChar,
				scale,
				deviceWidth,
				deviceHeight,
				palette
			)
		}
	} else {
		// Partial repaint - reuse cached image data
		imageData = cachedImageData!

		// Clear and re-render only dirty lines
		clearLines(imageData.data, dirtyLines, charH, deviceWidth, deviceHeight)

		for (const line of dirtyLines) {
			if (line < lineCount) {
				renderLine(
					line,
					tokens,
					maxChars,
					imageData.data,
					charW,
					charH,
					pixelsPerChar,
					scale,
					deviceWidth,
					deviceHeight,
					palette
				)
			}
		}
	}

	ctx.putImageData(imageData, 0, 0)

	// Cache for next render
	setCachedImageData(imageData)
	setPreviousState(tokens, maxChars, lineCount)
}
