/**
 * Minimap Renderer Worker
 *
 * Renders the minimap base layer to an OffscreenCanvas.
 * Uses Comlink for clean RPC-style communication.
 * Can communicate directly with Tree-sitter worker for token summaries.
 *
 * Implements VS Code-style character rendering with:
 * - Prebaked atlas data for scales 1 and 2
 * - Brightness normalization in downsampling
 * - True background color blending
 */

import { expose, proxy, wrap, type Remote } from 'comlink'
import {
	MINIMAP_DEFAULT_PALETTE,
	type MinimapTokenSummary,
} from './tokenSummary'
import type { MinimapLayout } from './workerTypes'

/**
 * Minimal Tree-sitter worker interface for minimap communication
 */
type TreeSitterMinimapApi = {
	subscribeMinimapReady(callback: (payload: { path: string }) => void): number
	unsubscribeMinimapReady(id: number): void
	getMinimapSummary(payload: {
		path: string
		version: number
		maxChars?: number
	}): Promise<MinimapTokenSummary | undefined>
}

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let layout: MinimapLayout | null = null
let palette: Uint32Array = MINIMAP_DEFAULT_PALETTE

// Tree-sitter worker proxy for direct communication
let treeSitterWorker: Remote<TreeSitterMinimapApi> | null = null
let renderNonce = 0
let minimapSubscriptionId: number | null = null

const readyWaiters = new Map<string, Set<() => void>>()

// ============================================================================
// Constants (matches VS Code)
// ============================================================================

const Constants = {
	START_CH_CODE: 32, // Space
	END_CH_CODE: 126, // Tilde (~)
	CHAR_COUNT: 126 - 32 + 2, // +1 for unknown char

	SAMPLED_CHAR_HEIGHT: 16,
	SAMPLED_CHAR_WIDTH: 10,

	BASE_CHAR_HEIGHT: 2,
	BASE_CHAR_WIDTH: 1,

	RGBA_CHANNELS_CNT: 4,
} as const

// Background color (dark editor background)
const BACKGROUND_R = 24 // #18181b (zinc-900)
const BACKGROUND_G = 24
const BACKGROUND_B = 27

// ============================================================================
// Prebaked Minimap Data (from VS Code)
// ============================================================================

const charTable: Record<string, number> = {
	'0': 0,
	'1': 1,
	'2': 2,
	'3': 3,
	'4': 4,
	'5': 5,
	'6': 6,
	'7': 7,
	'8': 8,
	'9': 9,
	A: 10,
	B: 11,
	C: 12,
	D: 13,
	E: 14,
	F: 15,
}

const decodeData = (str: string): Uint8ClampedArray => {
	const output = new Uint8ClampedArray(str.length / 2)
	for (let i = 0; i < str.length; i += 2) {
		output[i >> 1] =
			(charTable[str[i]!]! << 4) | (charTable[str[i + 1]!]! & 0xf)
	}
	return output
}

