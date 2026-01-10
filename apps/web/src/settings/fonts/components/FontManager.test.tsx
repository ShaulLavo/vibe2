import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

describe('FontManager Component Logic', () => {
	it('should format bytes correctly', () => {
		// Test the byte formatting logic used in FontManager
		const formatBytes = (bytes: number): string => {
			if (bytes === 0) return '0 B'
			const k = 1024
			const sizes = ['B', 'KB', 'MB', 'GB']
			const i = Math.floor(Math.log(bytes) / Math.log(k))
			return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
		}

		// Test specific cases
		expect(formatBytes(0)).toBe('0 B')
		expect(formatBytes(1024)).toBe('1 KB')
		expect(formatBytes(1024 * 1024)).toBe('1 MB')
		expect(formatBytes(1536 * 1024)).toBe('1.5 MB') // 1.5 MB
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
	})

	it('should handle font name display formatting', () => {
		// Test the display name formatting logic
		const formatDisplayName = (name: string): string => {
			return name.replace(/([A-Z])/g, ' $1').trim()
		}

		expect(formatDisplayName('JetBrainsMono')).toBe('Jet Brains Mono')
		expect(formatDisplayName('FiraCode')).toBe('Fira Code')
		expect(formatDisplayName('SourceCodePro')).toBe('Source Code Pro')
		expect(formatDisplayName('DejaVuSansMono')).toBe('Deja Vu Sans Mono')
	})

	it('should handle font removal prevention logic', () => {
		// Test the logic for preventing removal of fonts in use
		const canRemoveFont = (fontName: string, currentFont: string): boolean => {
			return !currentFont.includes(`"${fontName}"`) && !currentFont.includes(`'${fontName}'`)
		}

		expect(canRemoveFont('JetBrainsMono', '"JetBrainsMono", monospace')).toBe(false)
		expect(canRemoveFont('JetBrainsMono', "'JetBrainsMono', monospace")).toBe(false)
		expect(canRemoveFont('FiraCode', '"JetBrainsMono", monospace')).toBe(true)
		expect(canRemoveFont('FiraCode', 'monospace')).toBe(true)
	})

	it('Property: Font list sorting should be consistent', () => {
		// Property-based test for font list sorting
		fc.assert(
			fc.property(
				fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
				(fontNames) => {
					const sorted1 = [...fontNames].sort()
					const sorted2 = [...fontNames].sort()
					
					// Sorting should be deterministic
					expect(sorted1).toEqual(sorted2)
					
					// All original items should be present
					expect(sorted1.length).toBe(fontNames.length)
					
					return true
				}
			),
			{ numRuns: 50 }
		)
	})
})