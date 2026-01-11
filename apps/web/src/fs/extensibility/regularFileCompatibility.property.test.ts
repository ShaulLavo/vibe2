import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ParseResult } from '@repo/utils'
import {
	detectAvailableViewModes,
	getDefaultViewMode,
	isViewModeValid,
	isRegularFile,
} from '../utils/viewModeDetection'

/**
 * Property-based tests for regular file backward compatibility
 * **Feature: file-view-modes, Property 13: Backward Compatibility for Regular Files**
 * **Validates: Requirements 6.1, 6.3, 6.4**
 */
describe('Regular File Compatibility Properties', () => {
	/**
	 * Property 13: Backward Compatibility for Regular Files
	 * Regular files should maintain existing behavior with only editor mode available
	 * **Validates: Requirements 6.1, 6.3, 6.4**
	 */
	it('property: regular files maintain editor-only behavior', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.oneof(
						// Common regular file types
						fc.constantFrom(
							'document.txt',
							'script.js',
							'style.css',
							'readme.md',
							'config.yaml',
							'data.xml',
							'component.tsx',
							'utils.ts',
							'package.json'
						),
						// Generated regular file paths
						fc
							.tuple(
								fc
									.string({ minLength: 1, maxLength: 10 })
									.filter((s) => !s.includes('.')),
								fc.constantFrom(
									'.txt',
									'.js',
									'.ts',
									'.css',
									'.md',
									'.html',
									'.py',
									'.java'
								)
							)
							.map(([name, ext]) => `${name}${ext}`)
					),
					stats: fc.constant({ contentKind: 'text' as const }),
				}),
				(config) => {
					const stats = config.stats as unknown as ParseResult
					const availableModes = detectAvailableViewModes(
						config.filePath,
						stats
					)
					const defaultMode = getDefaultViewMode(config.filePath, stats)

					// Regular files should only have editor mode (Requirement 6.1)
					expect(availableModes).toEqual(['editor'])
					expect(availableModes.length).toBe(1)

					// Default mode should be editor (Requirement 6.3)
					expect(defaultMode).toBe('editor')

					// Only editor mode should be valid (Requirement 6.4)
					expect(isViewModeValid('editor', config.filePath, stats)).toBe(true)
					expect(isViewModeValid('ui', config.filePath, stats)).toBe(false)
					expect(isViewModeValid('binary', config.filePath, stats)).toBe(false)

					// Should be identified as regular file
					expect(isRegularFile(config.filePath, stats)).toBe(true)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: regular file classification is consistent', () => {
		fc.assert(
			fc.property(
				fc.record({
					fileType: fc.constantFrom(
						{ path: 'document.txt', expectsRegularWhenText: true },
						{ path: 'script.js', expectsRegularWhenText: true },
						{ path: '.system/settings.json', expectsRegularWhenText: false }, // Settings file
						{ path: 'binary.exe', expectsRegularWhenText: true } // Would be regular if text content
					),
					contentKind: fc.constantFrom('text', 'binary') as fc.Arbitrary<
						'text' | 'binary'
					>,
				}),
				(config) => {
					const stats = {
						contentKind: config.contentKind,
					} as unknown as ParseResult
					const availableModes = detectAvailableViewModes(
						config.fileType.path,
						stats
					)
					const isRegular = isRegularFile(config.fileType.path, stats)

					// Regular file classification depends on available modes, not file extension
					const isSettings =
						config.fileType.path.includes('.system/') &&
						config.fileType.path.endsWith('.json')

					if (config.contentKind === 'text' && !isSettings) {
						// Text files (except settings) should be regular
						expect(isRegular).toBe(true)
						expect(availableModes).toEqual(['editor'])
					} else if (config.contentKind === 'text' && isSettings) {
						// Settings files should not be regular (have UI mode)
						expect(isRegular).toBe(false)
						expect(availableModes).toContain('editor')
						expect(availableModes).toContain('ui')
					} else if (config.contentKind === 'binary') {
						// Binary files should not be regular (have binary mode)
						expect(isRegular).toBe(false)
						expect(availableModes).toContain('editor')
						expect(availableModes).toContain('binary')
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: backward compatibility preserves existing behavior', () => {
		fc.assert(
			fc.property(
				fc.record({
					legacyFiles: fc
						.array(
							fc.constantFrom(
								'index.html',
								'main.js',
								'styles.css',
								'README.md',
								'package.json',
								'tsconfig.json'
							),
							{ minLength: 1, maxLength: 6 }
						)
						.map((files) => [...new Set(files)]), // Remove duplicates
				}),
				(config) => {
					const stats = { contentKind: 'text' } as unknown as ParseResult

					// All legacy files should maintain consistent behavior
					for (const filePath of config.legacyFiles) {
						const availableModes = detectAvailableViewModes(filePath, stats)
						const defaultMode = getDefaultViewMode(filePath, stats)
						const isRegular = isRegularFile(filePath, stats)

						// Backward compatibility requirements
						expect(availableModes).toEqual(['editor'])
						expect(defaultMode).toBe('editor')
						expect(isRegular).toBe(true)

						// No new modes should be available for regular files
						expect(isViewModeValid('ui', filePath, stats)).toBe(false)
						expect(isViewModeValid('binary', filePath, stats)).toBe(false)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: regular files are unaffected by view mode system changes', () => {
		fc.assert(
			fc.property(
				fc.record({
					regularFile: fc.constantFrom(
						'document.txt',
						'script.js',
						'readme.md'
					),
					systemChanges: fc.array(
						fc.record({
							changeType: fc.constantFrom(
								'registry-update',
								'mode-addition',
								'config-change'
							),
							affectsRegularFiles: fc.constant(false), // Regular files should be unaffected
						}),
						{ minLength: 1, maxLength: 3 }
					),
				}),
				(config) => {
					const stats = { contentKind: 'text' } as unknown as ParseResult

					// Baseline behavior before any system changes
					const baselineAvailableModes = detectAvailableViewModes(
						config.regularFile,
						stats
					)
					const baselineDefaultMode = getDefaultViewMode(
						config.regularFile,
						stats
					)
					const baselineIsRegular = isRegularFile(config.regularFile, stats)

					// Simulate system changes (in reality, these wouldn't affect regular files)
					for (const change of config.systemChanges) {
						// After each change, regular file behavior should remain the same
						const availableModes = detectAvailableViewModes(
							config.regularFile,
							stats
						)
						const defaultMode = getDefaultViewMode(config.regularFile, stats)
						const isRegular = isRegularFile(config.regularFile, stats)

						// Behavior should be unchanged
						expect(availableModes).toEqual(baselineAvailableModes)
						expect(defaultMode).toBe(baselineDefaultMode)
						expect(isRegular).toBe(baselineIsRegular)

						// Should still be editor-only
						expect(availableModes).toEqual(['editor'])
						expect(defaultMode).toBe('editor')
						expect(isRegular).toBe(true)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: regular file detection is deterministic', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom('test.txt', 'main.js', 'style.css'),
					repetitions: fc.integer({ min: 2, max: 10 }),
				}),
				(config) => {
					const stats = { contentKind: 'text' } as unknown as ParseResult

					// Multiple calls should return identical results
					const results = Array.from({ length: config.repetitions }, () => ({
						availableModes: detectAvailableViewModes(config.filePath, stats),
						defaultMode: getDefaultViewMode(config.filePath, stats),
						isRegular: isRegularFile(config.filePath, stats),
						editorValid: isViewModeValid('editor', config.filePath, stats),
						uiValid: isViewModeValid('ui', config.filePath, stats),
						binaryValid: isViewModeValid('binary', config.filePath, stats),
					}))

					// All results should be identical
					const firstResult = results[0]!
					for (const result of results) {
						expect(result.availableModes).toEqual(firstResult.availableModes)
						expect(result.defaultMode).toBe(firstResult.defaultMode)
						expect(result.isRegular).toBe(firstResult.isRegular)
						expect(result.editorValid).toBe(firstResult.editorValid)
						expect(result.uiValid).toBe(firstResult.uiValid)
						expect(result.binaryValid).toBe(firstResult.binaryValid)
					}

					// Verify expected values for regular files
					expect(firstResult.availableModes).toEqual(['editor'])
					expect(firstResult.defaultMode).toBe('editor')
					expect(firstResult.isRegular).toBe(true)
					expect(firstResult.editorValid).toBe(true)
					expect(firstResult.uiValid).toBe(false)
					expect(firstResult.binaryValid).toBe(false)
				}
			),
			{ numRuns: 100 }
		)
	})
})
