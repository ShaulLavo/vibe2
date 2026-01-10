import { For, Show, Suspense, createSignal, ErrorBoundary } from 'solid-js'
import { VsSearch } from '@repo/icons/vs'
import { useFontStore } from '../store/FontStoreProvider'
import { FontCard } from './FontCard'
import { FontErrorBoundary } from './ErrorBoundary/FontErrorBoundary'

export const FontBrowser = () => {
	const { availableFonts, installedFonts, pending } = useFontStore()
	const [searchQuery, setSearchQuery] = createSignal('')

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

	return (
		<div class="space-y-4">
			{/* Search Input - Always visible */}
			<div class="relative">
				<VsSearch class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search fonts..."
					value={searchQuery()}
					onInput={(e) => setSearchQuery(e.currentTarget.value)}
					class="w-full pl-10 pr-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
				/>
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
									<FontCard
										name={fontName}
										downloadUrl={downloadUrl}
										isInstalled={installedFonts()?.has(fontName) ?? false}
										isDownloading={isInDownloadQueue(fontName)}
										pending={pending()}
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
