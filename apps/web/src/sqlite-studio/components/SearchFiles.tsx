import { For, Show, onMount } from 'solid-js'
import { TextField, TextFieldInput } from '@repo/ui/text-field'
import { Button } from '@repo/ui/button'
import { Flex } from '@repo/ui/flex'
import type { SearchResult } from '../../search/types'

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
		<Flex
			flexDirection="col"
			alignItems="stretch"
			class="flex-1 gap-4 p-4 border-b border-border bg-card overflow-hidden"
		>
			<Flex justifyContent="start" class="gap-2">
				<TextField
					value={props.searchQuery()}
					onChange={(v) => {
						props.setSearchQuery(v)
						props.onSearch()
					}}
					class="flex-1"
				>
					<TextFieldInput placeholder="Search files (fuzzy)..." />
				</TextField>
			</Flex>

			<Flex justifyContent="start" class="gap-2 text-muted-foreground">
				<span class="text-xs">Examples:</span>
				<div class="flex gap-1">
					<For each={['utils', '.tsx', 'schema', 'test']}>
						{(term) => (
							<Button
								onClick={() => {
									props.setSearchQuery(term)
									props.onSearch()
								}}
								variant="secondary"
								class="h-auto text-xs px-2 py-0.5 border border-input"
							>
								{term}
							</Button>
						)}
					</For>
				</div>
			</Flex>

			<Show
				when={props.results()}
				fallback={
					<Flex
						justifyContent="center"
						class="h-32 text-muted-foreground text-sm animate-pulse"
					>
						Loading data...
					</Flex>
				}
			>
				<Flex
					flexDirection="col"
					alignItems="stretch"
					class="gap-2 flex-1 overflow-y-auto min-h-0"
				>
					<Flex
						justifyContent="between"
						class="text-xs font-mono text-muted-foreground uppercase tracking-wider min-h-[20px]"
					>
						<span>Found {props.results()?.length} results</span>
						<Show when={props.isLoading()}>
							<span class="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground animate-pulse border border-input">
								Updating...
							</span>
						</Show>
					</Flex>
					<For each={props.results()}>
						{(file) => (
							<Flex
								justifyContent="between"
								class="px-2 py-1 rounded hover:bg-muted/50 group"
							>
								<Flex
									flexDirection="col"
									alignItems="start"
									class="gap-0.5 min-w-0 flex-1 w-auto"
								>
									<span class="text-sm text-foreground truncate font-mono">
										{file.path.split('/').pop()}
									</span>
									<span class="text-xs text-muted-foreground truncate font-mono">
										{file.path}
									</span>
								</Flex>
								<Flex justifyContent="start" class="gap-2 shrink-0 w-auto">
									<span class="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-input">
										{file.kind}
									</span>
									<span class="text-[10px] text-muted-foreground font-mono">
										#{file.id}
									</span>
								</Flex>
							</Flex>
						)}
					</For>
					<Show when={props.results()?.length === 0}>
						<div class="text-muted-foreground text-sm italic py-2">
							No files found matching "{props.searchQuery()}"
						</div>
					</Show>
				</Flex>
			</Show>
		</Flex>
	)
}
