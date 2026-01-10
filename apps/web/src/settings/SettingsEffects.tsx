import { createEffect, on, type Component } from 'solid-js'
import { useSettings } from './SettingsProvider'
import { useTheme } from '@repo/theme'
import type { ThemeMode } from '@repo/theme'

/**
 * Normalize theme values between settings ('auto') and theme context ('system')
 */
const settingsToTheme = (value: string | undefined): ThemeMode => {
	if (value === 'auto') return 'system'
	return (value as ThemeMode) ?? 'system'
}

const themeToSettings = (mode: ThemeMode): string => {
	if (mode === 'system') return 'auto'
	return mode
}

/**
 * Component that syncs settings values with their corresponding providers/effects.
 * This must be rendered inside both SettingsProvider and ThemeProvider.
 */
export const SettingsEffects: Component = () => {
	const [settingsState, settingsActions] = useSettings()
	const { setMode, mode } = useTheme()

	// Track if we're in the middle of a sync to prevent loops
	let isSyncing = false

	// Sync appearance.theme setting -> ThemeProvider
	createEffect(
		on(
			() => settingsState.values['appearance.theme'],
			(themeValue) => {
				if (!settingsState.isLoaded || isSyncing) return

				// Map settings value to theme mode (auto -> system)
				const newMode = settingsToTheme(themeValue as string)

				// Only update if different to avoid loops
				if (mode() !== newMode) {
					isSyncing = true
					try {
						// Use view transition if available, matching AnimatedModeToggle behavior
						if (document.startViewTransition) {
							// Add class to disable default view transitions
							document.documentElement.classList.add('theme-transitioning')

							// Add style to force no transitions during the switch
							const style = document.createElement('style')
							style.innerHTML = '* { transition: none !important; }'
							document.head.appendChild(style)

							const transition = document.startViewTransition(() => {
								setMode(newMode)
							})

							void transition.ready.then(() => {
								style.remove()

								// Since we don't have the click event coordinates from the store update,
								// we'll start the animation from the center of the screen
								const x = window.innerWidth / 2
								const y = window.innerHeight / 2

								const maxRadius = Math.hypot(
									Math.max(x, window.innerWidth - x),
									Math.max(y, window.innerHeight - y)
								)

								document.documentElement.animate(
									{
										clipPath: [
											`circle(0px at ${x}px ${y}px)`,
											`circle(${maxRadius}px at ${x}px ${y}px)`,
										],
									},
									{
										duration: 400,
										easing: 'ease-in-out',
										pseudoElement: '::view-transition-new(root)',
									}
								)
							})

							void transition.finished.then(() => {
								document.documentElement.classList.remove('theme-transitioning')
								isSyncing = false
							})
						} else {
							setMode(newMode)
							isSyncing = false
						}
					} catch {
						isSyncing = false
					}
				}
			}
		)
	)

	// Sync ThemeProvider -> appearance.theme setting (reverse sync)
	// This handles when theme changes from ModeToggle or other sources
	createEffect(
		on(mode, (currentMode) => {
			if (!settingsState.isLoaded || isSyncing) return

			const settingsValue = themeToSettings(currentMode)
			const currentSettingsValue = settingsState.values['appearance.theme']

			// Only update if different to avoid loops
			if (currentSettingsValue !== settingsValue) {
				isSyncing = true
				try {
					settingsActions.setSetting('appearance.theme', settingsValue)
				} finally {
					// Small delay to ensure the settings effect doesn't immediately re-trigger
					setTimeout(() => {
						isSyncing = false
					}, 50)
				}
			}
		})
	)

	// Sync per-area font settings to CSS custom properties
	// These can be consumed by components using var(--editor-font-size), etc.
	createEffect(() => {
		if (!settingsState.isLoaded) return

		const root = document.documentElement

		// UI font settings (global for file explorer, sidebars, settings, etc.)
		const uiFontSize =
			settingsState.values['ui.fontSize'] ??
			settingsState.defaults['ui.fontSize']
		const uiFontFamily =
			settingsState.values['ui.fontFamily'] ??
			settingsState.defaults['ui.fontFamily']
		if (uiFontSize != null) {
			root.style.setProperty('--ui-font-size', `${uiFontSize}px`)
		}
		if (uiFontFamily != null) {
			root.style.setProperty('--ui-font-family', String(uiFontFamily))
		}

		// Editor font settings
		const editorFontSize =
			settingsState.values['editor.fontSize'] ??
			settingsState.defaults['editor.fontSize']
		const editorFontFamily =
			settingsState.values['editor.fontFamily'] ??
			settingsState.defaults['editor.fontFamily']
		if (editorFontSize != null) {
			root.style.setProperty('--editor-font-size', `${editorFontSize}px`)
		}
		if (editorFontFamily != null) {
			root.style.setProperty('--editor-font-family', String(editorFontFamily))
		}

		// Terminal font settings
		const terminalFontSize =
			settingsState.values['terminal.fontSize'] ??
			settingsState.defaults['terminal.fontSize']
		const terminalFontFamily =
			settingsState.values['terminal.fontFamily'] ??
			settingsState.defaults['terminal.fontFamily']
		if (terminalFontSize != null) {
			root.style.setProperty('--terminal-font-size', `${terminalFontSize}px`)
		}
		if (terminalFontFamily != null) {
			root.style.setProperty(
				'--terminal-font-family',
				String(terminalFontFamily)
			)
		}
	})

	return null
}
