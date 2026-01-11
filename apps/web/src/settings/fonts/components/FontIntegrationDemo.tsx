import type { Component } from 'solid-js'
import { createSignal, Show, For } from 'solid-js'
import { FontFamilySelect } from '../../components/FontFamilySelect'
import { useFontSettingsIntegration } from '../hooks/useFontSettingsIntegration'

/**
 * Demo component to test font integration functionality
 * This can be used to manually verify that:
 * 1. Font family dropdown includes installed fonts
 * 2. Font previews are shown for installed fonts
 * 3. Font validation works correctly
 * 4. Font persistence works across sessions
 */
export const FontIntegrationDemo: Component = () => {
	const fontIntegration = useFontSettingsIntegration()
	const [selectedFont, setSelectedFont] = createSignal(
		"'JetBrains Mono', monospace"
	)

	const handleFontChange = (fontValue: string) => {
		setSelectedFont(fontValue)
		fontIntegration.setEditorFontFamily(fontValue)
	}

	return (
		<div class="p-6 space-y-6 max-w-2xl">
			<div>
				<h2 class="text-xl font-semibold mb-4">Font Integration Demo</h2>
				<p class="text-sm text-muted-foreground mb-6">
					This demo shows the font family dropdown with installed fonts and
					previews.
				</p>
			</div>

			<div class="space-y-4">
				<FontFamilySelect
					value={selectedFont()}
					onChange={handleFontChange}
					label="Editor Font Family"
					description="Select a font family for the code editor. Installed fonts show previews."
				/>
			</div>

			<div class="p-4 bg-muted rounded-lg space-y-2">
				<h3 class="font-medium">Current Selection</h3>
				<div class="text-sm space-y-1">
					<div>
						<span class="text-muted-foreground">Value:</span> {selectedFont()}
					</div>
					<div>
						<span class="text-muted-foreground">Display Name:</span>{' '}
						{fontIntegration.currentFontDisplayName()}
					</div>
					<div>
						<span class="text-muted-foreground">Available:</span>{' '}
						{fontIntegration.isCurrentFontAvailable() ? 'Yes' : 'No'}
					</div>
				</div>
			</div>

			<div class="space-y-2">
				<h3 class="font-medium">Font Preview</h3>
				<div
					class="p-4 bg-background border rounded-lg font-mono text-sm"
					style={{ 'font-family': selectedFont() }}
				>
					<div>The quick brown fox jumps over the lazy dog</div>
					<div>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
					<div>abcdefghijklmnopqrstuvwxyz</div>
					<div>0123456789 !@#$%^&*()_+-=[]{}|;':\",./?</div>
					<div class="mt-2 text-xs text-muted-foreground">
						// Code example function fibonacci(n: number): number {'{'}
						if (n &lt;= 1) return n; return fibonacci(n - 1) + fibonacci(n - 2);
						{'}'}
					</div>
				</div>
			</div>

			<div class="space-y-2">
				<h3 class="font-medium">Available Font Options</h3>
				<div class="text-xs text-muted-foreground">
					Total options: {fontIntegration.allFontOptions().length}
				</div>
				<div class="max-h-32 overflow-y-auto text-sm space-y-1">
					<For each={fontIntegration.allFontOptions()}>
						{(option) => (
							<div class="flex justify-between items-center py-1 px-2 bg-muted/50 rounded">
								<span>{option.label}</span>
								<span class="text-xs text-muted-foreground font-mono">
									{option.value}
								</span>
							</div>
						)}
					</For>
				</div>
			</div>

			<div class="space-y-2">
				<h3 class="font-medium">Font Store Status</h3>
				<div class="text-sm space-y-1">
					<div>
						<span class="text-muted-foreground">Installed Fonts:</span>{' '}
						<Show
							when={fontIntegration.fontStore.installedFonts()}
							fallback="Loading..."
						>
							{fontIntegration.fontStore.installedFonts()!.size}
						</Show>
					</div>
					<div>
						<span class="text-muted-foreground">Available Fonts:</span>{' '}
						<Show
							when={fontIntegration.fontStore.availableFonts()}
							fallback="Loading..."
						>
							{Object.keys(fontIntegration.fontStore.availableFonts()!).length}
						</Show>
					</div>
					<div>
						<span class="text-muted-foreground">Pending Operations:</span>{' '}
						{fontIntegration.fontStore.pending() ? 'Yes' : 'No'}
					</div>
				</div>
			</div>
		</div>
	)
}
