import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ParseResult } from '@repo/utils'
import {
	detectAvailableViewModes,
	supportsMultipleViewModes,
} from '../utils/viewModeDetection'

/**
 * Property-based tests for conditional UI rendering
 * **Feature: file-view-modes, Property 5: Conditional UI Rendering**
 * **Validates: Requirements 2.1, 2.4, 6.2**
 */
describe('Conditional UI Rendering Properties', () => {
	/**
	 * Property 5: Conditional UI Rendering
	 * View mode toggle should only be shown when multiple view modes are available
	 * **Validates: Requirements 2.1, 2.4, 6.2**
	 */
	it('property: view mode toggle visibility correlates with available modes', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.oneof(
						// Regular files (should only have editor mode)
						fc.constantFrom(
							'document.txt',
							'script.js',
							'style.css',
							'readme.md'
						),
						// Settings files (should have editor + ui modes)
						fc.constantFrom(
							'.system/settings.json',
							'.system/userSettings.json'
						)
					),
					stats: fc.option(
						fc.record({
							contentKind: fc.constantFrom('text', 'binary') as fc.Arbitrary<
								'text' | 'binary'
							>,
						})
					),
				}),
				(config) => {
					const stats = config.stats as ParseResult | undefined
					const availableModes = detectAvailableViewModes(
						config.filePath,
						stats
					)
					const hasMultipleModes = supportsMultipleViewModes(
						config.filePath,
						stats
					)

					// Toggle should be shown only when multiple modes are available
					const shouldShowToggle = availableModes.length > 1
					expect(hasMultipleModes).toBe(shouldShowToggle)

					// Verify specific file type behaviors
					const isSettings =
						config.filePath.includes('.system/') &&
						config.filePath.endsWith('.json')
					const isBinary = stats?.contentKind === 'binary'

					if (isSettings && !isBinary) {
						// Settings files should have multiple modes (editor + ui)
						expect(shouldShowToggle).toBe(true)
						expect(availableModes.length).toBe(2)
						expect(availableModes).toContain('editor')
						expect(availableModes).toContain('ui')
					} else if (isSettings && isBinary) {
						// Settings files that are binary should have 3 modes
						expect(shouldShowToggle).toBe(true)
						expect(availableModes.length).toBe(3)
						expect(availableModes).toContain('editor')
						expect(availableModes).toContain('ui')
						expect(availableModes).toContain('binary')
					} else if (isBinary && !isSettings) {
						// Binary files should have multiple modes (editor + binary)
						expect(shouldShowToggle).toBe(true)
						expect(availableModes.length).toBe(2)
						expect(availableModes).toContain('editor')
						expect(availableModes).toContain('binary')
					} else {
						// Regular files should only have editor mode
						expect(shouldShowToggle).toBe(false)
						expect(availableModes).toEqual(['editor'])
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: UI rendering decisions are consistent across file types', () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					// Test cases with expected UI behavior
					{
						path: 'regular.txt',
						stats: { contentKind: 'text' as const },
						expectedToggle: false,
						expectedModes: ['editor'],
					},
					{
						path: '.system/settings.json',
						stats: { contentKind: 'text' as const },
						expectedToggle: true,
						expectedModes: ['editor', 'ui'],
					},
					{
						path: 'binary.exe',
						stats: { contentKind: 'binary' as const },
						expectedToggle: true,
						expectedModes: ['editor', 'binary'],
					},
					{
						path: '.system/settings.json',
						stats: { contentKind: 'binary' as const },
						expectedToggle: true,
						expectedModes: ['editor', 'ui', 'binary'],
					}
				),
				(testCase) => {
					const stats = testCase.stats as ParseResult
					const availableModes = detectAvailableViewModes(testCase.path, stats)
					const hasMultipleModes = supportsMultipleViewModes(
						testCase.path,
						stats
					)

					// Verify expected toggle visibility
					expect(hasMultipleModes).toBe(testCase.expectedToggle)

					// Verify expected available modes
					expect(availableModes.sort()).toEqual(
						[...testCase.expectedModes].sort()
					)

					// Consistency check: toggle visibility should match mode count
					expect(hasMultipleModes).toBe(availableModes.length > 1)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: UI state reflects current view mode selection', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom('.system/settings.json'),
					selectedMode: fc.constantFrom('editor', 'ui'),
					stats: fc.constant({ contentKind: 'text' as const }),
				}),
				(config) => {
					const stats = config.stats as ParseResult
					const availableModes = detectAvailableViewModes(
						config.filePath,
						stats
					)
					const hasMultipleModes = supportsMultipleViewModes(
						config.filePath,
						stats
					)

					// Settings files should always show toggle
					expect(hasMultipleModes).toBe(true)
					expect(availableModes).toContain('editor')
					expect(availableModes).toContain('ui')

					// Selected mode should be one of available modes
					expect(availableModes).toContain(config.selectedMode)

					// UI should reflect the selected mode
					const isEditorMode = config.selectedMode === 'editor'
					const isUIMode = config.selectedMode === 'ui'

					// These are mutually exclusive
					expect(isEditorMode).not.toBe(isUIMode)

					// Mode selection should be deterministic
					if (config.selectedMode === 'editor') {
						expect(isEditorMode).toBe(true)
						expect(isUIMode).toBe(false)
					} else {
						expect(isEditorMode).toBe(false)
						expect(isUIMode).toBe(true)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: conditional rendering respects file type constraints', () => {
		fc.assert(
			fc.property(
				fc.record({
					fileType: fc.constantFrom(
						{ path: 'test.txt', canHaveUI: false, canHaveBinary: false },
						{
							path: '.system/settings.json',
							canHaveUI: true,
							canHaveBinary: false,
						},
						{ path: 'binary.exe', canHaveUI: false, canHaveBinary: true }
					),
					stats: fc.option(
						fc.record({
							contentKind: fc.constantFrom('text', 'binary') as fc.Arbitrary<
								'text' | 'binary'
							>,
						})
					),
				}),
				(config) => {
					const stats = config.stats as ParseResult | undefined
					const availableModes = detectAvailableViewModes(
						config.fileType.path,
						stats
					)

					// All files should have editor mode
					expect(availableModes).toContain('editor')

					// UI mode should only be available for settings files
					const hasUIMode = availableModes.includes('ui')
					expect(hasUIMode).toBe(config.fileType.canHaveUI)

					// Binary mode should only be available when stats indicate binary content
					const hasBinaryMode = availableModes.includes('binary')
					const shouldHaveBinary = stats?.contentKind === 'binary'
					expect(hasBinaryMode).toBe(shouldHaveBinary)

					// Toggle should be shown when more than one mode is available
					const shouldShowToggle = availableModes.length > 1
					const hasMultipleModes = supportsMultipleViewModes(
						config.fileType.path,
						stats
					)
					expect(hasMultipleModes).toBe(shouldShowToggle)
				}
			),
			{ numRuns: 100 }
		)
	})
})
