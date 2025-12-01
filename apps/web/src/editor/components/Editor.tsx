/* eslint-disable solid/prefer-for */
import { createVirtualizer } from '@tanstack/solid-virtual'
import { Show, createEffect, createMemo, createSignal } from 'solid-js'
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
import {
	COLUMN_CHARS_PER_ITEM,
	HORIZONTAL_VIRTUALIZER_OVERSCAN,
	VERTICAL_VIRTUALIZER_OVERSCAN
} from '../consts'
import { estimateColumnWidth, estimateLineHeight } from '../utils'
import type { EditorProps, LineEntry, TextFileEditorProps } from '../types'

const TextFileEditor = (props: TextFileEditorProps) => {
	const [state, { updateSelectedFilePieceTable }] = useFs()
	const [cursorOffset, setCursorOffset] = createSignal(0)

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

	const activeLineIndex = createMemo<number | null>(() => {
		const entries = lineEntries()
		if (!entries.length) return null
		const offset = cursorOffset()
		let result = entries[0]!.index
		for (const entry of entries) {
			if (offset >= entry.start) {
				result = entry.index
			} else {
				break
			}
		}
		return result
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

	createEffect(() => {
		// Reset cursor and scroll when switching files
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		state.lastKnownFilePath
		setCursorOffset(0)
		if (scrollElement) {
			scrollElement.scrollTop = 0
			scrollElement.scrollLeft = 0
		}
	})

	createEffect(() => {
		const snapshot = state.selectedFilePieceTable
		const length = snapshot
			? getPieceTableLength(snapshot)
			: pieceTableText().length
		if (cursorOffset() > length) {
			setCursorOffset(length)
		}
	})

	const virtualItems = () => rowVirtualizer.getVirtualItems()
	const totalSize = () => rowVirtualizer.getTotalSize()
	const columnItems = () => columnVirtualizer.getVirtualItems()
	const columnTotalSize = () => columnVirtualizer.getTotalSize()
	const lineHeightEstimate = createMemo(() =>
		estimateLineHeight(props.fontSize())
	)

	const handleRowClick = (entry: LineEntry) => {
		const text = pieceTableText()
		const endOfLine = entry.start + entry.text.length
		const nextOffset = Math.min(endOfLine, text.length)
		setCursorOffset(nextOffset)
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
		updateSelectedFilePieceTable(current => {
			const baseSnapshot = current ?? createPieceTableSnapshot(pieceTableText())
			return insertIntoPieceTable(baseSnapshot, cursorOffset(), value)
		})
		setCursorOffset(prev => prev + value.length)
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

	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Backspace') {
			event.preventDefault()
			const offset = cursorOffset()
			if (offset === 0) return
			applyDelete(offset - 1, 1)
			setCursorOffset(offset - 1)
			return
		}

		if (event.key === 'Delete') {
			event.preventDefault()
			const offset = cursorOffset()
			applyDelete(offset, 1)
			return
		}

		if (event.key === 'ArrowLeft') {
			event.preventDefault()
			setCursorOffset(offset => Math.max(0, offset - 1))
			return
		}

		if (event.key === 'ArrowRight') {
			event.preventDefault()
			const snapshot = state.selectedFilePieceTable
			const length = snapshot
				? getPieceTableLength(snapshot)
				: pieceTableText().length
			setCursorOffset(offset => Math.min(length, offset + 1))
		}
	}

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
				/>
				<div
					style={{
						height: `${totalSize()}px`,
						position: 'relative'
					}}
				>
					<VirtualizedRows
						rows={virtualItems}
						columns={columnItems}
						entries={lineEntries}
						totalColumnWidth={columnTotalSize}
						rowVirtualizer={rowVirtualizer}
						lineHeight={lineHeightEstimate}
						onRowClick={handleRowClick}
						activeLineIndex={activeLineIndex}
					/>
				</div>
			</div>
		</Show>
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
