/**
 * Hook for minimap interaction handling (pointer, drag, wheel events).
 * Manages slider dragging and click-to-jump behavior.
 */

import { createSignal, type Accessor } from 'solid-js'
import { MINIMAP_ROW_HEIGHT_CSS } from './constants'
import { getMinimapScrollState } from './scrollUtils'

export type DragState = {
	pointerId: number
	dragOffsetY: number
	sliderHeight: number
}

export type MinimapInteractionOptions = {
	/** Accessor for the scroll container element */
	scrollElement: Accessor<HTMLElement | undefined>
	/** Accessor for canvas size in CSS pixels */
	getCanvasSizeCss: () => { width: number; height: number } | null
	/** Accessor for line count */
	getLineCount: () => number
}

export type MinimapInteractionHandlers = {
	/** Whether currently dragging the slider */
	isDragging: Accessor<boolean>
	/** Pointer down handler */
	handlePointerDown: (event: PointerEvent) => void
	/** Pointer move handler (drag) */
	handlePointerMove: (event: PointerEvent) => void
	/** Pointer up handler */
	handlePointerUp: (event: PointerEvent) => void
	/** Wheel handler (scroll passthrough) */
	handleWheel: (event: WheelEvent) => void
}

/**
 * Creates handlers for minimap interaction.
 * Handles slider dragging in a way that provides 1-to-1 mouse tracking.
 */
export const useMinimapInteraction = (
	options: MinimapInteractionOptions
): MinimapInteractionHandlers => {
	const { scrollElement, getCanvasSizeCss, getLineCount } = options

	const [isDragging, setIsDragging] = createSignal(false)
	let dragState: DragState | undefined

	const handlePointerDown = (event: PointerEvent) => {
		const element = scrollElement()
		if (!element) return

		const size = getCanvasSizeCss()
		if (!size) return

		const lineCount = getLineCount()
		const totalMinimapHeight = lineCount * MINIMAP_ROW_HEIGHT_CSS

		const { sliderTop, sliderHeight } = getMinimapScrollState(
			element,
			size.height,
			totalMinimapHeight
		)
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		const localY = Math.max(0, Math.min(size.height, event.clientY - rect.top))
		const isOnSlider = localY >= sliderTop && localY <= sliderTop + sliderHeight

		if (isOnSlider) {
			dragState = {
				pointerId: event.pointerId,
				dragOffsetY: localY - sliderTop,
				sliderHeight,
			}
			;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
			setIsDragging(true)
		} else {
			// Click outside slider - jump to that position
			const { minimapScrollTop } = getMinimapScrollState(
				element,
				size.height,
				totalMinimapHeight
			)
			const clickedMinimapY = minimapScrollTop + localY
			const targetRatio =
				totalMinimapHeight > 0 ? clickedMinimapY / totalMinimapHeight : 0

			const scrollHeight = element.scrollHeight
			const clientHeight = element.clientHeight
			const maxScrollTop = Math.max(0, scrollHeight - clientHeight)

			// Scroll to center the clicked line in the editor
			const targetScrollTop = targetRatio * scrollHeight - clientHeight / 2
			element.scrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop))
		}
	}

	const handlePointerMove = (event: PointerEvent) => {
		if (!dragState || event.pointerId !== dragState.pointerId) return

		const element = scrollElement()
		if (!element) return

		const size = getCanvasSizeCss()
		if (!size) return

		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
		const lineCount = getLineCount()
		const totalMinimapHeight = lineCount * MINIMAP_ROW_HEIGHT_CSS

		const { minimapScrollTop } = getMinimapScrollState(
			element,
			size.height,
			totalMinimapHeight
		)

		const localY = Math.max(0, Math.min(size.height, event.clientY - rect.top))
		const draggedMinimapY = minimapScrollTop + localY - dragState.dragOffsetY
		const targetRatio =
			totalMinimapHeight > 0 ? draggedMinimapY / totalMinimapHeight : 0

		const scrollHeight = element.scrollHeight
		const clientHeight = element.clientHeight
		const maxScrollTop = Math.max(0, scrollHeight - clientHeight)

		const targetScrollTop = targetRatio * scrollHeight
		element.scrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop))
	}

	const handlePointerUp = (event: PointerEvent) => {
		if (dragState && event.pointerId === dragState.pointerId) {
			;(event.currentTarget as HTMLElement).releasePointerCapture(
				event.pointerId
			)
			dragState = undefined
			setIsDragging(false)
		}
	}

	const handleWheel = (event: WheelEvent) => {
		event.preventDefault()
		const element = scrollElement()
		if (element) {
			element.scrollTop += event.deltaY
		}
	}

	return {
		isDragging,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleWheel,
	}
}
