/**
 * Font Registry Provider
 *
 * Provides the resource-based font registry to the application.
 * Components can use Suspense to handle loading states automatically.
 */

import { createContext, useContext, type JSX } from 'solid-js'
import { createFontRegistry, type FontRegistry } from './createFontRegistry'

const FontRegistryContext = createContext<FontRegistry>()

export type FontRegistryProviderProps = {
	children: JSX.Element
}

export function FontRegistryProvider(props: FontRegistryProviderProps) {
	const registry = createFontRegistry()

	return (
		<FontRegistryContext.Provider value={registry}>
			{props.children}
		</FontRegistryContext.Provider>
	)
}

/**
 * Hook to access the font registry
 *
 * The registry exposes resources that trigger Suspense:
 * - availableFontsResource: fonts from server
 * - cachedFontsResource: fonts from IndexedDB
 *
 * And derived accessors:
 * - allFonts(): all fonts merged
 * - availableFonts(): fonts ready to use
 */
export function useFontRegistry(): FontRegistry {
	const context = useContext(FontRegistryContext)
	if (!context) {
		throw new Error(
			'useFontRegistry must be used within a FontRegistryProvider'
		)
	}
	return context
}

/**
 * Hook to get font options for dropdowns
 */
export function useFontOptions(category?: () => string) {
	const registry = useFontRegistry()
	return () =>
		registry.getFontOptions(
			category?.() as 'mono' | 'sans' | 'serif' | undefined
		)
}
