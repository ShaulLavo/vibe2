import {
	Show,
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	onMount
} from 'solid-js'
import type { Accessor } from 'solid-js'
import { estimateLineHeight } from '../utils'
import type { CursorState } from '../cursor'

// Cursor visual constants
const CURSOR_WIDTH = 2 // pixels
const CURSOR_HEIGHT_SHRINK = 2 // shrink cursor height slightly to not touch edges

export type CursorProps = {
	cursorState: Accessor<CursorState>
	fontSize: number
	fontFamily: string
	charWidth: number // measured character width
	lineNumberWidth: number // Width of the line number gutter
	paddingLeft: number // Padding before text content
	visibleLineStart: number // First visible line index
	visibleLineEnd: number // Last visible line index
	getLineY: (lineIndex: number) => number // Get Y position for a line
}

export const Cursor = (props: CursorProps) => {
	const [visible, setVisible] = createSignal(true)

	// Blink timer
	let blinkInterval: ReturnType<typeof setInterval> | null = null

	onMount(() => {
		// Start blinking
		blinkInterval = setInterval(() => {
			if (props.cursorState().isBlinking) {
				setVisible(v => !v)
			} else {
				setVisible(true)
			}
		}, 530) // Standard cursor blink rate
	})

	onCleanup(() => {
		if (blinkInterval) {
			clearInterval(blinkInterval)
		}
	})

	// Reset visibility when cursor moves (show cursor immediately after movement)
	createEffect(
		on(
			() => props.cursorState().position.offset,
			() => {
				setVisible(true)
			}
		)
	)

	// Check if cursor line is visible
	const isVisible = createMemo(() => {
		const line = props.cursorState().position.line
		return line >= props.visibleLineStart && line <= props.visibleLineEnd
	})

	// Calculate cursor X position based on column
	const cursorX = createMemo(() => {
		const column = props.cursorState().position.column
		return props.lineNumberWidth + props.paddingLeft + column * props.charWidth
	})

	// Calculate cursor Y position
	const cursorY = createMemo(() => {
		const line = props.cursorState().position.line
		return props.getLineY(line) + CURSOR_HEIGHT_SHRINK / 2
	})

	// Cursor height - slightly smaller than line height
	const cursorHeight = createMemo(() => {
		return estimateLineHeight(props.fontSize) - CURSOR_HEIGHT_SHRINK
	})

	return (
		<Show when={isVisible() && visible()}>
			<div
				class="pointer-events-none absolute z-10"
				style={{
					left: `${cursorX()}px`,
					top: `${cursorY()}px`,
					width: `${CURSOR_WIDTH}px`,
					height: `${cursorHeight()}px`,
					'background-color': '#e4e4e7', // zinc-200
					'border-radius': '1px'
				}}
			/>
		</Show>
	)
}
