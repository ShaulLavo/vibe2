/**
 * Font Registry Types
 *
 * Single source of truth for all font-related types.
 * This module defines the core types for the centralized font management system.
 */

/**
 * Font source types - where the font comes from
 */
export const FontSource = {
	/** Built-in/bundled fonts (always available) */
	BUNDLED: 'bundled',
	/** Downloaded NerdFonts from server */
	NERDFONTS: 'nerdfonts',
	/** Local fonts from user's system via Local Font Access API (future) */
	LOCAL: 'local',
} as const

export type FontSourceType = (typeof FontSource)[keyof typeof FontSource]

/**
 * Font category - what the font is used for
 * Maps to CSS variables: --font-mono, --font-sans, --font-serif
 */
export const FontCategory = {
	/** Monospace fonts for code editor */
	MONO: 'mono',
	/** Sans-serif fonts for UI */
	SANS: 'sans',
	/** Serif fonts (currently used for secondary UI) */
	SERIF: 'serif',
} as const

export type FontCategoryType = (typeof FontCategory)[keyof typeof FontCategory]

/**
 * CSS variable names for each font category
 */
export const FontCSSVariable: Record<FontCategoryType, string> = {
	mono: '--font-mono',
	sans: '--font-sans',
	serif: '--font-serif',
}

/**
 * UI-specific CSS variables for different areas
 */
export const UIFontCSSVariable = {
	UI: '--font-ui',
	EDITOR: '--font-editor', 
	TERMINAL: '--font-terminal',
} as const

/**
 * Font status - current state of the font
 */
export const FontStatus = {
	/** Font is available and ready to use */
	AVAILABLE: 'available',
	/** Font is being downloaded */
	DOWNLOADING: 'downloading',
	/** Font is cached but not loaded into document.fonts */
	CACHED: 'cached',
	/** Font download/load failed */
	ERROR: 'error',
} as const

export type FontStatusType = (typeof FontStatus)[keyof typeof FontStatus]

/**
 * Core font entry in the registry
 */
export type FontEntry = {
	/** Unique identifier (font family name) */
	id: string
	/** Display name for UI */
	displayName: string
	/** CSS font-family value */
	fontFamily: string
	/** Font category (mono, sans, serif) */
	category: FontCategoryType
	/** Where the font comes from */
	source: FontSourceType
	/** Current status */
	status: FontStatusType
	/** Whether font is loaded in document.fonts */
	isLoaded: boolean
	/** File size in bytes (for downloaded fonts) */
	size?: number
	/** Download URL (for nerdfonts) */
	downloadUrl?: string
	/** When the font was installed/cached */
	installedAt?: Date
	/** Last time font was used */
	lastUsedAt?: Date
	/** Error message if status is ERROR */
	error?: string
}

/**
 * Font option for dropdowns/selects
 */
export type FontOption = {
	/** CSS font-family value */
	value: string
	/** Display label */
	label: string
	/** Font source type */
	source: FontSourceType
	/** Whether font is ready to use */
	isAvailable: boolean
}

/**
 * Font registry state
 */
export type FontRegistryState = {
	/** All registered fonts by ID */
	fonts: Map<string, FontEntry>
	/** Currently downloading fonts */
	downloading: Set<string>
	/** Whether registry is initialized */
	isInitialized: boolean
	/** Last sync timestamp */
	lastSync: Date | null
}

/**
 * Font registry actions
 */
export type FontRegistryActions = {
	/** Get all fonts as array */
	getAllFonts: () => FontEntry[]
	/** Get fonts by source */
	getFontsBySource: (source: FontSourceType) => FontEntry[]
	/** Get fonts by category */
	getFontsByCategory: (category: FontCategoryType) => FontEntry[]
	/** Get available fonts (ready to use) */
	getAvailableFonts: () => FontEntry[]
	/** Get font options for dropdowns, optionally filtered by category */
	getFontOptions: (category?: FontCategoryType) => FontOption[]
	/** Check if font is available */
	isFontAvailable: (id: string) => boolean
	/** Download and install a nerdfonts font */
	downloadFont: (id: string) => Promise<void>
	/** Remove a downloaded font */
	removeFont: (id: string) => Promise<void>
	/** Refresh available fonts from all sources */
	refresh: () => void
	/** Get font by ID */
	getFont: (id: string) => FontEntry | undefined
	/** Set the active font for a category (updates CSS variable) */
	setActiveFont: (category: FontCategoryType, fontFamily: string) => void
	/** Get the current active font for a category */
	getActiveFont: (category: FontCategoryType) => string
	/** Check if a font is currently downloading */
	isDownloading: (id: string) => boolean
}

/**
 * Font registry store type
 */
export type FontRegistry = {
	state: FontRegistryState
	actions: FontRegistryActions
}
