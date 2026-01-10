import { For, Show, Suspense, createSignal } from 'solid-js'
import { VsSearch, VsDownload, VsClose } from '@repo/icons/vs'
import { useFontStore } from '../store/FontStoreProvider'
import { SelectableFontCard } from './SelectableFontCard'
import { FontErrorBoundary } from './ErrorBoundary/FontErrorBoundary'
import { useMultiSelect } from '../hooks/useMultiSelect'

export const FontBrowser = () => {
	const { availableFonts, installedFonts, pending, actions } = useFontStore()
	const [searchQuery, setSearchQuery] = createSignal('')
	const selection = useMultiSelect<string>()

	const filteredFonts = () => {
		const fonts = availableFonts() || {}
		const query = searchQuery().toLowerCase()

		if (!query) return Object.entries(fonts)

		return Object.entries(fonts).filter(([name]) =>
			name.toLowerCase().includes(query)
		)
	}

	// Check if font is in download queue
	const isInDownloadQueue = (fontName: string) => {
		const { state } = useFontStore()
		return state.downloadQueue.has(fontName)
	}

	const handleBatchDownload = async () => {
		if (selection.count() === 0) return
		const fontsToDownload = Array.from(selection.selected())
		await actions.downloadMultipleFonts(fontsToDownload)
		selection.exitSelectMode()
	}

	return (
		<div class="space-y-4">
			{/* Search Input - Always visible */}
			<div class="relative flex gap-2">
				<div class="relative flex-1">
					<VsSearch class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search fonts..."
						value={searchQuery()}
						onInput={(e) => setSearchQuery(e.currentTarget.value)}
						class="w-full pl-10 pr-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
					/>
				</div>
				<Show when={selection.count() > 0}>
					<div class="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
						<button
							onClick={handleBatchDownload}
							class="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
						>
							<VsDownload class="w-4 h-4" />
							Download ({selection.count()})
						</button>
						<button
							onClick={selection.exitSelectMode}
							class="p-2 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
							title="Cancel selection"
						>
							<VsClose class="w-4 h-4" />
						</button>
					</div>
				</Show>
			</div>

			{/* Font Grid with Progressive Loading */}
			<FontErrorBoundary
				maxRetries={3}
				retryDelay={2000}
				onError={(error) => {
					console.error('[FontBrowser] Error loading fonts:', error)
				}}
			>
				<Suspense fallback={<FontBrowserSkeleton />}>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						<For each={filteredFonts()}>
							{([fontName, downloadUrl]) => (
								<Suspense fallback={<FontCardSkeleton />}>
									<SelectableFontCard
										name={fontName}
										downloadUrl={downloadUrl}
										isInstalled={installedFonts()?.has(fontName) ?? false}
										isDownloading={isInDownloadQueue(fontName)}
										pending={pending()}
										isSelected={selection.isSelected(fontName)}
										isSelectMode={selection.isSelectMode()}
										onToggle={() => {
											if (!selection.isSelectMode()) {
												selection.enterSelectMode()
											}
											selection.toggle(fontName)
										}}
									/>
								</Suspense>
							)}
						</For>
					</div>
				</Suspense>
			</FontErrorBoundary>

			{/* Empty State */}
			<Show when={filteredFonts().length === 0 && !pending()}>
				<div class="text-center py-8">
					<p class="text-muted-foreground text-sm">
						{searchQuery()
							? 'No fonts found matching your search.'
							: 'No fonts available.'}
					</p>
					<Show when={searchQuery()}>
						<button
							onClick={() => setSearchQuery('')}
							class="mt-2 text-xs text-primary hover:underline"
						>
							Clear search
						</button>
					</Show>
				</div>
			</Show>
		</div>
	)
}

const FontBrowserSkeleton = () => (
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<For each={Array(6).fill(0)}>{() => <FontCardSkeleton />}</For>
	</div>
)

const FontCardSkeleton = () => (
	<div class="p-4 border border-border rounded-lg animate-pulse bg-card">
		<div class="h-4 bg-muted rounded mb-2" />
		<div class="h-8 bg-muted rounded mb-3" />
		<div class="h-8 bg-muted rounded" />
	</div>
)
