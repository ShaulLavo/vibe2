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
 * - Partial repainting (only changed lines)
 * - Light/Normal font variants for theme support
 */

import { expose, proxy, wrap, type Remote } from 'comlink'
import { loggers } from '@repo/logger'
import { MINIMAP_DEFAULT_PALETTE } from '../tokenSummary'
import type {
	MinimapTokenSummary,
	MinimapLayout,
	TreeSitterMinimapApi,
} from './types'
import { setLightFont as setLightFontAtlas } from './fontAtlas'
import { resetPartialRepaintState, invalidateCache } from './partialRepaint'
import {
	renderFromSummary,
	incrementRenderNonce,
	getCurrentNonce,
	waitForMinimapReady,
	wakeWaiters,
	clearWaiters,
} from './rendering'

const log = loggers.codeEditor.withTag('minimap')

// ============================================================================
// Worker State
// ============================================================================

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let layout: MinimapLayout | null = null
let palette: Uint32Array = MINIMAP_DEFAULT_PALETTE

// Tree-sitter worker proxy for direct communication
let treeSitterWorker: Remote<TreeSitterMinimapApi> | null = null
let minimapSubscriptionId: number | null = null

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

		// Reset partial repaint state
		resetPartialRepaintState()
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
					wakeWaiters(path)
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
				invalidateCache()
			}
			if (canvas.height !== layout.size.deviceHeight) {
				canvas.height = layout.size.deviceHeight
				invalidateCache()
			}
		}
	},

	/**
	 * Update color palette
	 */
	updatePalette(newPalette: Uint32Array) {
		palette = newPalette
		invalidateCache() // Force full repaint on palette change
	},

	/**
	 * Set font variant (light for light themes, normal for dark themes)
	 */
	setLightFont(isLight: boolean) {
		if (setLightFontAtlas(isLight)) {
			invalidateCache() // Force full repaint on variant change
		}
	},

	/**
	 * Render from token summary (binary format)
	 */
	renderSummary(summary: MinimapTokenSummary) {
		if (!ctx || !layout) {
			log.warn('Missing context/layout')
			return
		}
		renderFromSummary(summary, ctx, layout, palette)
	},

	/**
	 * Request summary from Tree-sitter and render
	 */
	async renderFromPath(path: string, version: number) {
		const nonce = incrementRenderNonce()
		if (!treeSitterWorker) {
			log.warn('Tree-sitter worker not connected')
			return false
		}

		for (let attempt = 0; attempt < 2; attempt++) {
			if (nonce !== getCurrentNonce()) return false

			let summary: MinimapTokenSummary | undefined
			try {
				summary = await treeSitterWorker.getMinimapSummary({ path, version })
			} catch (err) {
				log.error('getMinimapSummary failed:', err)
				return false
			}

			if (nonce !== getCurrentNonce()) return false

			if (summary) {
				if (!ctx || !layout) {
					log.warn('Missing context/layout')
					return false
				}
				renderFromSummary(summary, ctx, layout, palette)
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
		resetPartialRepaintState()
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
		clearWaiters()
		resetPartialRepaintState()
	},
}

export type MinimapWorkerApi = typeof api

expose(api)
