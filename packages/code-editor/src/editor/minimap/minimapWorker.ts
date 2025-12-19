/**
 * Minimap Renderer Worker
 *
 * Renders the minimap base layer to an OffscreenCanvas.
 * Uses Comlink for clean RPC-style communication.
 * Can communicate directly with Tree-sitter worker for token summaries.
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
	subscribeMinimapReady(
		callback: (payload: { path: string }) => void
	): () => void
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
let unsubscribeMinimapReady: (() => void) | null = null

const readyWaiters = new Map<string, Set<() => void>>()

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
 * Convert packed RGBA (0xRRGGBBAA) to CSS color string
 */
/**
 * Render from binary token summary
 */
const renderFromSummary = (summary: MinimapTokenSummary) => {
	if (!ctx || !canvas || !layout) return

	const { tokens, maxChars, lineCount } = summary
	const { dpr, deviceWidth, deviceHeight } = layout.size
	const { minimapLineHeightCss, paddingXCss } = layout

	ctx.setTransform(1, 0, 0, 1, 0, 0)
	ctx.clearRect(0, 0, deviceWidth, deviceHeight)

	// Use ImageData for pixel-perfect rendering (much faster than fillRect for tiny blocks)
	const imageData = ctx.createImageData(deviceWidth, deviceHeight)
	const data = new Uint32Array(imageData.data.buffer)

	const rowHeightDevice = Math.max(1, Math.round(minimapLineHeightCss * dpr))
	const rowFillHeightDevice = Math.max(1, rowHeightDevice - 1)
	const charWidthDevice = Math.max(1, Math.round(2 * dpr)) // Approx width per char block
	const xStart = Math.round(paddingXCss * dpr)

	const rows = Math.min(lineCount, Math.floor(deviceHeight / rowHeightDevice))

	// Create lookup table for extracted RGBA values
	// Since we are writing to Uint32Array (ABGR on little-endian), we need to format accordingly.
	// Palette is already 0xAABBGGRR. Data view expects this.
	// But let's verify endianness or just use byte manipulation if needed.
	// Actually, canvas imageData is RGBA order in bytes: [r, g, b, a].
	// In Uint32Array (little endian), this is 0xAABBGGRR.
	// Our palette is already 0xAABBGGRR from getThemeColors.

	for (let row = 0; row < rows; row++) {
		const yStart = row * rowHeightDevice
		if (yStart >= deviceHeight) break

		const offset = row * maxChars

		for (let char = 0; char < maxChars; char++) {
			const colorId = tokens[offset + char]!
			if (colorId === 0) continue // Skip whitespace/transparent

			const color = palette[colorId] ?? palette[0]!
			// Draw a block for this character
			const x = xStart + char * charWidthDevice
			if (x >= deviceWidth) break

			// Fill block pixels
			for (let dy = 0; dy < rowFillHeightDevice; dy++) {
				// -1 for gap between lines
				const py = yStart + dy
				if (py >= deviceHeight) break

				const rowOffset = py * deviceWidth

				for (let dx = 0; dx < charWidthDevice; dx++) {
					const px = x + dx
					if (px >= deviceWidth) break
					data[rowOffset + px] = color
				}
			}
		}
	}

	ctx.putImageData(imageData, 0, 0)
}

/**
 * Minimap Worker API
 */
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

		void treeSitterWorker
			.subscribeMinimapReady(
				proxy(({ path }) => {
					const waiters = readyWaiters.get(path)
					if (!waiters) return
					for (const wake of [...waiters]) wake()
				})
			)
			.then((unsubscribe) => {
				unsubscribeMinimapReady = unsubscribe ?? null
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
			console.warn('Tree-sitter worker not connected')
			return false
		}

		for (let attempt = 0; attempt < 2; attempt++) {
			if (nonce !== renderNonce) return false

			const summary = await treeSitterWorker.getMinimapSummary({ path, version })
			if (nonce !== renderNonce) return false

			if (summary) {
				renderFromSummary(summary)
				return true
			}

			api.clear()

			const becameReady = await Promise.race([
				waitForMinimapReady(path, nonce),
				new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
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
		treeSitterWorker = null
		readyWaiters.clear()
		const unsubscribe = unsubscribeMinimapReady
		unsubscribeMinimapReady = null
		unsubscribe?.()
	},
}

export type MinimapWorkerApi = typeof api

expose(api)
