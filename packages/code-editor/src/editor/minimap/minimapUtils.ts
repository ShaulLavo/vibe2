/**
 * Pure utility functions for minimap calculations.
 * These have no side effects and don't depend on Solid.js reactivity.
 */

import {
	MINIMAP_MAX_CHARS,
	MINIMAP_MAX_WIDTH_CSS,
	MINIMAP_MIN_WIDTH_CSS,
	MINIMAP_PADDING_X_CSS,
	MINIMAP_ROW_HEIGHT_CSS,
	MINIMAP_WIDTH_RATIO,
} from './constants'
import type { MinimapLayout } from './workerTypes'

/**
 * Get the container dimensions in CSS pixels.
 */
export const getCanvasSizeCss = (
	container: HTMLElement | null
): { width: number; height: number } | null => {
	if (!container) return null
	const rect = container.getBoundingClientRect()
	const width = Math.max(1, Math.round(rect.width))
	const height = Math.max(1, Math.round(rect.height))
	return { width, height }
}

/**
 * Sync canvas dimensions with device pixel ratio.
 * Returns the DPR and device dimensions.
 */
export const syncCanvasDpr = (
	canvas: HTMLCanvasElement,
	width: number,
	height: number
): { dpr: number; deviceWidth: number; deviceHeight: number } => {
	const dpr = window.devicePixelRatio || 1
	const deviceWidth = Math.max(1, Math.round(width * dpr))
	const deviceHeight = Math.max(1, Math.round(height * dpr))
	if (canvas.width !== deviceWidth) canvas.width = deviceWidth
	if (canvas.height !== deviceHeight) canvas.height = deviceHeight
	return { dpr, deviceWidth, deviceHeight }
}

/**
 * Build the minimap layout object from container dimensions.
 */
export const getMinimapLayout = (
	container: HTMLElement | null
): MinimapLayout | null => {
	const size = getCanvasSizeCss(container)
	if (!size) return null

	const dpr = window.devicePixelRatio || 1
	return {
		mode: 'blocks',
		minimapLineHeightCss: MINIMAP_ROW_HEIGHT_CSS,
		maxChars: MINIMAP_MAX_CHARS,
		paddingXCss: MINIMAP_PADDING_X_CSS,
		size: {
			cssWidth: size.width,
			cssHeight: size.height,
			dpr,
			deviceWidth: Math.round(size.width * dpr),
			deviceHeight: Math.round(size.height * dpr),
		},
	}
}

/**
 * Calculate the minimap width based on editor width.
 */
export const computeMinimapWidthCss = (editorWidth: number): number => {
	const raw = Math.round(editorWidth / MINIMAP_WIDTH_RATIO)
	return Math.max(MINIMAP_MIN_WIDTH_CSS, Math.min(MINIMAP_MAX_WIDTH_CSS, raw))
}

/**
 * Convert a line number to minimap Y position in device pixels.
 * Applies scroll offset to project onto the visible canvas area.
 */
export const lineToMinimapY = (
	line: number,
	rowHeightDevice: number,
	scrollOffset: number
): number => {
	const absoluteY = line * rowHeightDevice
	return absoluteY - scrollOffset
}

/**
 * Convert hex color string to packed RGBA (0xAABBGGRR)
 */
export const hexToPacked = (hex: string): number => {
	// Handle #RRGGBBAA and #RRGGBB
	let r = 0,
		g = 0,
		b = 0,
		a = 255

	const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex

	if (cleanHex.length === 3) {
		// Short hex #RGB -> #RRGGBB
		const rChar = cleanHex[0] ?? '0'
		const gChar = cleanHex[1] ?? '0'
		const bChar = cleanHex[2] ?? '0'
		r = parseInt(rChar + rChar, 16)
		g = parseInt(gChar + gChar, 16)
		b = parseInt(bChar + bChar, 16)
	} else if (cleanHex.length === 6) {
		// #RRGGBB
		r = parseInt(cleanHex.slice(0, 2), 16)
		g = parseInt(cleanHex.slice(2, 4), 16)
		b = parseInt(cleanHex.slice(4, 6), 16)
	} else if (cleanHex.length === 8) {
		// #RRGGBBAA
		r = parseInt(cleanHex.slice(0, 2), 16)
		g = parseInt(cleanHex.slice(2, 4), 16)
		b = parseInt(cleanHex.slice(4, 6), 16)
		a = parseInt(cleanHex.slice(6, 8), 16)
	}

	// Pack as AABBGGRR (little-endian uint32 read)
	return (a << 24) | (b << 16) | (g << 8) | r
}

import type { ThemePalette } from '@repo/theme'
import { MINIMAP_DEFAULT_PALETTE } from './tokenSummary'

/**
 * Create a palette from the theme
 */
export const createMinimapPalette = (theme: ThemePalette): Uint32Array => {
	const palette = new Uint32Array(MINIMAP_DEFAULT_PALETTE.length)

	const resolve = (key: keyof typeof theme.syntax): number => {
		const color = theme.syntax[key]
		return color ? hexToPacked(color) : MINIMAP_DEFAULT_PALETTE[0]!
	}

	// Mapping based on MINIMAP_SCOPE_TO_COLOR_ID
	try {
		palette[0] = hexToPacked(theme.editor.foreground)
	} catch (e) {
		console.warn(
			'Failed to parse foreground color:',
			theme.editor?.foreground,
			e
		)
		palette[0] = MINIMAP_DEFAULT_PALETTE[0]!
	}

	palette[1] = resolve('keyword')
	palette[2] = resolve('keywordControl')
	palette[3] = resolve('keywordOperator')
	palette[4] = resolve('type')
	palette[5] = resolve('function')
	palette[6] = resolve('variable')
	palette[7] = resolve('variableBuiltin')
	palette[8] = resolve('constant')
	palette[9] = resolve('string')
	palette[10] = resolve('number')
	palette[11] = resolve('comment')
	palette[12] = resolve('punctuation')
	palette[13] = resolve('operator')
	palette[14] = resolve('property')
	palette[15] = resolve('error')
	palette[16] = resolve('missing')

	return palette
}
