import { For, Show, createMemo, type Accessor } from 'solid-js'
import {
	createSolidTable,
	getCoreRowModel,
	getPaginationRowModel,
	flexRender,
	type ColumnDef,
	type CellContext,
} from '@tanstack/solid-table'
import { Flex } from '@repo/ui/flex'
import { TextField, TextFieldInput } from '@repo/ui/text-field'
import {
	Pagination,
	PaginationEllipsis,
	PaginationItem,
	PaginationItems,
	PaginationNext,
	PaginationPrevious,
} from '@repo/ui/pagination'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@repo/ui/table'
import { cn } from '@repo/ui/utils'

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
	const columns = createMemo<ColumnDef<Record<string, unknown>>[]>(() =>
		props.columns().map((col) => ({
			accessorKey: col,
			header: col,
			cell: (info: CellContext<Record<string, unknown>, unknown>) => {
				const row = info.row.original
				const value = info.getValue()

				const isEditable = () =>
					props.selectedTable() &&
					(props.hasRowId() || props.primaryKeys().length > 0)

				const isEditing = () =>
					props.editingCell()?.row === row && props.editingCell()?.col === col

				return (
					<div
						class={cn(
							'w-full h-full flex items-center px-3 py-1 min-h-[28px]',
							isEditable() ? 'cursor-text hover:bg-muted/50' : ''
						)}
						onClick={() => {
							if (isEditable()) {
								props.setEditingCell({
									row,
									col,
									value: row[col],
								})
							}
						}}
					>
						<Show
							when={isEditing()}
							fallback={
								value === null ? (
									<span class="text-muted-foreground italic">null</span>
								) : (
									<span class="truncate">{String(value)}</span>
								)
							}
						>
							<div class="w-full h-full -ml-1 -my-1">
								<TextField
									value={String(props.editingCell()?.value ?? '')}
									onChange={(v) => {
										const prev = props.editingCell()
										if (prev) {
											props.setEditingCell({
												...prev,
												value: v,
											})
										}
									}}
									class="w-full h-full"
								>
									<TextFieldInput
										ref={(el: HTMLInputElement) =>
											setTimeout(() => el.focus(), 0)
										}
										class="w-full h-full min-h-0 px-1 py-0 rounded-none border-primary outline-none focus-visible:ring-0 text-xs bg-background"
										onBlur={() => props.onCommitEdit()}
										onKeyDown={(e) => {
											if (e.key === 'Enter') props.onCommitEdit()
											if (e.key === 'Escape') props.setEditingCell(null)
										}}
									/>
								</TextField>
							</div>
						</Show>
					</div>
				)
			},
		}))
	)

	const table = createSolidTable({
		get data() {
			return props.rows()
		},
		get columns() {
			return columns()
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: {
			pagination: {
				pageSize: 50,
			},
		},
	})

	return (
		<Flex
			flexDirection="col"
			alignItems="stretch"
			class="rounded-lg border border-border overflow-hidden bg-card shadow-sm flex-1 min-h-0"
		>
			<div class="overflow-auto flex-1 flex flex-col min-h-0">
				<Table>
					<TableHeader class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm shadow-sm">
						<For each={table.getHeaderGroups()}>
							{(headerGroup) => (
								<TableRow>
									<For each={headerGroup.headers}>
										{(header) => (
											<TableHead class="whitespace-nowrap h-8 px-0 py-0 font-medium text-muted-foreground bg-muted/50">
												<div class="px-4 py-2 border-r border-border/50 last:border-0">
													{header.isPlaceholder
														? null
														: flexRender(
																header.column.columnDef.header,
																header.getContext()
															)}
												</div>
											</TableHead>
										)}
									</For>
								</TableRow>
							)}
						</For>
					</TableHeader>
					<TableBody>
						<Show
							when={table.getRowModel().rows.length > 0}
							fallback={
								<TableRow>
									<TableCell
										colSpan={props.columns().length}
										class="h-24 text-center"
									>
										No results
									</TableCell>
								</TableRow>
							}
						>
							<For each={table.getRowModel().rows}>
								{(row) => (
									<TableRow
										data-state={row.getIsSelected() && 'selected'}
										class="hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
									>
										<For each={row.getVisibleCells()}>
											{(cell) => (
												<TableCell class="p-0 border-r border-border/30 last:border-r-0 max-w-[300px] overflow-hidden font-mono text-xs">
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext()
													)}
												</TableCell>
											)}
										</For>
									</TableRow>
								)}
							</For>
						</Show>
					</TableBody>
				</Table>
			</div>

			<div class="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground flex items-center justify-between shrink-0">
				<div class="flex items-center gap-4">
					<span>
						Showing{' '}
						{table.getState().pagination.pageIndex *
							table.getState().pagination.pageSize +
							1}
						-
						{Math.min(
							(table.getState().pagination.pageIndex + 1) *
								table.getState().pagination.pageSize,
							props.rows().length
						)}{' '}
						of {props.rows().length} rows
					</span>

					<span class="font-mono opacity-50 border-l border-border pl-4">
						{props.selectedTable()
							? `Source: ${props.selectedTable()}`
							: 'Custom Query'}
					</span>
				</div>

				<Pagination
					count={Math.ceil(
						props.rows().length / table.getState().pagination.pageSize
					)}
					page={table.getState().pagination.pageIndex + 1}
					onPageChange={(page) => table.setPageIndex(page - 1)}
					itemComponent={(props) => (
						<PaginationItem page={props.page}>{props.page}</PaginationItem>
					)}
					ellipsisComponent={() => <PaginationEllipsis />}
				>
					<PaginationPrevious />
					<PaginationItems />
					<PaginationNext />
				</Pagination>
			</div>
		</Flex>
	)
}