// Prebaked atlas data for scale 1 (1x2 pixels per char) and scale 2 (2x4 pixels per char)
const prebakedMiniMaps: Record<number, () => Uint8ClampedArray> = {
	1: (() => {
		let cached: Uint8ClampedArray | null = null
		return () => {
			if (!cached) {
				cached = decodeData(
					'0000511D6300CF609C709645A78432005642574171487021003C451900274D35D762755E8B629C5BA856AF57BA649530C167D1512A272A3F6038604460398526BCA2A968DB6F8957C768BE5FBE2FB467CF5D8D5B795DC7625B5DFF50DE64C466DB2FC47CD860A65E9A2EB96CB54CE06DA763AB2EA26860524D3763536601005116008177A8705E53AB738E6A982F88BAA35B5F5B626D9C636B449B737E5B7B678598869A662F6B5B8542706C704C80736A607578685B70594A49715A4522E792'
				)
			}
			return cached
		}
	})(),
	2: (() => {
		let cached: Uint8ClampedArray | null = null
		return () => {
			if (!cached) {
				cached = decodeData(
					'000000000000000055394F383D2800008B8B1F210002000081B1CBCBCC820000847AAF6B9AAF2119BE08B8881AD60000A44FD07DCCF107015338130C00000000385972265F390B406E2437634B4B48031B12B8A0847000001E15B29A402F0000000000004B33460B00007A752C2A0000000000004D3900000084394B82013400ABA5CFC7AD9C0302A45A3E5A98AB000089A43382D97900008BA54AA087A70A0248A6A7AE6DBE0000BF6F94987EA40A01A06DCFA7A7A9030496C32F77891D0000A99FB1A0AFA80603B29AB9CA75930D010C0948354D3900000C0948354F37460D0028BE673D8400000000AF9D7B6E00002B007AA8933400007AA642675C2700007984CFB9C3985B768772A8A6B7B20000CAAECAAFC4B700009F94A6009F840009D09F9BA4CA9C0000CC8FC76DC87F0000C991C472A2000000A894A48CA7B501079BA2C9C69BA20000B19A5D3FA89000005CA6009DA2960901B0A7F0669FB200009D009E00B7890000DAD0F5D092820000D294D4C48BD10000B5A7A4A3B1A50402CAB6CBA6A2000000B5A7A4A3B1A8044FCDADD19D9CB00000B7778F7B8AAE0803C9AB5D3F5D3F00009EA09EA0BAB006039EA0989A8C7900009B9EF4D6B7C00000A9A7816CACA80000ABAC84705D3F000096DA635CDC8C00006F486F266F263D4784006124097B00374F6D2D6D2D6D4A3A95872322000000030000000000008D8939130000000000002E22A5C9CBC70600AB25C0B5C9B400061A2DB04CA67001082AA6BEBEBFC606002321DACBC19E03087AA08B6768380000282FBAC0B8CA7A88AD25BBA5A29900004C396C5894A6000040485A6E356E9442A32CD17EADA70000B4237923628600003E2DE9C1D7B500002F25BBA5A2990000231DB6AFB4A804023025C0B5CAB588062B2CBDBEC0C706882435A75CA20000002326BD6A82A908048B4B9A5A668000002423A09CB4BB060025259C9D8A7900001C1FCAB2C7C700002A2A9387ABA200002626A4A47D6E9D14333163A0C87500004B6F9C2D643A257049364936493647358A34438355497F1A0000A24C1D590000D38DFFBDD4CD3126'
				)
			}
			return cached
		}
	})(),
}

// ============================================================================
// Font Atlas Generation
// ============================================================================

let fontAtlas: Uint8ClampedArray | null = null
let atlasScale: number = 0

/**
 * Get char index in atlas
 */
const getCharIndex = (chCode: number, scale: number): number => {
	const idx = chCode - Constants.START_CH_CODE
	if (idx < 0 || idx >= Constants.CHAR_COUNT) {
		if (scale <= 2) {
			// For smaller scales, wrap around
			return (idx + Constants.CHAR_COUNT) % Constants.CHAR_COUNT
		}
		return Constants.CHAR_COUNT - 1 // Unknown symbol
	}
	return idx
}

/**
 * Create font atlas - uses prebaked data for scales 1 and 2,
 * otherwise renders dynamically
 */
