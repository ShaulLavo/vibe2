/**
 * Scroll utility functions for minimap scroll synchronization.
 * These are used by both the main component and overlay rendering.
 */

import {
	MINIMAP_MIN_SLIDER_HEIGHT_CSS,
	MINIMAP_ROW_HEIGHT_CSS,
} from './constants'

export type MinimapScrollState = {
	/** How far the minimap content is scrolled (CSS pixels) */
	minimapScrollTop: number
	/** Slider Y position (CSS pixels) */
	sliderTop: number
	/** Slider height (CSS pixels) */
	sliderHeight: number
}

/**
 * Calculate minimap scroll state from editor scroll position.
 * Accounts for editor's overscroll padding (50% of viewport).
 *
 * @param element - The scroll container element (editor)
 * @param minimapHeight - Visible height of the minimap container (CSS pixels)
 * @param totalMinimapHeight - Total height of all minimap content (CSS pixels)
 */
export const getMinimapScrollState = (
	element: HTMLElement,
	minimapHeight: number,
	totalMinimapHeight: number
): MinimapScrollState => {
	const scrollHeight = element.scrollHeight
	const clientHeight = element.clientHeight
	const scrollTop = element.scrollTop

	// If editor content fits, no scroll needed
	if (scrollHeight <= clientHeight) {
		return { minimapScrollTop: 0, sliderTop: 0, sliderHeight: minimapHeight }
	}

	// The editor adds 50% of viewport height as overscroll padding.
	// We need to account for this to properly sync with the minimap.
	const overscrollPadding = clientHeight * 0.5
	const actualContentHeight = scrollHeight - overscrollPadding

	// Calculate scroll ratio based on actual content, not the padded scroll area
	const maxActualScroll = Math.max(0, actualContentHeight - clientHeight)
	const clampedScrollTop = Math.min(scrollTop, maxActualScroll)
	const scrollRatio =
		maxActualScroll > 0 ? clampedScrollTop / maxActualScroll : 0

	// How much the minimap content needs to scroll to show the end of the document
	const maxMinimapScroll = Math.max(0, totalMinimapHeight - minimapHeight)
	const minimapScrollTop = scrollRatio * maxMinimapScroll

	// Slider height: proportional to how much of the document is visible
	const sliderHeight = Math.max(
		MINIMAP_MIN_SLIDER_HEIGHT_CSS,
		(clientHeight / actualContentHeight) * totalMinimapHeight
	)

	// Slider position: moves from 0 to (minimapHeight - sliderHeight) as scroll ratio goes 0 to 1
	const sliderTop = scrollRatio * (minimapHeight - sliderHeight)

	return { minimapScrollTop, sliderTop, sliderHeight }
}

/**
 * Compute scroll offset in device pixels for canvas rendering.
 * Uses the same formula as the worker to ensure alignment.
 *
 * @param element - The scroll container element
 * @param lineCount - Total number of lines in the document
 * @param deviceHeight - Canvas height in device pixels
 * @param scale - DPR scale factor (typically Math.round(dpr))
 */
export const computeScrollOffset = (
	element: HTMLElement,
	lineCount: number,
	deviceHeight: number,
	scale: number
): number => {
	const scrollHeight = element.scrollHeight
	const clientHeight = element.clientHeight

	if (scrollHeight <= clientHeight) return 0

	// Account for editor's overscroll padding
	const overscrollPadding = clientHeight * 0.5
	const actualContentHeight = scrollHeight - overscrollPadding
	const maxActualScroll = Math.max(0, actualContentHeight - clientHeight)
	const scrollRatio =
		maxActualScroll > 0
			? Math.min(1, Math.max(0, element.scrollTop / maxActualScroll))
			: 0

	// Worker's formula: maxScroll = lineCount * charH - deviceHeight
	const charH = MINIMAP_ROW_HEIGHT_CSS * scale
	const totalHeightDevice = lineCount * charH
	const maxScrollDevice = Math.max(0, totalHeightDevice - deviceHeight)

	return Math.round(scrollRatio * maxScrollDevice)
}
