import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
	createTabIdentity,
	parseTabIdentity,
	getTabsForFile,
} from '../utils/tabIdentity'

/**
 * Property-based tests for tab closure specificity
 * **Feature: file-view-modes, Property 2: Tab Closure Specificity**
 * **Validates: Requirements 1.3**
 */
describe('Tab Closure Specificity Properties', () => {
	/**
	 * Property 2: Tab Closure Specificity
	 * When closing a specific tab, only that exact tab (file + view mode) should be closed
	 * **Validates: Requirements 1.3**
	 */
	it('property: tab closure affects only the specific tab identity', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom(
						'test.txt',
						'.system/settings.json',
						'binary.exe'
					),
					viewModes: fc
						.array(fc.constantFrom('editor', 'ui', 'binary'), {
							minLength: 2,
							maxLength: 3,
						})
						.map((modes) => [...new Set(modes)]), // Remove duplicates
				}),
				(config) => {
					// Create multiple tabs for the same file with different view modes
					const tabIds = config.viewModes.map((mode) =>
						createTabIdentity(config.filePath, mode)
					)

					// All tab IDs should be unique
					const uniqueTabIds = new Set(tabIds)
					expect(uniqueTabIds.size).toBe(tabIds.length)

					// Each tab ID should parse back to correct file and mode
					for (let i = 0; i < tabIds.length; i++) {
						const parsed = parseTabIdentity(tabIds[i]!)
						expect(parsed.filePath).toBe(config.filePath)
						expect(parsed.viewMode).toBe(config.viewModes[i])
					}

					// Simulate closing one specific tab
					const tabToClose = tabIds[0]
					const remainingTabs = tabIds.filter((id) => id !== tabToClose)

					// Remaining tabs should still be valid and different
					expect(remainingTabs.length).toBe(tabIds.length - 1)
					expect(remainingTabs).not.toContain(tabToClose)

					// All remaining tabs should still parse correctly
					for (const remainingTab of remainingTabs) {
						const parsed = parseTabIdentity(remainingTab)
						expect(parsed.filePath).toBe(config.filePath)
						expect(config.viewModes).toContain(parsed.viewMode)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: closing tabs for a file can be selective by view mode', () => {
		fc.assert(
			fc.property(
				fc.record({
					files: fc
						.array(
							fc.record({
								path: fc.constantFrom(
									'file1.txt',
									'file2.js',
									'.system/settings.json'
								),
								modes: fc
									.array(fc.constantFrom('editor', 'ui', 'binary'), {
										minLength: 1,
										maxLength: 2,
									})
									.map((modes) => [...new Set(modes)]),
							}),
							{ minLength: 2, maxLength: 3 }
						)
						.map((files) => {
							// Ensure unique file paths to avoid duplicate tabs
							const uniqueFiles = new Map<string, (typeof files)[0]>()
							for (const file of files) {
								uniqueFiles.set(file.path, file)
							}
							return Array.from(uniqueFiles.values())
						}),
				}),
				(config) => {
					// Create tabs for multiple files with multiple modes
					const allTabs: string[] = []
					const fileTabMap = new Map<string, string[]>()

					for (const file of config.files) {
						const fileTabs = file.modes.map((mode) =>
							createTabIdentity(file.path, mode)
						)
						allTabs.push(...fileTabs)
						fileTabMap.set(file.path, fileTabs)
					}

					// Test getTabsForFile utility
					for (const file of config.files) {
						const tabsForFile = getTabsForFile(allTabs, file.path)
						const expectedTabs = fileTabMap.get(file.path) || []

						expect(tabsForFile.sort()).toEqual(expectedTabs.sort())
						expect(tabsForFile.length).toBe(file.modes.length)
					}

					// Test that closing tabs for one file doesn't affect others
					const firstFile = config.files[0]!
					const firstFileTabs = fileTabMap.get(firstFile.path) || []
					const otherTabs = allTabs.filter(
						(tab) => !firstFileTabs.includes(tab)
					)

					// Other tabs should remain unaffected
					for (const otherTab of otherTabs) {
						const parsed = parseTabIdentity(otherTab)
						expect(parsed.filePath).not.toBe(firstFile.path)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: tab identity operations are consistent across file types', () => {
		fc.assert(
			fc.property(
				fc.record({
					fileTypes: fc.constantFrom([
						{ path: 'regular.txt', modes: ['editor'] },
						{ path: '.system/settings.json', modes: ['editor', 'ui'] },
						{ path: 'binary.exe', modes: ['editor', 'binary'] },
					]),
				}),
				(config) => {
					for (const fileType of config.fileTypes) {
						const tabs = fileType.modes.map((mode) =>
							createTabIdentity(fileType.path, mode)
						)

						// Each file type should have the expected number of tabs
						expect(tabs.length).toBe(fileType.modes.length)

						// All tabs should be unique
						const uniqueTabs = new Set(tabs)
						expect(uniqueTabs.size).toBe(tabs.length)

						// Each tab should parse back correctly
						for (let i = 0; i < tabs.length; i++) {
							const parsed = parseTabIdentity(tabs[i]!)
							expect(parsed.filePath).toBe(fileType.path)
							expect(parsed.viewMode).toBe(fileType.modes[i])
						}

						// Closing any single tab should leave others intact
						if (tabs.length > 1) {
							const tabToClose = tabs[0]
							const remainingTabs = tabs.filter((id) => id !== tabToClose)

							expect(remainingTabs.length).toBe(tabs.length - 1)
							expect(remainingTabs).not.toContain(tabToClose)

							// Remaining tabs should still be valid
							for (const remainingTab of remainingTabs) {
								const parsed = parseTabIdentity(remainingTab)
								expect(parsed.filePath).toBe(fileType.path)
								expect(fileType.modes).toContain(parsed.viewMode)
							}
						}
					}
				}
			),
			{ numRuns: 100 }
		)
	})
})
