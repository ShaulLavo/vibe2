import { fontCacheService } from './FontCacheService'

export type FontInstallationStatus = {
	fontName: string
	isInstalled: boolean
	isLoading: boolean
	error?: string
}

export type FontInstallationCallback = (status: FontInstallationStatus) => void

export class FontInstallationService {
	private installedFonts = new Set<string>()
	private loadingFonts = new Set<string>()
	private installationCallbacks = new Map<string, FontInstallationCallback>()

	/**
	 * Install a font using FontFace API with optimal loading settings
	 */
	async installFont(
		name: string,
		onStatusChange?: FontInstallationCallback
	): Promise<void> {
		// Check if already installed
		if (this.installedFonts.has(name)) {
			this.updateStatus(name, { 
				fontName: name, 
				isInstalled: true, 
				isLoading: false 
			}, onStatusChange)
			return
		}

		// Check if already loading
		if (this.loadingFonts.has(name)) {
			return
		}

		this.loadingFonts.add(name)
		if (onStatusChange) {
			this.installationCallbacks.set(name, onStatusChange)
		}

		try {
			// Update status: starting installation
			this.updateStatus(name, { 
				fontName: name, 
				isInstalled: false, 
				isLoading: true 
			}, onStatusChange)

			// Get font data from cache
			const fontData = await this.getFontDataFromCache(name)
			
			// Create FontFace with optimal settings
			const fontFace = new FontFace(name, fontData, {
				display: 'swap', // Use font-display: swap for optimal loading
				style: 'normal',
				weight: 'normal',
				stretch: 'normal'
			})
			
			// Load the font
			await fontFace.load()

			// Add to document.fonts
			document.fonts.add(fontFace)

			// Mark as installed
			this.installedFonts.add(name)

			// Verify font is available
			const isAvailable = document.fonts.check(`1em "${name}"`)
			if (!isAvailable) {
				// Font may not be properly installed but don't log warning
			}

			// Update status: installation complete
			this.updateStatus(name, { 
				fontName: name, 
				isInstalled: true, 
				isLoading: false 
			}, onStatusChange)

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown installation error'
			
			// Update status: installation failed
			this.updateStatus(name, { 
				fontName: name, 
				isInstalled: false, 
				isLoading: false,
				error: errorMessage
			}, onStatusChange)
			
			throw error
		} finally {
			// Clean up
			this.loadingFonts.delete(name)
			this.installationCallbacks.delete(name)
		}
	}

	/**
	 * Uninstall a font from document.fonts and update state
	 */
	async uninstallFont(name: string): Promise<void> {
		try {
			// Remove from document.fonts
			const fontsToRemove = Array.from(document.fonts).filter(
				font => font.family === name || font.family === `"${name}"`
			)

			for (const font of fontsToRemove) {
				document.fonts.delete(font)
			}

			// Remove from installed set
			this.installedFonts.delete(name)

		} catch (error) {
			throw error
		}
	}

	/**
	 * Check if a font is currently installed in document.fonts
	 */
	isFontInstalled(name: string): boolean {
		// Check both our internal state and document.fonts
		const internalState = this.installedFonts.has(name)
		const inDocumentFonts = document.fonts.check(`1em "${name}"`)
		
		// Sync internal state if there's a mismatch
		if (inDocumentFonts && !internalState) {
			this.installedFonts.add(name)
		} else if (!inDocumentFonts && internalState) {
			this.installedFonts.delete(name)
		}
		
		return inDocumentFonts
	}

	/**
	 * Get list of all installed fonts
	 */
	getInstalledFonts(): Set<string> {
		// Sync with document.fonts to ensure accuracy
		const documentFonts = Array.from(document.fonts)
			.map(font => font.family.replace(/"/g, ''))
			.filter(family => family !== 'monospace' && family !== 'serif' && family !== 'sans-serif')

		// Update internal state
		this.installedFonts.clear()
		for (const fontName of documentFonts) {
			this.installedFonts.add(fontName)
		}

		return new Set(this.installedFonts)
	}

	/**
	 * Check if a font is currently being loaded
	 */
	isFontLoading(name: string): boolean {
		return this.loadingFonts.has(name)
	}

	/**
	 * Initialize the service by syncing with existing fonts in document.fonts
	 */
	async initialize(): Promise<void> {
		try {
			// Wait for document.fonts to be ready
			await document.fonts.ready

			// Sync with existing fonts
			this.getInstalledFonts()

		} catch (error) {
			throw error
		}
	}

	private async getFontDataFromCache(name: string): Promise<ArrayBuffer> {
		// Initialize cache service
		await fontCacheService.init()

		// Check if font is cached
		const isCached = await fontCacheService.isFontCached(name)
		if (!isCached) {
			throw new Error(`Font not found in cache: ${name}`)
		}

		// Get font data from Cache API
		const cacheKey = `/fonts/${name}`
		const cache = await caches.open('nerdfonts-v1')
		const cachedResponse = await cache.match(cacheKey)
		
		if (!cachedResponse) {
			throw new Error(`Font not found in cache: ${name}`)
		}

		return await cachedResponse.arrayBuffer()
	}

	private updateStatus(
		name: string, 
		status: FontInstallationStatus, 
		callback?: FontInstallationCallback
	): void {
		// Call the provided callback
		if (callback) {
			callback(status)
		}

		// Call any registered callback
		const registeredCallback = this.installationCallbacks.get(name)
		if (registeredCallback && registeredCallback !== callback) {
			registeredCallback(status)
		}
	}
}

// Singleton instance
export const fontInstallationService = new FontInstallationService()