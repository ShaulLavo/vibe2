/* eslint-disable solid/prefer-for */
import { COLUMN_CHARS_PER_ITEM } from '../consts'
import type {
	LineEntry,
	VirtualizedRowProps,
	VirtualizedRowsProps
} from '../types'

export const VirtualizedRow = (props: VirtualizedRowProps) => {
	let rowElement: HTMLDivElement | null = null

	const measure = () => {
		props.rowVirtualizer.measureElement(rowElement)
	}

	return (
		<div
			data-index={props.virtualRow.index}
			ref={el => {
				rowElement = el
				queueMicrotask(measure)
			}}
			class="absolute left-0 right-0 "
			style={{
				transform: `translateY(${props.virtualRow.start}px)`,
				top: 0,
				height: `${props.virtualRow.size || props.lineHeight}px`
			}}
		>
			<div
				class="flex items-start gap-4 px-3 py-1 text-zinc-100"
				classList={{ 'bg-zinc-900/60': props.isActive }}
				onClick={event => {
					// Only treat as a caret move on a plain left-click with no modifiers and no active text selection.
					if (
						event.button !== 0 ||
						event.shiftKey ||
						event.ctrlKey ||
						event.metaKey
					) {
						return
					}
					const selection = window.getSelection()
					if (!selection || selection.isCollapsed) {
						props.onRowClick(props.entry)
					}
				}}
			>
				<span class="w-10 shrink-0 text-right text-[11px] font-semibold tracking-[0.08em] text-zinc-500 tabular-nums">
					{props.entry.index + 1}
				</span>
				<div
					class="relative h-full whitespace-pre"
					style={{
						width: `${props.totalColumnWidth}px`,
						height: `${props.virtualRow.size || props.lineHeight}px`
					}}
				>
					{props.columns.map(column => {
						const chunkStart = column.index * COLUMN_CHARS_PER_ITEM
						const chunkEnd = chunkStart + COLUMN_CHARS_PER_ITEM
						const chunkText = props.entry.text.slice(chunkStart, chunkEnd)
						if (!chunkText) return null
						return (
							<span
								data-column-index={column.index}
								class="absolute inset-y-0 overflow-hidden whitespace-pre"
								style={{
									transform: `translateX(${column.start}px)`,
									width: `${column.size}px`
								}}
							>
								{chunkText}
							</span>
						)
					})}
				</div>
			</div>
		</div>
	)
}

export const VirtualizedRows = (props: VirtualizedRowsProps) => {
	return (
		<>
			{props.rows().map(virtualRow => {
				const entry: LineEntry | undefined = props.entries()[virtualRow.index]
				if (!entry) return null

				return (
					<VirtualizedRow
						rowVirtualizer={props.rowVirtualizer}
						virtualRow={virtualRow}
						entry={entry}
						columns={props.columns()}
						totalColumnWidth={props.totalColumnWidth()}
						lineHeight={props.lineHeight()}
						onRowClick={props.onRowClick}
						isActive={props.activeLineIndex() === entry.index}
					/>
				)
			})}
		</>
	)
}
