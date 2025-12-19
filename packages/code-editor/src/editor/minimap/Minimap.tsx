import { createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { useCursor } from '../cursor'
import type { MinimapProps } from './types'
import { useMinimapWorker } from './useMinimapWorker'
import type { MinimapLayout } from './workerTypes'

const MINIMAP_ROW_HEIGHT_CSS = 2
const MINIMAP_PADDING_X_CSS = 3
const MINIMAP_MIN_SLIDER_HEIGHT_CSS = 18
const MINIMAP_MAX_CHARS = 160

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value))

const getDrawingHeightCss = (containerHeightCss: number, lineCount: number) => {
	if (containerHeightCss <= 0) return 0
	if (lineCount <= 0) return containerHeightCss
	return Math.min(containerHeightCss, lineCount * MINIMAP_ROW_HEIGHT_CSS)
}

const getSliderGeometry = (element: HTMLDivElement, heightCss: number) => {
	const scrollHeight = element.scrollHeight
	const clientHeight = element.clientHeight
	const scrollTop = element.scrollTop

	if (scrollHeight <= 0 || clientHeight <= 0 || heightCss <= 0) {
		return { sliderTop: 0, sliderHeight: heightCss, scrollTop, scrollHeight }
	}

	const ratio = clamp(clientHeight / scrollHeight, 0, 1)
	const sliderHeight = clamp(
		heightCss * ratio,
		MINIMAP_MIN_SLIDER_HEIGHT_CSS,
		heightCss
	)

	const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
	const maxSliderTop = Math.max(0, heightCss - sliderHeight)
	const sliderTop =
		maxScrollTop === 0
			? 0
			: clamp((scrollTop / maxScrollTop) * maxSliderTop, 0, maxSliderTop)

	return { sliderTop, sliderHeight, scrollTop, scrollHeight }
}

/**
 * Minimap Component
 *
 * The base canvas is transferred to the minimap worker and rendered entirely off the main thread.
 * The overlay canvas stays on the main thread for fast cursor/selection updates.
 */
