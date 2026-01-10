import { client } from '~/client'
import { fontCacheService } from './FontCacheService'
import { fontInstallationService } from './FontInstallationService'

export type DownloadProgress = {
	fontName: string
	status: 'idle' | 'downloading' | 'installing' | 'completed' | 'error'
	progress?: number
	error?: string
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void

export class FontDownloadService {
	private activeDownloads = new Map<string, AbortController>()
	private progressCallbacks = new Map<string, DownloadProgressCallback>()

	/**
	 * Download and install a font with progress tracking
	 */
	async downloadFont(
		name: string,
		downloadUrl: string,
		onProgress?: DownloadProgressCallback
	): Promise<void> {
		console.log('[FontDownloadService] Starting download for font:', name)

		// Check if already downloading
		if (this.activeDownloads.has(name)) {
			console.log('[FontDownloadService] Font already downloading:', name)
			return
		}

		// Set up abort controller for cancellation
		const abortController = new AbortController()
		this.activeDownloads.set(name, abortController)

		if (onProgress) {
			this.progressCallbacks.set(name, onProgress)
		}

		try {
			// Initialize cache service
			await fontCacheService.init()

			// Check if already installed
			const installedFonts = await fontCacheService.getInstalledFonts()
			if (installedFonts.has(name)) {
				console.log('[FontDownloadService] Font already installed:', name)
				this.updateProgress(name, { fontName: name, status: 'completed' })
				return
			}

			// Update progress: starting download
			this.updateProgress(name, { 
				fontName: name, 
				status: 'downloading', 
				progress: 0 
			})

			// Download font data using server RPC
			console.log('[FontDownloadService] Calling server RPC for font:', name)
			const response = await client.fonts({ name }).get({
				signal: abortController.signal
			})

			if (abortController.signal.aborted) {
				throw new Error('Download cancelled')
			}

			if (!response.data || response.error) {
				throw new Error(response.error?.message || `Failed to download font: ${name}`)
			}

			// Update progress: download complete, starting installation
			this.updateProgress(name, { 
				fontName: name, 
				status: 'installing', 
				progress: 50 
			})

			// Handle the response data
			let fontData: ArrayBuffer
			if (response.data instanceof Response) {
				fontData = await response.data.arrayBuffer()
			} else if (response.data instanceof ArrayBuffer) {
				fontData = response.data
			} else {
				throw new Error(`Unexpected response data type for font: ${name}`)
			}

			if (abortController.signal.aborted) {
				throw new Error('Download cancelled')
			}

			// Cache the font data
			console.log('[FontDownloadService] Caching font data for:', name)
			await fontCacheService.downloadFont(name, downloadUrl)

			// Update progress: installation complete
			this.updateProgress(name, { 
				fontName: name, 
				status: 'completed', 
				progress: 100 
			})

			console.log('[FontDownloadService] Font download and caching completed:', name)

		} catch (error) {
			console.error('[FontDownloadService] Font download failed:', name, error)
			
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			this.updateProgress(name, { 
				fontName: name, 
				status: 'error', 
				error: errorMessage 
			})
			
			throw error
		} finally {
			// Clean up
			this.activeDownloads.delete(name)
			this.progressCallbacks.delete(name)
		}
	}

	/**
	 * Install a font using FontFace API after it's been downloaded and cached
	 */
	async installFont(name: string): Promise<void> {
		console.log('[FontDownloadService] Installing font using FontFace API:', name)
		
		try {
			await fontInstallationService.installFont(name, (status) => {
				console.log('[FontDownloadService] Installation status:', JSON.stringify(status, null, 2))
			})
			
			console.log('[FontDownloadService] Font successfully installed:', name)
		} catch (error) {
			console.error('[FontDownloadService] Font installation failed:', name, error)
			throw error
		}
	}

	/**
	 * Download and install a font in one operation
	 */
	async downloadAndInstallFont(
		name: string,
		downloadUrl: string,
		onProgress?: DownloadProgressCallback
	): Promise<void> {
		console.log('[FontDownloadService] Starting download and install for:', name)

		// Download the font first
		await this.downloadFont(name, downloadUrl, onProgress)

		// Then install it using FontFace API
		await this.installFont(name)

		console.log('[FontDownloadService] Font download and installation completed:', name)
	}

	/**
	 * Cancel an active download
	 */
	cancelDownload(name: string): void {
		const controller = this.activeDownloads.get(name)
		if (controller) {
			console.log('[FontDownloadService] Cancelling download for:', name)
			controller.abort()
			this.activeDownloads.delete(name)
			this.progressCallbacks.delete(name)
		}
	}

	/**
	 * Check if a font is currently being downloaded
	 */
	isDownloading(name: string): boolean {
		return this.activeDownloads.has(name)
	}

	/**
	 * Get list of fonts currently being downloaded
	 */
	getActiveDownloads(): string[] {
		return Array.from(this.activeDownloads.keys())
	}

	private updateProgress(name: string, progress: DownloadProgress): void {
		const callback = this.progressCallbacks.get(name)
		if (callback) {
			callback(progress)
		}
	}
}

// Singleton instance
export const fontDownloadService = new FontDownloadService()