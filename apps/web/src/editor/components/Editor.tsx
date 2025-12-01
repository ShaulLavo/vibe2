/* eslint-disable solid/prefer-for */
import { createVirtualizer } from '@tanstack/solid-virtual'
import { Show, createEffect, createMemo, on, onCleanup } from 'solid-js'
import { useFs } from '../../fs/context/FsContext'
import { BinaryFileViewer } from '../../components/BinaryFileViewer'
import {
	createPieceTableSnapshot,
	deleteFromPieceTable,
	getPieceTableLength,
	getPieceTableText,
	insertIntoPieceTable
} from '~/utils/pieceTable'
import { VirtualizedRows } from './components'
import { Cursor } from './Cursor'
import {
	COLUMN_CHARS_PER_ITEM,
	HORIZONTAL_VIRTUALIZER_OVERSCAN,
	VERTICAL_VIRTUALIZER_OVERSCAN
} from '../consts'
import {
	estimateColumnWidth,
	estimateLineHeight,
	measureCharWidth
} from '../utils'
import { CursorProvider, useCursor } from '../cursor'
import type { EditorProps, LineEntry, TextFileEditorProps } from '../types'

// Inner editor component that uses the cursor context
const TextFileEditorInner = (props: TextFileEditorProps) => {
	const [state, { updateSelectedFilePieceTable }] = useFs()
	const cursorCtx = useCursor()
	const cursorState = () => cursorCtx.state
	const cursorActions = cursorCtx.actions

	const pieceTableText = createMemo(() => {
		const snapshot = state.selectedFilePieceTable
		if (snapshot) {
			return getPieceTableText(snapshot)
		}
		const stats = props.stats()
		return stats?.text ?? ''
	})

	const lineEntries = createMemo<LineEntry[]>(() => {
		if (!props.isFileSelected()) return []

		const text = pieceTableText()

		if (text.length === 0) {
			return [
				{
					index: 0,
					start: 0,
					length: 0,
					text: ''
				}
			]
		}

		const entries: LineEntry[] = []
		let lineStart = 0
		let index = 0

		for (let i = 0; i < text.length; i++) {
			if (text[i] === '\n') {
				const rawLine = text.slice(lineStart, i)
				const length = i - lineStart + 1
				entries.push({
					index,
					start: lineStart,
					length,
					text: rawLine
				})
				index++
				lineStart = i + 1
			}
		}

		if (lineStart <= text.length) {
			const rawLine = text.slice(lineStart)
			entries.push({
				index,
				start: lineStart,
				length: text.length - lineStart,
				text: rawLine
			})
		}

		return entries
	})

	const hasLineEntries = () => lineEntries().length > 0

	// Get active line from cursor state
	const activeLineIndex = createMemo<number | null>(() => {
		const entries = lineEntries()
		if (!entries.length) return null
		return cursorState().position.line
	})

	const maxColumnChunks = createMemo(() => {
		const entries = lineEntries()
		if (!entries.length) return 0
		let max = 0
		for (const entry of entries) {
			const chunks = Math.max(
				1,
				Math.ceil(entry.text.length / COLUMN_CHARS_PER_ITEM)
			)
			if (chunks > max) {
				max = chunks
			}
		}
		return max
	})

	// Measured character width for precise positioning
	const charWidth = createMemo(() =>
		measureCharWidth(props.fontSize(), props.fontFamily())
	)

	let scrollElement: HTMLDivElement | null = null
	let inputElement: HTMLTextAreaElement | null = null

	const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
		get count() {
			return lineEntries().length
		},
		get enabled() {
			return props.isFileSelected() && hasLineEntries()
		},
		getScrollElement: () => scrollElement,
		estimateSize: () => estimateLineHeight(props.fontSize()),
		overscan: VERTICAL_VIRTUALIZER_OVERSCAN
	})

	const columnVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
		horizontal: true,
		get count() {
			return Math.max(maxColumnChunks(), 1)
		},
		get enabled() {
			return props.isFileSelected() && hasLineEntries()
		},
		getScrollElement: () => scrollElement,
		estimateSize: () => estimateColumnWidth(props.fontSize()),
		overscan: HORIZONTAL_VIRTUALIZER_OVERSCAN
	})

	createEffect(() => {
		props.fontSize()
		props.fontFamily()
		lineEntries()
		queueMicrotask(() => {
			rowVirtualizer.measure()
			columnVirtualizer.measure()
		})
	})

	createEffect(() => {
		if (!props.isFileSelected()) {
			scrollElement = null
		}
	})

	// Reset scroll when switching files
	createEffect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		state.lastKnownFilePath
		if (scrollElement) {
			scrollElement.scrollTop = 0
			scrollElement.scrollLeft = 0
		}
	})

	// Scroll cursor into view when cursor line changes
	// Keep 4 rows of context above/below cursor
	const SCROLL_CONTEXT_ROWS = 4
	createEffect(
		on(
			() => cursorState().position.line,
			line => {
				if (!scrollElement) return

				const lineHeight = lineHeightEstimate()
				const cursorY = line * lineHeight
				const viewportHeight = scrollElement.clientHeight
				const scrollTop = scrollElement.scrollTop

				// Margin to keep cursor away from edges (4 rows of context)
				const margin = lineHeight * SCROLL_CONTEXT_ROWS

				// Check if cursor is too close to top edge
				if (cursorY < scrollTop + margin) {
					// Scroll up to show cursor with context above
					const targetScroll = Math.max(0, cursorY - margin)
					scrollElement.scrollTop = targetScroll
				}
				// Check if cursor is too close to bottom edge
				else if (cursorY + lineHeight > scrollTop + viewportHeight - margin) {
					// Scroll down to show cursor with context below
					const targetScroll = cursorY + lineHeight + margin - viewportHeight
					scrollElement.scrollTop = targetScroll
				}
			},
			{ defer: false }
		)
	)

	// Scroll cursor column into horizontal view
	createEffect(
		on(
			() => cursorState().position.column,
			column => {
				if (!scrollElement) return

				const cw = charWidth()
				const cursorX = column * cw
				const lineNumberWidth = 40 + 16 // w-10 + gap-4
				const paddingLeft = 12 // px-3

				const scrollLeft = scrollElement.scrollLeft
				const viewportWidth = scrollElement.clientWidth
				const absoluteCursorX = lineNumberWidth + paddingLeft + cursorX

				// Check if cursor is outside horizontal viewport
				if (absoluteCursorX < scrollLeft + lineNumberWidth + paddingLeft) {
					scrollElement.scrollLeft = Math.max(
						0,
						absoluteCursorX - lineNumberWidth - paddingLeft - 20
					)
				} else if (absoluteCursorX > scrollLeft + viewportWidth - 20) {
					scrollElement.scrollLeft = absoluteCursorX - viewportWidth + 40
				}
			}
		)
	)

	const virtualItems = () => rowVirtualizer.getVirtualItems()
	const totalSize = () => rowVirtualizer.getTotalSize()
	const columnItems = () => columnVirtualizer.getVirtualItems()
	const columnTotalSize = () => columnVirtualizer.getTotalSize()
	const lineHeightEstimate = createMemo(() =>
		estimateLineHeight(props.fontSize())
	)

	// Get Y position for a line
	const getLineY = (lineIndex: number): number => {
		return lineIndex * lineHeightEstimate()
	}

	// Get visible line range
	const visibleLineRange = createMemo(() => {
		const items = virtualItems()
		if (items.length === 0) return { start: 0, end: 0 }
		return {
			start: items[0]?.index ?? 0,
			end: items[items.length - 1]?.index ?? 0
		}
	})

	const handleRowClick = (entry: LineEntry) => {
		// Move cursor to end of clicked line (fallback)
		cursorActions.setCursorFromClick(entry.index, entry.text.length)
		focusInput()
	}

	const handlePreciseClick = (lineIndex: number, column: number) => {
		cursorActions.setCursorFromClick(lineIndex, column)
		focusInput()
	}

	const focusInput = () => {
		if (inputElement) {
			try {
				inputElement.focus({ preventScroll: true })
			} catch {
				inputElement.focus()
			}
		}
	}

	const applyInsert = (value: string) => {
		if (!value) return
		const offset = cursorState().position.offset
		updateSelectedFilePieceTable(current => {
			const baseSnapshot = current ?? createPieceTableSnapshot(pieceTableText())
			return insertIntoPieceTable(baseSnapshot, offset, value)
		})
		cursorActions.setCursorOffset(offset + value.length)
	}

	const applyDelete = (offset: number, length: number) => {
		if (length <= 0 || offset < 0) return
		updateSelectedFilePieceTable(current => {
			const baseSnapshot = current ?? createPieceTableSnapshot(pieceTableText())
			const totalLength = getPieceTableLength(baseSnapshot)

			if (offset < 0 || offset >= totalLength) {
				return baseSnapshot
			}

			const clampedLength = Math.max(0, Math.min(length, totalLength - offset))

			if (clampedLength === 0) {
				return baseSnapshot
			}

			return deleteFromPieceTable(baseSnapshot, offset, clampedLength)
		})
	}

	const handleInput = (event: InputEvent) => {
		const target = event.target as HTMLTextAreaElement | null
		if (!target) return
		const value = target.value
		if (!value) return
		applyInsert(value)
		target.value = ''
	}

	// Key repeat acceleration state
	type RepeatableKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
	let activeKey: RepeatableKey | null = null
	let repeatTimeout: ReturnType<typeof setTimeout> | null = null
	let repeatInterval: ReturnType<typeof setInterval> | null = null
	let repeatCount = 0

	// Acceleration config
	const INITIAL_DELAY = 300 // ms before repeat starts
	const INITIAL_INTERVAL = 80 // ms between repeats initially
	const MIN_INTERVAL = 25 // ms minimum interval (fastest speed)
	const ACCELERATION_RATE = 0.92 // multiply interval by this each repeat (closer to 1 = slower acceleration)
	const ACCELERATION_STEPS = 30 // number of repeats before reaching max speed

	const stopKeyRepeat = () => {
		if (repeatTimeout) {
			clearTimeout(repeatTimeout)
			repeatTimeout = null
		}
		if (repeatInterval) {
			clearInterval(repeatInterval)
			repeatInterval = null
		}
		activeKey = null
		repeatCount = 0
	}

	const executeKeyAction = (key: RepeatableKey, ctrlOrMeta: boolean) => {
		switch (key) {
			case 'ArrowLeft':
				cursorActions.moveCursor('left', ctrlOrMeta)
				break
			case 'ArrowRight':
				cursorActions.moveCursor('right', ctrlOrMeta)
				break
			case 'ArrowUp':
				cursorActions.moveCursor('up')
				break
			case 'ArrowDown':
				cursorActions.moveCursor('down')
				break
		}
	}

	const startKeyRepeat = (key: RepeatableKey, ctrlOrMeta: boolean) => {
		stopKeyRepeat()
		activeKey = key

		// Execute immediately on first press
		executeKeyAction(key, ctrlOrMeta)

		// Start repeat after initial delay
		repeatTimeout = setTimeout(() => {
			let currentInterval = INITIAL_INTERVAL

			const doRepeat = () => {
				if (activeKey !== key) return

				executeKeyAction(key, ctrlOrMeta)
				repeatCount++

				// Accelerate if not at max speed
				if (repeatCount < ACCELERATION_STEPS) {
					currentInterval = Math.max(
						MIN_INTERVAL,
						currentInterval * ACCELERATION_RATE
					)
				}

				// Schedule next repeat with potentially faster interval
				repeatTimeout = setTimeout(doRepeat, currentInterval)
			}

			doRepeat()
		}, INITIAL_DELAY)
	}

	// Cleanup on unmount
	onCleanup(() => {
		stopKeyRepeat()
	})

	const handleKeyDown = (event: KeyboardEvent) => {
		const ctrlOrMeta = event.ctrlKey || event.metaKey

		// Backspace
		if (event.key === 'Backspace') {
			event.preventDefault()
			const offset = cursorState().position.offset
			if (offset === 0) return
			applyDelete(offset - 1, 1)
			cursorActions.setCursorOffset(offset - 1)
			return
		}

		// Delete
		if (event.key === 'Delete') {
			event.preventDefault()
			const offset = cursorState().position.offset
			applyDelete(offset, 1)
			return
		}

		// Arrow keys with acceleration
		if (
			event.key === 'ArrowLeft' ||
			event.key === 'ArrowRight' ||
			event.key === 'ArrowUp' ||
			event.key === 'ArrowDown'
		) {
			event.preventDefault()
			// Only start new repeat if this isn't a browser repeat event
			if (!event.repeat && activeKey !== event.key) {
				startKeyRepeat(event.key as RepeatableKey, ctrlOrMeta)
			}
			return
		}

		// Home
		if (event.key === 'Home') {
			event.preventDefault()
			cursorActions.moveCursorHome(ctrlOrMeta)
			return
		}

		// End
		if (event.key === 'End') {
			event.preventDefault()
			cursorActions.moveCursorEnd(ctrlOrMeta)
			return
		}

		// Page Up
		if (event.key === 'PageUp') {
			event.preventDefault()
			// Move cursor up by visible page height
			const visibleLines = visibleLineRange().end - visibleLineRange().start
			for (let i = 0; i < visibleLines; i++) {
				cursorActions.moveCursor('up')
			}
			return
		}

		// Page Down
		if (event.key === 'PageDown') {
			event.preventDefault()
			// Move cursor down by visible page height
			const visibleLines = visibleLineRange().end - visibleLineRange().start
			for (let i = 0; i < visibleLines; i++) {
				cursorActions.moveCursor('down')
			}
			return
		}
	}

	const handleKeyUp = (event: KeyboardEvent) => {
		// Stop repeat when arrow key is released
		if (
			event.key === 'ArrowLeft' ||
			event.key === 'ArrowRight' ||
			event.key === 'ArrowUp' ||
			event.key === 'ArrowDown'
		) {
			if (activeKey === event.key) {
				stopKeyRepeat()
			}
		}
	}

	// Line number gutter width (w-10 = 2.5rem = 40px at default)
	const LINE_NUMBER_WIDTH = 40
	// Gap between line number and content (gap-4 = 1rem = 16px)
	const CONTENT_GAP = 16
	// Horizontal padding (px-3 = 0.75rem = 12px)
	const PADDING_LEFT = 12

	return (
		<Show
			when={hasLineEntries()}
			fallback={
				<p class="mt-4 text-sm text-zinc-500">
					Line information is not available for this file yet.
				</p>
			}
		>
			<div
				ref={element => {
					scrollElement = element
				}}
				class="relative mt-4 flex-1 overflow-auto rounded border border-zinc-800/70 bg-zinc-950/30"
				style={{
					'font-size': `${props.fontSize()}px`,
					'font-family': props.fontFamily()
				}}
				onClick={() => focusInput()}
			>
				<textarea
					ref={element => {
						inputElement = element
					}}
					class="absolute left-0 top-0 h-0 w-0 opacity-0"
					autocomplete="off"
					autocorrect="off"
					spellcheck={false}
					onInput={event => handleInput(event as unknown as InputEvent)}
					onKeyDown={event => handleKeyDown(event as unknown as KeyboardEvent)}
					onKeyUp={event => handleKeyUp(event as unknown as KeyboardEvent)}
				/>
				<div
					style={{
						height: `${totalSize()}px`,
						position: 'relative'
					}}
				>
					<Cursor
						cursorState={cursorState}
						fontSize={props.fontSize()}
						fontFamily={props.fontFamily()}
						charWidth={charWidth()}
						lineNumberWidth={LINE_NUMBER_WIDTH + CONTENT_GAP}
						paddingLeft={PADDING_LEFT}
						visibleLineStart={visibleLineRange().start}
						visibleLineEnd={visibleLineRange().end}
						getLineY={getLineY}
					/>
					<VirtualizedRows
						rows={virtualItems}
						columns={columnItems}
						entries={lineEntries}
						totalColumnWidth={columnTotalSize}
						rowVirtualizer={rowVirtualizer}
						lineHeight={lineHeightEstimate}
						fontSize={props.fontSize}
						fontFamily={props.fontFamily}
						onRowClick={handleRowClick}
						onPreciseClick={handlePreciseClick}
						activeLineIndex={activeLineIndex}
					/>
				</div>
			</div>
		</Show>
	)
}

