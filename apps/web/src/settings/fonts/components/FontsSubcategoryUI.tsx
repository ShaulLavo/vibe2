import { Show, Suspense, ErrorBoundary } from 'solid-js'
import { FontBrowser } from './FontBrowser'
import { FontManager } from './FontManager'
import { FontStoreProvider } from '../store/FontStoreProvider'

export const FontsSubcategoryUI = () => {
	return (
		<FontStoreProvider>
			<ErrorBoundary
				fallback={(error) => (
					<div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
						<p class="text-destructive text-sm mb-2">
							Failed to load fonts: {error.message}
						</p>
						<button
							onClick={() => window.location.reload()}
							class="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
						>
							Retry
						</button>
					</div>
				)}
			>
				<div class="space-y-6">
					{/* Available Fonts Section */}
					<section>
						<h3 class="text-sm font-medium text-foreground mb-3">
							Available Fonts
						</h3>
						<Suspense 
							fallback={
								<div class="text-muted-foreground text-sm">
									Loading fonts...
								</div>
							}
						>
							<FontBrowser />
						</Suspense>
					</section>

					{/* Installed Fonts Section */}
					<section>
						<h3 class="text-sm font-medium text-foreground mb-3">
							Installed Fonts
						</h3>
						<FontManager />
					</section>
				</div>
			</ErrorBoundary>
		</FontStoreProvider>
	)
}