const createFontAtlas = (
	fontFamily: string,
	scale: number
): Uint8ClampedArray => {
	atlasScale = scale

	// Use prebaked data for common scales
	if (prebakedMiniMaps[scale]) {
		return prebakedMiniMaps[scale]!()
	}

	// Generate dynamically for other scales
	return createFontAtlasFromSample(fontFamily, scale)
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
	// Unknown char
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

	// Brightness normalization - scale all values so brightest becomes 255
	if (brightest > 0) {
		const adjust = 255 / brightest
		for (let i = 0; i < result.length; i++) {
			result[i] = Math.min(255, Math.floor(result[i]! * adjust))
		}
	}

	return result
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

			// Weighted bilinear sampling
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
					// Combine RGB and Alpha
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
 * Soften atlas data (like VS Code's soften function)
 */
const softenAtlas = (
	input: Uint8ClampedArray,
	ratio: number
): Uint8ClampedArray => {
	const result = new Uint8ClampedArray(input.length)
	for (let i = 0; i < input.length; i++) {
		result[i] = Math.floor(input[i]! * ratio)
	}
	return result
}

// ============================================================================
// Rendering
// ============================================================================

const waitForMinimapReady = (path: string, nonce: number) =>
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

/**
 * Render from binary token summary with true background blending
 */
const renderFromSummary = (summary: MinimapTokenSummary) => {
	if (!ctx || !canvas || !layout) {
		console.warn('[minimap] Missing context/canvas/layout')
		return
	}

	const { dpr, deviceWidth, deviceHeight } = layout.size
	const scale = Math.round(dpr)

	// Get or create atlas for this scale
	if (!fontAtlas || atlasScale !== scale) {
		fontAtlas = createFontAtlas('monospace', scale)
	}

	const { tokens, maxChars, lineCount } = summary

	ctx.setTransform(1, 0, 0, 1, 0, 0)
	ctx.clearRect(0, 0, deviceWidth, deviceHeight)

	const imageData = ctx.createImageData(deviceWidth, deviceHeight)
	const dest = imageData.data

	const charW = Constants.BASE_CHAR_WIDTH * scale
	const charH = Constants.BASE_CHAR_HEIGHT * scale
	const pixelsPerChar = charW * charH
	const rows = Math.min(lineCount, Math.floor(deviceHeight / charH))
	const destWidth = deviceWidth * Constants.RGBA_CHANNELS_CNT

	for (let row = 0; row < rows; row++) {
		const yStart = row * charH
		const tokenOffset = row * maxChars
		const safeMaxChars = Math.min(maxChars, Math.ceil(deviceWidth / charW))

		for (let char = 0; char < safeMaxChars; char++) {
			const val = tokens[tokenOffset + char]!
			const charCode = val & 0xff

			if (charCode <= 32) continue // Skip space/invisible

			const colorId = val >> 8
			const rawColor = palette[colorId] ?? palette[0]!

			// Extract RGB from 0xAABBGGRR
			const colorR = rawColor & 0xff
			const colorG = (rawColor >> 8) & 0xff
			const colorB = (rawColor >> 16) & 0xff
			const foregroundAlpha = (rawColor >> 24) & 0xff

			// Calculate delta from background
			const deltaR = colorR - BACKGROUND_R
			const deltaG = colorG - BACKGROUND_G
			const deltaB = colorB - BACKGROUND_B

			// Get atlas data
			const charIndex = getCharIndex(charCode, scale)
			const atlasOffset = charIndex * pixelsPerChar

			const xStart = char * charW

			// Render character with true background blending
			let sourceIdx = atlasOffset
			let rowStart = yStart * destWidth + xStart * Constants.RGBA_CHANNELS_CNT

			for (let dy = 0; dy < charH; dy++) {
				let destIdx = rowStart

				for (let dx = 0; dx < charW; dx++) {
					const px = xStart + dx
					if (px >= deviceWidth) break

					// Character alpha from atlas combined with foreground alpha
					const charAlpha = fontAtlas![sourceIdx++]!
					const c = (charAlpha / 255) * (foregroundAlpha / 255)

					if (c > 0.02) {
						// Skip nearly invisible
						// True background blending: bg + (fg - bg) * alpha
						dest[destIdx] = BACKGROUND_R + deltaR * c
						dest[destIdx + 1] = BACKGROUND_G + deltaG * c
						dest[destIdx + 2] = BACKGROUND_B + deltaB * c
						dest[destIdx + 3] = Math.max(foregroundAlpha, 200) // High alpha for visibility
					}

					destIdx += Constants.RGBA_CHANNELS_CNT
				}

				rowStart += destWidth
				const py = yStart + dy + 1
				if (py >= deviceHeight) break
			}
		}
	}

	ctx.putImageData(imageData, 0, 0)
}

// ============================================================================
// Worker API
// ============================================================================

const api = {
	/**
	 * Initialize with OffscreenCanvas and layout
	 */
	init(
		offscreen: OffscreenCanvas,
		newLayout: MinimapLayout,
		newPalette?: Uint32Array
	) {
		canvas = offscreen
		layout = newLayout
		if (newPalette) {
			palette = newPalette
		}

		canvas.width = layout.size.deviceWidth
		canvas.height = layout.size.deviceHeight

		ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
		if (!ctx) {
			throw new Error('Failed to get 2D context from OffscreenCanvas')
		}
	},

	/**
	 * Connect to Tree-sitter worker for direct communication
	 */
	connectTreeSitter(port: MessagePort) {
		treeSitterWorker = wrap<TreeSitterMinimapApi>(port)

		if (minimapSubscriptionId !== null) {
			void treeSitterWorker.unsubscribeMinimapReady(minimapSubscriptionId)
			minimapSubscriptionId = null
		}

		void treeSitterWorker
			.subscribeMinimapReady(
				proxy(({ path }) => {
					const waiters = readyWaiters.get(path)
					if (!waiters) return
					for (const wake of [...waiters]) wake()
				})
			)
			.then((id) => {
				minimapSubscriptionId = id
			})
	},

	/**
	 * Update layout
	 */
	updateLayout(newLayout: MinimapLayout) {
		layout = newLayout
		if (canvas) {
			if (canvas.width !== layout.size.deviceWidth) {
				canvas.width = layout.size.deviceWidth
			}
			if (canvas.height !== layout.size.deviceHeight) {
				canvas.height = layout.size.deviceHeight
			}
		}
	},

	/**
	 * Update color palette
	 */
	updatePalette(newPalette: Uint32Array) {
		palette = newPalette
	},

	/**
	 * Render from token summary (binary format)
	 */
	renderSummary(summary: MinimapTokenSummary) {
		renderFromSummary(summary)
	},

	/**
	 * Request summary from Tree-sitter and render
	 */
	async renderFromPath(path: string, version: number) {
		const nonce = ++renderNonce
		if (!treeSitterWorker) {
			console.warn('[minimap] Tree-sitter worker not connected')
			return false
		}

		for (let attempt = 0; attempt < 2; attempt++) {
			if (nonce !== renderNonce) return false

			let summary: MinimapTokenSummary | undefined
			try {
				summary = await treeSitterWorker.getMinimapSummary({ path, version })
			} catch (err) {
				console.error('[minimap] getMinimapSummary failed:', err)
				return false
			}

			if (nonce !== renderNonce) return false

			if (summary) {
				renderFromSummary(summary)
				return true
			}

			api.clear()

			const becameReady = await Promise.race([
				waitForMinimapReady(path, nonce),
				new Promise<boolean>((resolve) =>
					setTimeout(() => resolve(false), 2000)
				),
			])
			if (!becameReady) return false
		}

		return false
	},

	/**
	 * Clear the canvas
	 */
	clear() {
		if (!ctx || !canvas || !layout) return
		ctx.clearRect(0, 0, layout.size.deviceWidth, layout.size.deviceHeight)
	},

	/**
	 * Dispose and cleanup
	 */
	dispose() {
		canvas = null
		ctx = null
		layout = null
		if (treeSitterWorker && minimapSubscriptionId !== null) {
			void treeSitterWorker.unsubscribeMinimapReady(minimapSubscriptionId)
		}
		treeSitterWorker = null
		minimapSubscriptionId = null
		readyWaiters.clear()
	},
}

export type MinimapWorkerApi = typeof api

expose(api)