// Wrapper component that provides the cursor context
const TextFileEditor = (props: TextFileEditorProps) => {
	const [state] = useFs()

	const pieceTableText = createMemo(() => {
		const snapshot = state.selectedFilePieceTable
		if (snapshot) {
			return getPieceTableText(snapshot)
		}
		const stats = props.stats()
		return stats?.text ?? ''
	})

	const lineEntries = createMemo<LineEntry[]>(() => {
		if (!props.isFileSelected()) return []

		const text = pieceTableText()

		if (text.length === 0) {
			return [
				{
					index: 0,
					start: 0,
					length: 0,
					text: ''
				}
			]
		}

		const entries: LineEntry[] = []
		let lineStart = 0
		let index = 0

		for (let i = 0; i < text.length; i++) {
			if (text[i] === '\n') {
				const rawLine = text.slice(lineStart, i)
				const length = i - lineStart + 1
				entries.push({
					index,
					start: lineStart,
					length,
					text: rawLine
				})
				index++
				lineStart = i + 1
			}
		}

		if (lineStart <= text.length) {
			const rawLine = text.slice(lineStart)
			entries.push({
				index,
				start: lineStart,
				length: text.length - lineStart,
				text: rawLine
			})
		}

		return entries
	})

	const documentLength = createMemo(() => pieceTableText().length)

	return (
		<CursorProvider
			filePath={() => state.lastKnownFilePath}
			lineEntries={lineEntries}
			documentText={pieceTableText}
			documentLength={documentLength}
		>
			<TextFileEditorInner {...props} />
		</CursorProvider>
	)
}

export const Editor = (props: EditorProps) => {
	const isBinary = createMemo(() => props.stats()?.contentKind === 'binary')

	return (
		<Show
			when={props.isFileSelected()}
			fallback={
				<p class="mt-2 text-sm text-zinc-500">
					Select a file to view its contents. Click folders to toggle
					visibility.
				</p>
			}
		>
			<Show when={isBinary()} fallback={<TextFileEditor {...props} />}>
				<BinaryFileViewer
					data={props.previewBytes ?? (() => undefined)}
					stats={props.stats}
					fontSize={props.fontSize}
					fontFamily={props.fontFamily}
				/>
			</Show>
		</Show>
	)
}
