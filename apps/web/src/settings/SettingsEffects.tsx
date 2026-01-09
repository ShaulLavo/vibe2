import { createEffect, on, type Component } from 'solid-js'
import { useSettings } from './SettingsProvider'
import { useTheme } from '@repo/theme'
import type { ThemeMode } from '@repo/theme'

/**
 * Component that syncs settings values with their corresponding providers/effects.
 * This must be rendered inside both SettingsProvider and ThemeProvider.
 */
export const SettingsEffects: Component = () => {
	const [settingsState] = useSettings()
	const { setMode, mode } = useTheme()

	// Sync appearance.theme setting with ThemeProvider
	createEffect(
		on(
			() => settingsState.values['appearance.theme'],
			(themeValue) => {
				if (!settingsState.isLoaded) return

				// Map settings value to theme mode
				const newMode = (themeValue as ThemeMode) ?? 'dark'

				// Only update if different to avoid loops
				if (mode() !== newMode) {
					setMode(newMode)
				}
			}
		)
	)

	// Note: We could also sync theme -> settings here if needed,
	// but currently theme changes from command palette already work
	// because they directly call setMode() which updates localStorage.

	return null
}
