import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FontRestorationService } from './FontRestorationService'
import { fontCacheService } from './FontCacheService'
import { fontInstallationService } from './FontInstallationService'

// Mock the services
vi.mock('./FontCacheService', () => ({
	fontCacheService: {
		init: vi.fn(),
		getInstalledFonts: vi.fn(),
		removeFont: vi.fn(),
	},
}))

vi.mock('./FontInstallationService', () => ({
	fontInstallationService: {
		initialize: vi.fn(),
		isFontInstalled: vi.fn(),
	},
}))

// Mock caches API
const mockCache = {
	match: vi.fn(),
}

global.caches = {
	open: vi.fn().mockResolvedValue(mockCache),
} as any

// Mock FontFace API
global.FontFace = vi.fn().mockImplementation((family, source, descriptors) => ({
	family,
	source,
	descriptors,
	load: vi.fn().mockResolvedValue(undefined),
}))

global.document = {
	fonts: {
		add: vi.fn(),
	},
} as any

describe('FontRestorationService', () => {
	let service: FontRestorationService

	beforeEach(() => {
		vi.clearAllMocks()
		service = FontRestorationService.getInstance()
	})

	it('should restore cached fonts on startup', async () => {
		// Setup mocks
		const mockFontData = new ArrayBuffer(1024)
		const mockResponse = {
			arrayBuffer: vi.fn().mockResolvedValue(mockFontData),
		}

		vi.mocked(fontCacheService.getInstalledFonts).mockResolvedValue(
			new Set(['TestFont'])
		)
		vi.mocked(fontInstallationService.isFontInstalled).mockReturnValue(false)
		mockCache.match.mockResolvedValue(mockResponse)

		// Run restoration
		await service.restoreFonts()

		// Verify services were initialized
		expect(fontCacheService.init).toHaveBeenCalled()
		expect(fontInstallationService.initialize).toHaveBeenCalledTimes(2) // Once at start, once at end

		// Verify font was restored
		expect(mockCache.match).toHaveBeenCalledWith('/fonts/TestFont')
		expect(global.FontFace).toHaveBeenCalledWith('TestFont', mockFontData, {
			display: 'swap',
			style: 'normal',
			weight: 'normal',
			stretch: 'normal',
		})
		expect(global.document.fonts.add).toHaveBeenCalled()
	})

	it('should skip fonts that are already installed', async () => {
		// Setup mocks
		vi.mocked(fontCacheService.getInstalledFonts).mockResolvedValue(
			new Set(['TestFont'])
		)
		vi.mocked(fontInstallationService.isFontInstalled).mockReturnValue(true)

		// Run restoration
		await service.restoreFonts()

		// Verify font was not restored (already installed)
		expect(mockCache.match).not.toHaveBeenCalled()
		expect(global.FontFace).not.toHaveBeenCalled()
		expect(global.document.fonts.add).not.toHaveBeenCalled()
	})

	it('should handle restoration errors gracefully', async () => {
		// Setup mocks
		vi.mocked(fontCacheService.getInstalledFonts).mockResolvedValue(
			new Set(['TestFont'])
		)
		vi.mocked(fontInstallationService.isFontInstalled).mockReturnValue(false)
		mockCache.match.mockResolvedValue(null) // Font not found in cache

		// Run restoration
		await service.restoreFonts()

		// Verify error was handled and font was removed from cache
		expect(fontCacheService.removeFont).toHaveBeenCalledWith('TestFont')
	})

	it('should prevent multiple simultaneous restorations', async () => {
		// Setup mocks
		vi.mocked(fontCacheService.getInstalledFonts).mockResolvedValue(new Set())

		// Start multiple restorations
		const promise1 = service.restoreFonts()
		const promise2 = service.restoreFonts()
		const promise3 = service.restoreFonts()

		await Promise.all([promise1, promise2, promise3])

		// Verify init was only called once
		expect(fontCacheService.init).toHaveBeenCalledTimes(1)
	})
})
