/**
 * Font Registry Module
 *
 * Resource-based font management with Suspense integration.
 *
 * Usage:
 * 1. Wrap your app with FontRegistryProvider
 * 2. Use useFontRegistry() to access the registry
 * 3. Reading availableFontsResource() triggers Suspense
 * 4. Use useTransition for smooth font switching
 */

export {
	FontRegistryProvider,
	useFontRegistry,
	useFontOptions,
} from './FontRegistryProvider'
export { createFontRegistry } from './createFontRegistry'
export type { FontRegistry } from './createFontRegistry'
export { FontSource, FontStatus, FontCategory, FontCSSVariable } from './types'
export type {
	FontEntry,
	FontOption,
	FontSourceType,
	FontStatusType,
	FontCategoryType,
	FontRegistryState,
	FontRegistryActions,
} from './types'
