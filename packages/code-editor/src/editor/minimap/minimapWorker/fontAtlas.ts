import { Constants, NORMAL_FONT_RATIO, LIGHT_FONT_RATIO } from './constants'
import { prebakedMiniMaps } from './prebakedData'

// ============================================================================
// Font Atlas State
// ============================================================================

let fontAtlasNormal: Uint8ClampedArray | null = null
let fontAtlasLight: Uint8ClampedArray | null = null
let atlasScale: number = 0
let useLightFont: boolean = false

// ============================================================================
// Atlas Functions
// ============================================================================

/**
 * Soften atlas data (like VS Code's soften function)
 * Used to create normal and light font variants
 */
export const softenAtlas = (
	input: Uint8ClampedArray,
	ratio: number
): Uint8ClampedArray => {
	const result = new Uint8ClampedArray(input.length)
	for (let i = 0; i < input.length; i++) {
		result[i] = Math.floor(input[i]! * ratio)
	}
	return result
}

/**
 * Get char index in atlas
 */
export const getCharIndex = (chCode: number, scale: number): number => {
	const idx = chCode - Constants.START_CH_CODE
	if (idx < 0 || idx >= Constants.CHAR_COUNT) {
		if (scale <= 2) {
			return (idx + Constants.CHAR_COUNT) % Constants.CHAR_COUNT
		}
		return Constants.CHAR_COUNT - 1
	}
	return idx
}

/**
 * Downsample a single character with weighted bilinear sampling
 */
const downsampleChar = (
	source: Uint8ClampedArray,
	sourceOffset: number,
	dest: Uint8ClampedArray,
	destOffset: number,
	scale: number
): number => {
	const width = Constants.BASE_CHAR_WIDTH * scale
	const height = Constants.BASE_CHAR_HEIGHT * scale
	const rowWidth =
		Constants.RGBA_CHANNELS_CNT *
		Constants.CHAR_COUNT *
		Constants.SAMPLED_CHAR_WIDTH

	let targetIndex = destOffset
	let brightest = 0

	for (let y = 0; y < height; y++) {
		const sourceY1 = (y / height) * Constants.SAMPLED_CHAR_HEIGHT
		const sourceY2 = ((y + 1) / height) * Constants.SAMPLED_CHAR_HEIGHT

		for (let x = 0; x < width; x++) {
			const sourceX1 = (x / width) * Constants.SAMPLED_CHAR_WIDTH
			const sourceX2 = ((x + 1) / width) * Constants.SAMPLED_CHAR_WIDTH

			let value = 0
			let samples = 0

			for (let sy = sourceY1; sy < sourceY2; sy++) {
				const sourceRow = sourceOffset + Math.floor(sy) * rowWidth
				const yBalance = 1 - (sy - Math.floor(sy))

				for (let sx = sourceX1; sx < sourceX2; sx++) {
					const xBalance = 1 - (sx - Math.floor(sx))
					const sourceIndex =
						sourceRow + Math.floor(sx) * Constants.RGBA_CHANNELS_CNT

					const weight = xBalance * yBalance
					samples += weight
					value +=
						((source[sourceIndex]! * source[sourceIndex + 3]!) / 255) * weight
				}
			}

			const final = samples > 0 ? value / samples : 0
			brightest = Math.max(brightest, final)
			dest[targetIndex++] = Math.floor(final)
		}
	}

	return brightest
}

/**
 * Downsample the high-res atlas to target scale.
 * Implements VS Code's brightness normalization.
 */
const downsampleAtlas = (
	source: Uint8ClampedArray,
	scale: number
): Uint8ClampedArray => {
	const charW = Constants.BASE_CHAR_WIDTH * scale
	const charH = Constants.BASE_CHAR_HEIGHT * scale
	const pixelsPerChar = charW * charH
	const result = new Uint8ClampedArray(Constants.CHAR_COUNT * pixelsPerChar)

	let resultOffset = 0
	let sourceOffset = 0
	let brightest = 0

	for (let charIndex = 0; charIndex < Constants.CHAR_COUNT; charIndex++) {
		const charBrightest = downsampleChar(
			source,
			sourceOffset,
			result,
			resultOffset,
			scale
		)
		brightest = Math.max(brightest, charBrightest)
		resultOffset += pixelsPerChar
		sourceOffset += Constants.SAMPLED_CHAR_WIDTH * Constants.RGBA_CHANNELS_CNT
	}

	// Brightness normalization
	if (brightest > 0) {
		const adjust = 255 / brightest
		for (let i = 0; i < result.length; i++) {
			result[i] = Math.min(255, Math.floor(result[i]! * adjust))
		}
	}

	return result
}

/**
 * Generate font atlas by sampling from a canvas
 */
const createFontAtlasFromSample = (
	fontFamily: string,
	scale: number
): Uint8ClampedArray => {
	const totalWidth = Constants.CHAR_COUNT * Constants.SAMPLED_CHAR_WIDTH
	const atlasCanvas = new OffscreenCanvas(
		totalWidth,
		Constants.SAMPLED_CHAR_HEIGHT
	)
	const ctx = atlasCanvas.getContext('2d')!

	ctx.fillStyle = '#ffffff'
	ctx.font = `bold ${Constants.SAMPLED_CHAR_HEIGHT}px ${fontFamily}`
	ctx.textBaseline = 'middle'

	let x = 0
	for (let i = Constants.START_CH_CODE; i <= Constants.END_CH_CODE; i++) {
		ctx.fillText(String.fromCharCode(i), x, Constants.SAMPLED_CHAR_HEIGHT / 2)
		x += Constants.SAMPLED_CHAR_WIDTH
	}
	ctx.fillText('?', x, Constants.SAMPLED_CHAR_HEIGHT / 2)

	const imageData = ctx.getImageData(
		0,
		0,
		totalWidth,
		Constants.SAMPLED_CHAR_HEIGHT
	)
	return downsampleAtlas(imageData.data, scale)
}

/**
 * Create font atlas - uses prebaked data for scales 1 and 2,
 * otherwise renders dynamically. Creates both normal and light variants.
 */
export const createFontAtlas = (fontFamily: string, scale: number): void => {
	atlasScale = scale

	let baseAtlas: Uint8ClampedArray

	// Use prebaked data for common scales
	if (prebakedMiniMaps[scale]) {
		baseAtlas = prebakedMiniMaps[scale]!()
	} else {
		baseAtlas = createFontAtlasFromSample(fontFamily, scale)
	}

	// Create both font variants
	fontAtlasNormal = softenAtlas(baseAtlas, NORMAL_FONT_RATIO)
	fontAtlasLight = softenAtlas(baseAtlas, LIGHT_FONT_RATIO)
}

/**
 * Get the active font atlas based on theme setting
 */
export const getActiveAtlas = (): Uint8ClampedArray => {
	return useLightFont ? fontAtlasLight! : fontAtlasNormal!
}

/**
 * Get the current atlas scale
 */
export const getAtlasScale = (): number => atlasScale

/**
 * Check if font atlas is initialized
 */
export const hasAtlas = (): boolean => fontAtlasNormal !== null

/**
 * Set dark mode (normal font for dark themes, light font for light themes)
 */
export const setDark = (isDark: boolean): boolean => {
	const shouldUseLightFont = !isDark
	if (useLightFont !== shouldUseLightFont) {
		useLightFont = shouldUseLightFont
		return true // Changed
	}
	return false // No change
}

/**
 * Reset atlas state
 */
export const resetAtlas = (): void => {
	fontAtlasNormal = null
	fontAtlasLight = null
	atlasScale = 0
}
