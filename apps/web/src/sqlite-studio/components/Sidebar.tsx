import { For, Show } from 'solid-js'
import { ResetDatabaseButton } from './ResetDatabaseButton'

type SidebarProps = {
	tables: string[]
	selectedTable: string | null
	currentQuery: string
	onLoadTable: (table: string) => void
	onRefreshSchema: () => void
	setSqlQuery: (query: string) => void
	setSelectedTable: (table: string | null) => void
	onResetDatabase: () => void
	onLoadExample: (example: string) => void
}

export const Sidebar = (props: SidebarProps) => {
	return (
		<aside class="w-64 border-r border-border bg-card flex flex-col">
			<div class="p-2 border-b border-border">
				<h1 class="text-xs font-bold tracking-widest text-muted-foreground uppercase">
					One Table
				</h1>
				<div class="text-lg font-semibold text-foreground tracking-tight">
					SQLite Studio
				</div>
			</div>
			<div class="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
				<div class="py-1 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
					Tables
				</div>
				<div>
					<For each={props.tables}>
						{(table) => (
							<button
								onClick={() => props.onLoadTable(table)}
								class="w-full text-left px-1 pb-1 rounded-sm text-xs transition-colors border"
								classList={{
									'bg-primary/10 text-primary font-medium border-primary/20':
										props.selectedTable === table,
									'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent':
										props.selectedTable !== table,
								}}
							>
								{table}
							</button>
						)}
					</For>
					<Show when={props.tables.length === 0}>
						<div class="px-3 py-2 text-sm text-muted-foreground italic">
							No tables found
						</div>
					</Show>
				</div>
				<div class="py-1 px-1 mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
					Examples
				</div>
				<div>
					<button
						onClick={() => props.onLoadExample('file-search')}
						class="w-full text-left px-1 pb-1 rounded-sm text-xs transition-colors border"
						classList={{
							'bg-primary/10 text-primary font-medium border-primary/20':
								props.selectedTable === 'example:file-search',
							'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent':
								props.selectedTable !== 'example:file-search',
						}}
					>
						File Search
					</button>
				</div>
			</div>
			<div class="p-4 border-t border-border space-y-2">
				<button
					onClick={() => props.onRefreshSchema()}
					class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-md text-xs font-medium transition-colors"
				>
					Refresh Schema
				</button>
				<ResetDatabaseButton
					onReset={props.onResetDatabase}
					variant="sidebar"
				/>
			</div>
		</aside>
	)
}