export const Minimap = (props: MinimapProps) => {
	const cursor = useCursor()

	const [container, setContainer] = createSignal<HTMLDivElement | null>(null)
	const [baseCanvas, setBaseCanvas] = createSignal<HTMLCanvasElement | null>(
		null
	)
	const [overlayCanvas, setOverlayCanvas] =
		createSignal<HTMLCanvasElement | null>(null)
	const [overlayVisible, setOverlayVisible] = createSignal(false)

	// Worker manages the base canvas rendering
	const [workerActive, setWorkerActive] = createSignal(false)
	const worker = useMinimapWorker({
		onReady: () => setWorkerActive(true),
		onError: (error) => {
			console.warn('Minimap worker error:', error)
			setWorkerActive(false)
		},
	})

	let rafOverlay = 0
	let connectedTreeSitterWorker: Worker | null = null
	let hasMeasuredSize = false
	let hasRenderedBase = false
	let lastRenderedPath: string | null = null

	let dragState:
		| {
				pointerId: number
				dragOffsetY: number
				sliderHeight: number
		  }
		| undefined

	const getCanvasSizeCss = () => {
		const host = container()
		if (!host) return null
		const rect = host.getBoundingClientRect()
		const width = Math.max(1, Math.round(rect.width))
		const height = Math.max(1, Math.round(rect.height))
		return { width, height }
	}

	const syncCanvasDpr = (
		canvas: HTMLCanvasElement,
		width: number,
		height: number
	) => {
		const dpr = window.devicePixelRatio || 1
		const deviceWidth = Math.max(1, Math.round(width * dpr))
		const deviceHeight = Math.max(1, Math.round(height * dpr))
		if (canvas.width !== deviceWidth) canvas.width = deviceWidth
		if (canvas.height !== deviceHeight) canvas.height = deviceHeight
		return { dpr, deviceWidth, deviceHeight }
	}

	const getLayout = (): MinimapLayout | null => {
		const size = getCanvasSizeCss()
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

	const scheduleOverlayRender = () => {
		if (rafOverlay) cancelAnimationFrame(rafOverlay)
		rafOverlay = requestAnimationFrame(() => {
			rafOverlay = 0
			renderOverlay()
		})
	}

	// Initialize worker and transfer base canvas
	onMount(async () => {
		const canvas = baseCanvas()
		if (!canvas) return

		const layout = getLayout()
		if (!layout) return

		const success = await worker.init(canvas, layout)
		if (!success) return
	})

	// Keep base + overlay sized to the minimap host.
	createEffect(() => {
		const host = container()
		if (!host) return

		const observer = new ResizeObserver(() => {
			hasMeasuredSize = true
			const layout = getLayout()
			if (layout) {
				void worker.updateLayout(layout)
			}

			if (hasRenderedBase && overlayVisible() === false) {
				setOverlayVisible(true)
			}
			if (overlayVisible()) {
				scheduleOverlayRender()
			}
		})

		observer.observe(host)
		onCleanup(() => observer.disconnect())
	})

	// Connect Tree-sitter worker and render when inputs change
	createEffect(
		on(
			() =>
				[
					workerActive(),
					props.treeSitterWorker,
					props.filePath,
					props.version?.(),
				] as const,
			async ([active, treeSitterWorker, filePath, version]) => {
				if (!active) return

				if (treeSitterWorker && connectedTreeSitterWorker !== treeSitterWorker) {
					worker.connectTreeSitter(treeSitterWorker)
					connectedTreeSitterWorker = treeSitterWorker
				}

				if (!treeSitterWorker || !filePath) {
					hasRenderedBase = false
					lastRenderedPath = null
					setOverlayVisible(false)
					await worker.clear()
					return
				}

				const isNewPath = lastRenderedPath !== filePath
				if (isNewPath) {
					hasRenderedBase = false
					setOverlayVisible(false)
					lastRenderedPath = filePath
					await worker.clear()
				}

				const rendered = await worker.renderFromPath(filePath, version ?? 0)
				if (!rendered) return

				hasRenderedBase = true
				if (hasMeasuredSize && overlayVisible() === false) {
					setOverlayVisible(true)
				}
				if (overlayVisible()) scheduleOverlayRender()
			},
			{ defer: true }
		)
	)

	// Overlay rendering (cursor, selections, diagnostics) stays on main thread
	const renderOverlay = () => {
		const element = props.scrollElement()
		const canvas = overlayCanvas()
		if (!element || !canvas) return

		const size = getCanvasSizeCss()
		if (!size) return

		const { width, height: containerHeight } = size
		const { dpr, deviceWidth, deviceHeight } = syncCanvasDpr(
			canvas,
			width,
			containerHeight
		)

		const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
		if (!ctx) return

		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, deviceWidth, deviceHeight)

		const lineCount = cursor.lines.lineCount()
		if (lineCount <= 0) return

		const drawingHeight = getDrawingHeightCss(containerHeight, lineCount)
		const { sliderTop, sliderHeight } = getSliderGeometry(element, drawingHeight)
		const sliderXCss = 1
		const sliderWidthCss = Math.max(1, width - 2)

		const x = sliderXCss * dpr
		const y = sliderTop * dpr
		const w = sliderWidthCss * dpr
		const h = sliderHeight * dpr

		ctx.fillStyle = 'rgba(228, 228, 231, 0.10)'
		ctx.fillRect(x, y, w, h)

		ctx.strokeStyle = 'rgba(228, 228, 231, 0.28)'
		ctx.lineWidth = Math.max(1, Math.round(1 * dpr))
		ctx.strokeRect(x, y, w, h)

		const rowHeight = MINIMAP_ROW_HEIGHT_CSS
		const rows = Math.max(1, Math.floor(drawingHeight / rowHeight))
		const ratio = lineCount > rows ? lineCount / rows : 1

		// Helper to convert model line to minimap Y position
		const lineToMinimapY = (line: number) => (line / ratio) * rowHeight * dpr

		// Draw cursor line highlight
		const cursorLine = cursor.state.position.line
		const cursorY = lineToMinimapY(cursorLine)
		const cursorHeight = Math.max(1, Math.round(rowHeight * dpr))

		ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
		ctx.fillRect(x, cursorY, w, cursorHeight)

		// Draw selection ranges
		const selections = cursor.state.selections
		if (selections && selections.length > 0) {
			ctx.fillStyle = 'rgba(100, 149, 237, 0.3)' // Cornflower blue with transparency

			for (const selection of selections) {
				// SelectionRange uses anchor/focus offsets, not line/column positions
				if (selection.anchor === selection.focus) {
					continue // Skip empty selections
				}

				const startOffset = Math.min(selection.anchor, selection.focus)
				const endOffset = Math.max(selection.anchor, selection.focus)

				const startPos = cursor.lines.offsetToPosition(startOffset)
				const endPos = cursor.lines.offsetToPosition(endOffset)

				const startLine = startPos.line
				const endLine = endPos.line

				const selectionStartY = lineToMinimapY(startLine)
				const selectionEndY = lineToMinimapY(endLine + 1)
				const selectionHeight = Math.max(
					cursorHeight,
					selectionEndY - selectionStartY
				)

				ctx.fillRect(x, selectionStartY, w, selectionHeight)
			}
		}

		// Draw diagnostic markers (errors/warnings) on left edge
		const errors = props.errors?.()
		if (errors && errors.length > 0) {
			const markerWidth = 3 * dpr // Marker width in device pixels

			for (const error of errors) {
				const errorLine = cursor.lines.offsetToPosition(error.startIndex).line
				const errorY = lineToMinimapY(errorLine)

				// Use red for errors, yellow for warnings (isMissing)
				ctx.fillStyle = error.isMissing
					? 'rgba(250, 204, 21, 0.9)' // yellow-400
					: 'rgba(239, 68, 68, 0.9)' // red-500

				ctx.fillRect(
					(width - 4) * dpr, // Right edge
					errorY,
					markerWidth,
					cursorHeight
				)
			}
		}
	}

	// Re-render overlay when cursor, selection, or errors change
	createEffect(
		on(
			() => [
				cursor.state.position.line,
				cursor.state.selections,
				props.errors?.(),
			],
			() => scheduleOverlayRender()
		)
	)

	// Re-render overlay on scroll
	createEffect(() => {
		const element = props.scrollElement()
		if (!element) return

		const handleScroll = () => scheduleOverlayRender()
		element.addEventListener('scroll', handleScroll, { passive: true })

		onCleanup(() => {
			element.removeEventListener('scroll', handleScroll)
		})
	})

	// Pointer event handlers for slider interaction
	const handlePointerDown = (event: PointerEvent) => {
		const element = props.scrollElement()
		if (!element) return

		const size = getCanvasSizeCss()
		if (!size) return

		const lineCount = cursor.lines.lineCount()
		const drawingHeight = getDrawingHeightCss(size.height, lineCount)
		const { sliderTop, sliderHeight } = getSliderGeometry(element, drawingHeight)
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		const localY = clamp(event.clientY - rect.top, 0, drawingHeight)
		const isOnSlider = localY >= sliderTop && localY <= sliderTop + sliderHeight

		if (isOnSlider) {
			dragState = {
				pointerId: event.pointerId,
				dragOffsetY: localY - sliderTop,
				sliderHeight,
			}
			;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
		} else {
			const scrollHeight = element.scrollHeight
			const clientHeight = element.clientHeight
			const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
			const newSliderTop = localY - sliderHeight / 2
			const maxSliderTop = Math.max(0, drawingHeight - sliderHeight)
			const ratio = maxSliderTop > 0 ? newSliderTop / maxSliderTop : 0
			element.scrollTop = clamp(ratio * maxScrollTop, 0, maxScrollTop)
		}
	}

	const handlePointerMove = (event: PointerEvent) => {
		if (!dragState || event.pointerId !== dragState.pointerId) return

		const element = props.scrollElement()
		if (!element) return

		const size = getCanvasSizeCss()
		if (!size) return

		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		const lineCount = cursor.lines.lineCount()
		const drawingHeight = getDrawingHeightCss(size.height, lineCount)
		const localY = clamp(event.clientY - rect.top, 0, drawingHeight)
		const newSliderTop = localY - dragState.dragOffsetY

		const scrollHeight = element.scrollHeight
		const clientHeight = element.clientHeight
		const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
		const maxSliderTop = Math.max(0, drawingHeight - dragState.sliderHeight)
		const ratio = maxSliderTop > 0 ? newSliderTop / maxSliderTop : 0
		element.scrollTop = clamp(ratio * maxScrollTop, 0, maxScrollTop)
	}

	const handlePointerUp = (event: PointerEvent) => {
		if (dragState && event.pointerId === dragState.pointerId) {
			;(event.currentTarget as HTMLElement).releasePointerCapture(
				event.pointerId
			)
			dragState = undefined
		}
	}

	onCleanup(() => {
		if (rafOverlay) cancelAnimationFrame(rafOverlay)
	})

	return (
		<div
			class="relative h-full w-[50px] shrink-0 overflow-hidden"
			ref={setContainer}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
		>
			<canvas
				ref={setBaseCanvas}
				class="absolute left-0 top-0 h-full w-full"
				style={{ 'pointer-events': 'none' }}
			/>
			<canvas
				ref={setOverlayCanvas}
				class="absolute left-0 top-0 h-full w-full"
				style={{
					'pointer-events': 'none',
					opacity: overlayVisible() ? '1' : '0',
				}}
			/>
		</div>
	)
}
