/* eslint-disable solid/prefer-for */
import { createVirtualizer } from '@tanstack/solid-virtual'
import { type Accessor, Show, createEffect, createMemo } from 'solid-js'
import type { ParseResult, LineInfo } from '~/utils/parse'

const LINE_HEIGHT_RATIO = 1.55
const MIN_ESTIMATED_LINE_HEIGHT = 18
const VIRTUALIZER_OVERSCAN = 10

const estimateLineHeight = (fontSize: number) =>
	Math.max(Math.round(fontSize * LINE_HEIGHT_RATIO), MIN_ESTIMATED_LINE_HEIGHT)

type SelectedFileCodeViewProps = {
	isFileSelected: Accessor<boolean>
	stats: Accessor<ParseResult | undefined>
	fontSize: Accessor<number>
	fontFamily: Accessor<string>
}

type LineEntry = {
	info: LineInfo
	text: string
}

export const SelectedFileCodeView = (props: SelectedFileCodeViewProps) => {
	const lineEntries = createMemo<LineEntry[]>(() => {
		if (!props.isFileSelected()) return []
		const stats = props.stats()
		if (!stats?.lineInfo?.length || stats.text == null) return []

		return stats.lineInfo.map(info => {
			const sliceStart = info.start
			const sliceEnd = sliceStart + info.length
			const rawLine = stats.text.slice(sliceStart, sliceEnd)
			const text = rawLine.replace(/\r?\n$/, '')

			return { info, text }
		})
	})
	const hasLineEntries = () => lineEntries().length > 0

	let scrollElement: HTMLDivElement | null = null

	const rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
		get count() {
			return lineEntries().length
		},
		get enabled() {
			return props.isFileSelected() && hasLineEntries()
		},
		getScrollElement: () => scrollElement,
		estimateSize: () => estimateLineHeight(props.fontSize()),
		overscan: VIRTUALIZER_OVERSCAN
	})

	createEffect(() => {
		props.fontSize()
		props.fontFamily()
		rowVirtualizer.measure()
	})

	createEffect(() => {
		lineEntries()
		rowVirtualizer.measure()
		if (scrollElement) {
			scrollElement.scrollTop = 0
		}
	})

	createEffect(() => {
		if (!props.isFileSelected()) {
			scrollElement = null
		}
	})

	const virtualItems = () => rowVirtualizer.getVirtualItems()
	const totalSize = () => rowVirtualizer.getTotalSize()

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
					class="mt-4 flex-1 overflow-auto rounded border border-zinc-800/70 bg-zinc-950/30"
					style={{
						'font-size': `${props.fontSize()}px`,
						'font-family': props.fontFamily()
					}}
				>
					<div
						style={{
							height: `${totalSize()}px`,
							position: 'relative'
						}}
					>
						{virtualItems().map(virtualRow => {
							const entry = lineEntries()[virtualRow.index]
							if (!entry) return null

							return (
								<div
									data-index={virtualRow.index}
									ref={el =>
										queueMicrotask(() => rowVirtualizer.measureElement(el))
									}
									class="absolute left-0 right-0"
									style={{
										transform: `translateY(${virtualRow.start}px)`,
										top: 0,
										height: `${virtualRow.size}px`
									}}
								>
									<div class="flex items-start gap-4 px-3 py-1 text-zinc-100">
										<span class="w-10 shrink-0 text-right text-[11px] font-semibold tracking-[0.08em] text-zinc-500 tabular-nums">
											{entry.info.index + 1}
										</span>
										<div class="min-w-0 flex-1 whitespace-pre">
											{entry.text}
										</div>
									</div>
								</div>
							)
						})}
					</div>
				</div>
			</Show>
		</Show>
	)
}
