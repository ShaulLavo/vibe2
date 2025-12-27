import { For, Show, onMount } from 'solid-js'
import type { SearchResult } from '../../workers/sqlite'

type Props = {
	searchQuery: () => string
	setSearchQuery: (q: string) => void
	onSearch: () => void
	results: () => SearchResult[] | null
	isLoading: () => boolean
}

export const SearchFiles = (props: Props) => {
	onMount(() => {
		if (!props.results() && !props.isLoading()) {
			props.onSearch()
		}
	})

	return (
		<div class="flex flex-col flex-1 gap-4 p-4 border-b border-border bg-card overflow-hidden">
			<div class="flex gap-2">
				<input
					type="text"
					value={props.searchQuery()}
					onInput={(e) => {
						props.setSearchQuery(e.currentTarget.value)
						props.onSearch()
					}}
					placeholder="Search files (fuzzy)..."
					class="flex-1 bg-background border border-input rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
				/>
			</div>

			<div class="flex gap-2 items-center text-muted-foreground">
				<span class="text-xs">Examples:</span>
				<div class="flex gap-1">
					<For each={['utils', '.tsx', 'schema', 'test']}>
						{(term) => (
							<button
								onClick={() => {
									props.setSearchQuery(term)
									props.onSearch()
								}}
								class="text-xs bg-muted hover:bg-muted/80 text-muted-foreground px-2 py-0.5 rounded border border-input transition-colors"
							>
								{term}
							</button>
						)}
					</For>
				</div>
			</div>

			<Show
				when={props.results()}
				fallback={
					<div class="flex items-center justify-center h-32 text-muted-foreground text-sm animate-pulse">
						Loading data...
					</div>
				}
			>
				<div class="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
					<div class="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center justify-between min-h-[20px]">
						<span>Found {props.results()?.length} results</span>
						<Show when={props.isLoading()}>
							<span class="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground animate-pulse border border-input">
								Updating...
							</span>
						</Show>
					</div>
					<For each={props.results()}>
						{(file) => (
							<div class="flex items-center justify-between px-2 py-1 rounded hover:bg-muted/50 group">
								<div class="flex flex-col gap-0.5 min-w-0">
									<span class="text-sm text-foreground truncate font-mono">
										{file.path.split('/').pop()}
									</span>
									<span class="text-xs text-muted-foreground truncate font-mono">
										{file.path}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-input">
										{file.kind}
									</span>
									<span class="text-[10px] text-muted-foreground font-mono">
										#{file.id}
									</span>
								</div>
							</div>
						)}
					</For>
					<Show when={props.results()?.length === 0}>
						<div class="text-muted-foreground text-sm italic py-2">
							No files found matching "{props.searchQuery()}"
						</div>
					</Show>
				</div>
			</Show>
		</div>
	)
}
