/**
 * useMinimapWorker Hook
 *
 * Creates and manages the minimap renderer worker using Comlink.
 * Handles OffscreenCanvas transfer and Tree-sitter worker connection.
 */

import { createSignal, onCleanup } from 'solid-js'
import { wrap, transfer, type Remote } from 'comlink'
import type { MinimapLayout } from './workerTypes'
import type { MinimapWorkerApi } from './minimapWorker/worker'
import type { MinimapTokenSummary } from './tokenSummary'

export type UseMinimapWorkerOptions = {
	/** Callback when worker is ready */
	onReady?: () => void
	/** Callback on error */
	onError?: (error: string) => void
}

/**
 * Controller type for the minimap worker.
 * NOTE: This type mirrors MinimapWorkerApi from ./minimapWorker/worker.ts
 * Keep in sync when updating the worker API.
 * Differences:
 * - init takes HTMLCanvasElement (transfers to OffscreenCanvas internally)
 * - connectTreeSitter is sync (fires and forgets)
 * - Adds isReady accessor
 */
export type MinimapWorkerController = {
	/** Whether the worker is initialized and ready */
	isReady: () => boolean
	/** Initialize the worker with a canvas */
	init: (
		canvas: HTMLCanvasElement,
		layout: MinimapLayout,
		palette?: Uint32Array,
		bgColor?: number
	) => Promise<boolean>
	/** Connect to Tree-sitter worker for direct communication */
	connectTreeSitter: (treeSitterWorker: Worker) => void
	/** Update layout */
	updateLayout: (layout: MinimapLayout) => Promise<void>
	/** Update color palette */
	updatePalette: (palette: Uint32Array, bgColor?: number) => Promise<void>
	/** Update scroll position */
	updateScroll: (scrollTop: number) => Promise<void>
	/** Render from token summary */
	renderSummary: (summary: MinimapTokenSummary) => Promise<void>
	/** Request render from Tree-sitter by path */
	renderFromPath: (path: string, version: number) => Promise<boolean>
	/** Render from plain text (fallback for unsupported languages) */
	renderFromText: (text: string, version: number) => Promise<boolean>
	/** Clear the canvas */
	clear: () => Promise<void>
	/** Dispose the worker */
	dispose: () => Promise<void>
	/** Set dark mode (normal font for dark themes, light font for light themes) */
	setDark: (isDark: boolean) => Promise<void>
}

/**
 * Create URL for the worker
 */
const createMinimapWorker = () =>
	new Worker(new URL('./minimapWorker/worker.ts', import.meta.url), {
		type: 'module',
	})

export const useMinimapWorker = (
	options: UseMinimapWorkerOptions = {}
): MinimapWorkerController => {
	const [isReady, setIsReady] = createSignal(false)
	let worker: Worker | null = null
	let api: Remote<MinimapWorkerApi> | null = null

	/**
	 * Initialize the worker with a canvas
	 */
	/*
	 * Initialize the worker with a canvas
	 */
	const init = async (
		canvas: HTMLCanvasElement,
		layout: MinimapLayout,
		palette?: Uint32Array,
		bgColor?: number
	): Promise<boolean> => {
		// Check if OffscreenCanvas is supported
		if (typeof OffscreenCanvas === 'undefined') {
			console.warn(
				'OffscreenCanvas not supported, falling back to main thread rendering'
			)
			return false
		}

		try {
			// Create the worker
			worker = createMinimapWorker()
			api = wrap<MinimapWorkerApi>(worker)

			// Transfer the canvas to the worker
			const offscreen = canvas.transferControlToOffscreen()
			await api.init(transfer(offscreen, [offscreen]), layout, palette, bgColor)

			setIsReady(true)
			options.onReady?.()
			return true
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			console.warn('Failed to initialize minimap worker:', message)
			options.onError?.(message)
			return false
		}
	}

	/**
	 * Connect to Tree-sitter worker for direct worker-to-worker communication
	 */
	const connectTreeSitter = (treeSitterWorker: Worker) => {
		if (!api) return

		// Create a MessageChannel for worker-to-worker communication
		const channel = new MessageChannel()

		// Send one port to minimap worker
		api.connectTreeSitter(transfer(channel.port1, [channel.port1]))

		// Send the other port to Tree-sitter worker (it needs to expose its API on this port)
		// Note: Tree-sitter worker needs to be updated to accept port connections
		treeSitterWorker.postMessage(
			{ type: 'connect-port', port: channel.port2 },
			[channel.port2]
		)
	}

	/**
	 * Update layout
	 */
	const updateLayout = async (layout: MinimapLayout) => {
		await api?.updateLayout(layout)
	}

	/**
	 * Update scroll position
	 */
	const updateScroll = async (scrollTop: number) => {
		await api?.updateScroll(scrollTop)
	}

	/**
	 * Update color palette
	 */
	const updatePalette = async (palette: Uint32Array, bgColor?: number) => {
		await api?.updatePalette(palette, bgColor)
	}

	/**
	 * Render from token summary
	 */
	const renderSummary = async (summary: MinimapTokenSummary) => {
		await api?.renderSummary(summary)
	}

	/**
	 * Request render from Tree-sitter by path
	 */
	const renderFromPath = async (path: string, version: number) => {
		return (await api?.renderFromPath(path, version)) ?? false
	}

	/**
	 * Render from plain text (fallback for unsupported languages)
	 */
	const renderFromText = async (text: string, version: number) => {
		return (await api?.renderFromText(text, version)) ?? false
	}

	/**
	 * Clear the canvas
	 */
	const clear = async () => {
		await api?.clear()
	}

	/**
	 * Dispose the worker
	 */
	const dispose = async () => {
		try {
			if (api) {
				await api.dispose()
			}
		} catch (error) {
			console.warn('Error disposing minimap worker api:', error)
		} finally {
			if (worker) {
				worker.terminate()
				worker = null
			}
			api = null
			setIsReady(false)
		}
	}

	/**
	 * Set dark mode (normal font for dark themes, light font for light themes)
	 */
	const setDark = async (isDark: boolean) => {
		await api?.setDark(isDark)
	}

	// Clean up on unmount
	onCleanup(() => {
		void dispose()
	})

	return {
		isReady,
		init,
		connectTreeSitter,
		updateLayout,
		updatePalette,
		updateScroll,
		renderSummary,
		renderFromPath,
		renderFromText,
		clear,
		dispose,
		setDark,
	}
}
