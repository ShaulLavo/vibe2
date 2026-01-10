import { Suspense, ErrorBoundary } from 'solid-js'
import { FontBrowser } from './FontBrowser'
import { FontManager } from './FontManager'
import { FontStoreProvider } from '../store/FontStoreProvider'

/**
 * Example of how to use FontManager in a complete fonts settings panel
 * This shows the integration between FontBrowser and FontManager components
 */
export const FontsSettingsPanelExample = () => {
	return (
		<FontStoreProvider>
			<div class="space-y-6">
				<ErrorBoundary
					fallback={(error) => (
						<div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
							<p class="text-destructive text-sm">
								Failed to load fonts: {error.message}
							</p>
							<button
								onClick={() => window.location.reload()}
								class="mt-2 px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded"
							>
								Retry
							</button>
						</div>
					)}
				>
					{/* Available Fonts Section */}
					<section>
						<h2 class="text-lg font-semibold mb-4">Available Fonts</h2>
						<Suspense
							fallback={
								<div class="text-muted-foreground">Loading fonts...</div>
							}
						>
							<FontBrowser />
						</Suspense>
					</section>

					{/* Installed Fonts Section - This is where FontManager is used */}
					<section>
						<h2 class="text-lg font-semibold mb-4">Installed Fonts</h2>
						<FontManager />
					</section>
				</ErrorBoundary>
			</div>
		</FontStoreProvider>
	)
}
