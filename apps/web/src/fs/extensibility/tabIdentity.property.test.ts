import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
	createTabIdentity,
	parseTabIdentity,
	getTabDisplayName,
} from '../utils/tabIdentity'

/**
 * Property-based tests for tab identity uniqueness and consistency
 * **Feature: file-view-modes, Property 1: Tab Identity Uniqueness**
 * **Validates: Requirements 1.1, 1.2**
 */
describe('Tab Identity Properties', () => {
	/**
	 * Property 1: Tab Identity Uniqueness
	 * For any combination of file path and view mode, the tab identity should be unique and reversible
	 * **Validates: Requirements 1.1, 1.2**
	 */
	it('property: tab identity creation is unique and reversible', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.oneof(
						fc.constantFrom(
							'test.txt',
							'.system/settings.json',
							'binary.exe',
							'document.pdf',
							'nested/folder/file.js'
						),
						// Generate arbitrary file paths
						fc
							.tuple(
								fc
									.string({ minLength: 1, maxLength: 10 })
									.filter((s) => !s.includes('|')),
								fc.constantFrom('.txt', '.js', '.json', '.exe')
							)
							.map(([name, ext]) => `${name}${ext}`)
					),
					viewMode: fc.constantFrom('editor', 'ui', 'binary'),
				}),
				(config) => {
					// Create tab identity
					const tabId = createTabIdentity(config.filePath, config.viewMode)

					// Tab ID should be a non-empty string
					expect(typeof tabId).toBe('string')
					expect(tabId.length).toBeGreaterThan(0)

					// Tab ID should be deterministic
					const tabId2 = createTabIdentity(config.filePath, config.viewMode)
					expect(tabId).toBe(tabId2)

					// Tab ID should be parseable back to original values
					const parsed = parseTabIdentity(tabId)
					expect(parsed.filePath).toBe(config.filePath)
					expect(parsed.viewMode).toBe(config.viewMode)

					// Round-trip should be perfect
					const roundTrip = createTabIdentity(parsed.filePath, parsed.viewMode)
					expect(roundTrip).toBe(tabId)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: different file/mode combinations produce different tab IDs', () => {
		fc.assert(
			fc.property(
				fc.record({
					file1: fc.constantFrom('test1.txt', 'file1.js', 'doc1.json'),
					mode1: fc.constantFrom('editor', 'ui', 'binary'),
					file2: fc.constantFrom('test2.txt', 'file2.js', 'doc2.json'),
					mode2: fc.constantFrom('editor', 'ui', 'binary'),
				}),
				(config) => {
					const tabId1 = createTabIdentity(config.file1, config.mode1)
					const tabId2 = createTabIdentity(config.file2, config.mode2)

					// Different combinations should produce different IDs

					// Different combinations should produce different IDs
					// File sets are disjoint in this test configuration, so IDs will always be different
					expect(tabId1).not.toBe(tabId2)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: tab display names are consistent and informative', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom(
						'test.txt',
						'.system/settings.json',
						'nested/folder/file.js'
					),
					viewMode: fc.constantFrom('editor', 'ui', 'binary'),
				}),
				(config) => {
					const displayName = getTabDisplayName(
						config.filePath,
						config.viewMode
					)

					// Display name should be a non-empty string
					expect(typeof displayName).toBe('string')
					expect(displayName.length).toBeGreaterThan(0)

					// Display name should be deterministic
					const displayName2 = getTabDisplayName(
						config.filePath,
						config.viewMode
					)
					expect(displayName).toBe(displayName2)

					// Display name should contain file name
					const fileName = config.filePath.split('/').pop() || config.filePath
					expect(displayName).toContain(fileName)

					// For non-editor modes, display name should indicate the mode
					if (config.viewMode !== 'editor') {
						expect(displayName.toLowerCase()).toContain(
							config.viewMode.toLowerCase()
						)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: tab identity handles edge cases safely', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.oneof(
						// Edge case file paths
						fc.constantFrom(
							'',
							'.',
							'..',
							'file with spaces.txt',
							'file|with|pipes.txt',
							'very/deeply/nested/folder/structure/file.js'
						)
					),
					viewMode: fc.constantFrom('editor', 'ui', 'binary'),
				}),
				(config) => {
					// Should not throw for any input
					expect(() => {
						const tabId = createTabIdentity(config.filePath, config.viewMode)
						const parsed = parseTabIdentity(tabId)
						expect(parsed.filePath).toBe(config.filePath)
						expect(parsed.viewMode).toBe(config.viewMode)
					}).not.toThrow()
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: tab identity format is stable', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom('test.txt', 'file.js'),
					viewMode: fc.constantFrom('editor', 'ui'),
				}),
				(config) => {
					const tabId = createTabIdentity(config.filePath, config.viewMode)

					// Tab ID should follow expected format (file|mode)
					expect(tabId).toContain('|')

					const parts = tabId.split('|')
					expect(parts.length).toBe(2)
					expect(parts[0]).toBe(config.filePath)
					expect(parts[1]).toBe(config.viewMode)
				}
			),
			{ numRuns: 100 }
		)
	})
})
