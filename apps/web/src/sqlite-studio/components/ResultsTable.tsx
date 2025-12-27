import { For, Show, createSignal, createMemo, type Accessor } from 'solid-js'
import {
	createFixedRowVirtualizer,
	type FixedRowVirtualizer,
} from '@repo/code-editor'

const ROW_HEIGHT = 28
const OVERSCAN = 5

type ResultsTableProps = {
	columns: Accessor<string[]>
	rows: Accessor<Record<string, unknown>[]>
	selectedTable: Accessor<string | null>
	queryResults: Accessor<Record<string, unknown>[] | null>
	hasRowId: Accessor<boolean>
	primaryKeys: Accessor<string[]>
	editingCell: Accessor<{
		row: Record<string, unknown>
		col: string
		value: unknown
	} | null>
	setEditingCell: (
		cell: {
			row: Record<string, unknown>
			col: string
			value: unknown
		} | null
	) => void
	onCommitEdit: () => void
}

export const ResultsTable = (props: ResultsTableProps) => {
	const [scrollElement, setScrollElement] = createSignal<HTMLElement | null>(
		null
	)

	const virtualizer: FixedRowVirtualizer = createFixedRowVirtualizer({
		count: () => props.rows().length,
		enabled: () => true,
		scrollElement,
		rowHeight: () => ROW_HEIGHT,
		overscan: OVERSCAN,
	})

	// Use columns directly (rowid is not included in columns state)
	const displayColumns = createMemo(() => props.columns())

	// Smart column sizing: 3fr for paths, 2fr for names, 1fr for most, 0.5fr for tiny
	const gridTemplate = createMemo(() =>
		displayColumns()
			.map((col) => {
				const lc = col.toLowerCase()
				// Full paths get most space
				if (lc === 'path' || lc === 'path_lc') return '3fr'
				// Names and directories get medium space
				if (lc.includes('basename') && !lc.includes('initials')) return '2fr'
				if (lc.includes('dir')) return '2fr'
				// Tiny columns
				if (lc === 'id' || lc === 'recency') return '0.5fr'
				// Everything else (initials, kind) gets 1fr
				return '1fr'
			})
			.join(' ')
	)

	return (
		<div class="rounded-lg border border-border overflow-hidden bg-card shadow-sm flex flex-col flex-1 min-h-0">
			{/* Fixed Header */}
			<div
				class="shrink-0 bg-muted/50 border-b border-border grid text-sm font-medium text-muted-foreground"
				style={{ 'grid-template-columns': gridTemplate() }}
			>
				<For each={displayColumns()}>
					{(col) => (
						<div class="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis">
							{col}
						</div>
					)}
				</For>
			</div>

			{/* Virtualized Body */}
			<div ref={setScrollElement} class="overflow-auto flex-1 min-h-0">
				<div
					style={{
						height: `${virtualizer.totalSize()}px`,
						position: 'relative',
					}}
				>
					<Show
						when={props.rows().length > 0}
						fallback={
							<div class="px-4 py-8 text-center text-muted-foreground italic">
								No results
							</div>
						}
					>
						<For each={virtualizer.virtualItems()}>
							{(virtualItem) => {
								const row = props.rows()[virtualItem.index]
								if (!row) return null
								return (
									<div
										class="grid text-sm hover:bg-muted/50 transition-colors"
										style={{
											'grid-template-columns': gridTemplate(),
											position: 'absolute',
											top: `${virtualItem.start}px`,
											left: 0,
											right: 0,
											height: `${ROW_HEIGHT}px`,
										}}
									>
										<For each={displayColumns()}>
											{(col) => (
												<div
													class={`px-3 py-1 text-foreground whitespace-nowrap overflow-x-auto font-mono text-xs flex items-center border-r border-border/30 last:border-r-0 scrollbar-none ${
														props.hasRowId() || props.primaryKeys().length > 0
															? 'cursor-text hover:bg-muted'
															: ''
													}`}
													style={{ 'scrollbar-width': 'none' }}
													onClick={() => {
														if (
															props.selectedTable() &&
															(props.hasRowId() ||
																props.primaryKeys().length > 0)
														) {
															props.setEditingCell({
																row,
																col,
																value: row[col],
															})
														}
													}}
												>
													<Show
														when={
															props.editingCell()?.row === row &&
															props.editingCell()?.col === col
														}
														fallback={
															row[col] === null ? (
																<span class="text-muted-foreground italic">
																	null
																</span>
															) : (
																String(row[col])
															)
														}
													>
														<input
															ref={(el) => setTimeout(() => el.focus(), 0)}
															value={String(props.editingCell()?.value ?? '')}
															class="w-full bg-background text-foreground px-1 py-0.5 rounded border border-primary outline-none"
															onInput={(e) => {
																const prev = props.editingCell()
																if (prev) {
																	props.setEditingCell({
																		...prev,
																		value: e.currentTarget.value,
																	})
																}
															}}
															onBlur={() => props.onCommitEdit()}
															onKeyDown={(e) => {
																if (e.key === 'Enter') props.onCommitEdit()
																if (e.key === 'Escape')
																	props.setEditingCell(null)
															}}
														/>
													</Show>
												</div>
											)}
										</For>
									</div>
								)
							}}
						</For>
					</Show>
				</div>
			</div>
			<div class="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground flex justify-between shrink-0">
				<span>Showing {props.rows().length} rows</span>
				<span class="font-mono opacity-50">
					{props.selectedTable()
						? `Source: ${props.selectedTable()}`
						: 'Custom Query'}
				</span>
			</div>
		</div>
	)
}
