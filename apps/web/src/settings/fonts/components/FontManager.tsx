import { For, Show, createSignal } from 'solid-js'
import { VsTrash, VsInfo, VsCheck } from '@repo/icons/vs'
import { Card, CardContent } from '@repo/ui/Card'
import { useFontStore } from '../store/FontStoreProvider'
import { useFontSettingsIntegration } from '../hooks/useFontSettingsIntegration'

export const FontManager = () => {
	const { installedFonts, cacheStats, actions, pending } = useFontStore()
	const { isFontInUse } = useFontSettingsIntegration()
	const [removingFont, setRemovingFont] = createSignal<string | null>(null)
	
	const installedFontsList = () => {
		const fonts = installedFonts()
		return fonts ? Array.from(fonts).sort() : []
	}
	
	const formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B'
		const k = 1024
		const sizes = ['B', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
	}

	const handleRemoveFont = async (fontName: string) => {
		if (isFontInUse(fontName)) {
			return
		}

		setRemovingFont(fontName)
		try {
			await actions.removeFont(fontName)
		} catch (error) {
			// Handle error silently or show user-friendly message
		} finally {
			setRemovingFont(null)
		}
	}

	const handleCleanupCache = async () => {
		try {
			await actions.cleanupCache()
		} catch (error) {
			// Handle error silently or show user-friendly message
		}
	}

	return (
		<div class="space-y-4">
			{/* Cache Statistics */}
			<Card>
				<CardContent class="p-4">
					<div class="flex items-center gap-2 mb-3">
						<VsInfo class="w-4 h-4 text-muted-foreground" />
						<h3 class="font-medium text-sm">Cache Statistics</h3>
					</div>
					<Show
						when={cacheStats()}
						fallback={
							<div class="text-xs text-muted-foreground">
								Loading cache statistics...
							</div>
						}
					>
						{(stats) => (
							<div class="grid grid-cols-2 gap-4 text-xs">
								<div class="flex justify-between">
									<span class="text-muted-foreground">Fonts Installed:</span>
									<span class="font-mono font-medium">{stats().fontCount}</span>
								</div>
								<div class="flex justify-between">
									<span class="text-muted-foreground">Total Size:</span>
									<span class="font-mono font-medium">
										{formatBytes(stats().totalSize)}
									</span>
								</div>
							</div>
						)}
					</Show>
					<div class="mt-3 pt-3 border-t border-border">
						<button
							onClick={handleCleanupCache}
							disabled={pending()}
							class="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
						>
							Clean up cache
						</button>
					</div>
				</CardContent>
			</Card>

			{/* Installed Fonts List */}
			<div>
				<h3 class="font-medium text-sm mb-3">Installed Fonts</h3>
				<Show
					when={installedFontsList().length > 0}
					fallback={
						<Card>
							<CardContent class="p-4">
								<p class="text-muted-foreground text-sm text-center">
									No fonts installed yet. Browse available fonts above to get started.
								</p>
							</CardContent>
						</Card>
					}
				>
					<div class="space-y-2">
						<For each={installedFontsList()}>
							{(fontName) => (
								<InstalledFontItem
									name={fontName}
									isCurrentlyUsed={isFontInUse(fontName)}
									isRemoving={removingFont() === fontName}
									onRemove={() => handleRemoveFont(fontName)}
								/>
							)}
						</For>
					</div>
				</Show>
			</div>
		</div>
	)
}

type InstalledFontItemProps = {
	name: string
	isCurrentlyUsed: boolean
	isRemoving: boolean
	onRemove: () => void
}

const InstalledFontItem = (props: InstalledFontItemProps) => {
	const displayName = () => props.name.replace(/([A-Z])/g, ' $1').trim()
	const previewText = "The quick brown fox 123"
	
	return (
		<Card class="hover:bg-card/80 transition-colors">
			<CardContent class="p-3">
				<div class="flex items-center justify-between">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="font-medium text-sm truncate">{displayName()}</span>
							<Show when={props.isCurrentlyUsed}>
								<div class="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
									<VsCheck class="w-3 h-3" />
									In Use
								</div>
							</Show>
						</div>
						<div
							class="text-xs font-mono text-muted-foreground truncate"
							style={{ "font-family": `"${props.name}", monospace` }}
						>
							{previewText}
						</div>
					</div>
					<button
						onClick={props.onRemove}
						disabled={props.isCurrentlyUsed || props.isRemoving}
						class="ml-3 p-2 text-destructive hover:bg-destructive/10 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						title={props.isCurrentlyUsed ? "Cannot remove font that is currently in use" : "Remove font"}
					>
						<Show
							when={props.isRemoving}
							fallback={<VsTrash class="w-3 h-3" />}
						>
							<div class="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
						</Show>
					</button>
				</div>
			</CardContent>
		</Card>
	)
}