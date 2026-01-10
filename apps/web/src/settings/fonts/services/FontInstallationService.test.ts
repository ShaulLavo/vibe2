import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the FontCacheService before importing the service
vi.mock('./FontCacheService', () => ({
	fontCacheService: {
		init: vi.fn().mockResolvedValue(undefined),
		isFontCached: vi.fn().mockResolvedValue(true),
	},
}))

// Import after mocking
import { FontInstallationService } from './FontInstallationService'

// Mock Cache API
const mockCache = {
	match: vi.fn(),
}

const mockCaches = {
	open: vi.fn().mockResolvedValue(mockCache),
}

// Mock FontFace API
class MockFontFace {
	family: string
	constructor(family: string, source: ArrayBuffer, descriptors?: any) {
		this.family = family
	}

	async load() {
		return this
	}
}

// Mock document.fonts
const mockDocumentFonts = {
	add: vi.fn(),
	delete: vi.fn(),
	check: vi.fn().mockReturnValue(true),
	ready: Promise.resolve(),
	[Symbol.iterator]: function* () {
		yield new MockFontFace('TestFont', new ArrayBuffer(0))
	},
}

// Setup global mocks
Object.defineProperty(global, 'caches', {
	value: mockCaches,
	writable: true,
})

Object.defineProperty(global, 'FontFace', {
	value: MockFontFace,
	writable: true,
})

Object.defineProperty(global, 'document', {
	value: {
		fonts: mockDocumentFonts,
	},
	writable: true,
})

describe('FontInstallationService', () => {
	let service: FontInstallationService

	beforeEach(() => {
		service = new FontInstallationService()
		vi.clearAllMocks()

		// Setup mock cache response
		const mockResponse = new Response(new ArrayBuffer(1024), {
			headers: { 'Content-Type': 'font/ttf' },
		})
		mockCache.match.mockResolvedValue(mockResponse)
	})

	it('should install a font successfully', async () => {
		const fontName = 'TestFont'
		let statusUpdates: any[] = []

		await service.installFont(fontName, (status) => {
			statusUpdates.push(status)
		})

		// Should have called cache operations
		expect(mockCaches.open).toHaveBeenCalledWith('nerdfonts-v1')
		expect(mockCache.match).toHaveBeenCalledWith(`/fonts/${fontName}`)

		// Should have added font to document.fonts
		expect(mockDocumentFonts.add).toHaveBeenCalled()

		// Should have received status updates
		expect(statusUpdates.length).toBeGreaterThan(0)
		expect(statusUpdates[statusUpdates.length - 1]).toMatchObject({
			fontName,
			isInstalled: true,
			isLoading: false,
		})
	})

	it('should not install font if already installed', async () => {
		const fontName = 'TestFont'

		// First installation
		await service.installFont(fontName)

		// Reset mocks
		vi.clearAllMocks()

		// Second installation attempt
		await service.installFont(fontName)

		// Should not have called cache operations again
		expect(mockCaches.open).not.toHaveBeenCalled()
		expect(mockCache.match).not.toHaveBeenCalled()
	})

	it('should uninstall a font successfully', async () => {
		const fontName = 'TestFont'

		// First install the font
		await service.installFont(fontName)

		// Then uninstall it
		await service.uninstallFont(fontName)

		// Should have called delete on document.fonts
		expect(mockDocumentFonts.delete).toHaveBeenCalled()
	})

	it('should check font installation status correctly', async () => {
		const fontName = 'TestFont'

		// Initially not installed
		expect(service.isFontInstalled(fontName)).toBe(true) // Mock returns true

		// After installation
		await service.installFont(fontName)
		expect(service.isFontInstalled(fontName)).toBe(true)
	})

	it('should handle installation errors gracefully', async () => {
		const fontName = 'ErrorFont'

		// Mock cache to return null (font not found)
		mockCache.match.mockResolvedValueOnce(null)

		let statusUpdates: any[] = []

		await expect(
			service.installFont(fontName, (status) => {
				statusUpdates.push(status)
			})
		).rejects.toThrow('Font not found in cache')

		// Should have received error status
		const errorStatus = statusUpdates.find((s) => s.error)
		expect(errorStatus).toBeDefined()
		expect(errorStatus.isInstalled).toBe(false)
		expect(errorStatus.isLoading).toBe(false)
	})

	it('should initialize service correctly', async () => {
		await service.initialize()

		// Should have waited for document.fonts.ready
		expect(mockDocumentFonts.ready).toBeDefined()
	})
})
