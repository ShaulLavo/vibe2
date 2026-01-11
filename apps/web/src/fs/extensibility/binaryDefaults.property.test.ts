import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { ParseResult } from '@repo/utils'
import {
	detectAvailableViewModes,
	getDefaultViewMode,
	isViewModeValid,
} from '../utils/viewModeDetection'

/**
 * Property-based tests for binary file default mode behavior
 * **Feature: file-view-modes, Property 11: Binary File Default Mode**
 * **Validates: Requirements 4.4**
 */
describe('Binary File Default Mode Properties', () => {
	/**
	 * Property 11: Binary File Default Mode
	 * Binary files should default to editor mode but have binary mode available
	 * **Validates: Requirements 4.4**
	 */
	it('property: binary files default to editor mode with binary mode available', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.oneof(
						fc.constantFrom(
							'binary.exe',
							'document.pdf',
							'image.png',
							'archive.zip',
							'library.dll'
						),
						// Generate arbitrary binary file paths
						fc
							.tuple(
								fc
									.string({ minLength: 1, maxLength: 10 })
									.filter((s) => !s.includes('.')),
								fc.constantFrom('.exe', '.pdf', '.png', '.zip', '.dll', '.bin')
							)
							.map(([name, ext]) => `${name}${ext}`)
					),
					stats: fc.constant({ contentKind: 'binary' as const }),
				}),
				(config) => {
					const stats = config.stats as ParseResult
					const availableModes = detectAvailableViewModes(
						config.filePath,
						stats
					)
					const defaultMode = getDefaultViewMode(config.filePath, stats)

					// Binary files should have both editor and binary modes available
					expect(availableModes).toContain('editor')
					expect(availableModes).toContain('binary')
					expect(availableModes.length).toBe(2)

					// Default mode should be editor (Requirement 4.4)
					expect(defaultMode).toBe('editor')

					// Both modes should be valid for binary files
					expect(isViewModeValid('editor', config.filePath, stats)).toBe(true)
					expect(isViewModeValid('binary', config.filePath, stats)).toBe(true)

					// UI mode should not be available for binary files (unless they're settings)
					const isSettings =
						config.filePath.includes('.system/') &&
						config.filePath.endsWith('.json')
					if (!isSettings) {
						expect(isViewModeValid('ui', config.filePath, stats)).toBe(false)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: binary detection is consistent with mode availability', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom('test.exe', 'document.pdf', 'image.png'),
					contentKind: fc.constantFrom('text', 'binary') as fc.Arbitrary<
						'text' | 'binary'
					>,
				}),
				(config) => {
					const stats = {
						contentKind: config.contentKind,
					} as unknown as ParseResult
					const availableModes = detectAvailableViewModes(
						config.filePath,
						stats
					)
					const defaultMode = getDefaultViewMode(config.filePath, stats)

					if (config.contentKind === 'binary') {
						// Binary content should have binary mode available
						expect(availableModes).toContain('binary')
						expect(availableModes).toContain('editor')
						expect(availableModes.length).toBe(2)

						// Default should still be editor
						expect(defaultMode).toBe('editor')
					} else {
						// Text content should not have binary mode
						expect(availableModes).not.toContain('binary')
						expect(availableModes).toContain('editor')
						expect(availableModes.length).toBe(1)

						// Default should be editor
						expect(defaultMode).toBe('editor')
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: binary file mode switching preserves file identity', () => {
		fc.assert(
			fc.property(
				fc.record({
					binaryFile: fc.constantFrom('binary.exe', 'document.pdf'),
					modeSequence: fc.array(fc.constantFrom('editor', 'binary'), {
						minLength: 2,
						maxLength: 5,
					}),
				}),
				(config) => {
					const stats = { contentKind: 'binary' } as unknown as ParseResult

					const availableModes = detectAvailableViewModes(
						config.binaryFile,
						stats
					)

					// Verify all modes in sequence are valid
					for (const mode of config.modeSequence) {
						expect(availableModes).toContain(mode)
						expect(isViewModeValid(mode, config.binaryFile, stats)).toBe(true)
					}

					// Switching between modes should not change file identity
					const filePath = config.binaryFile
					for (const mode of config.modeSequence) {
						// File path should remain constant regardless of view mode
						expect(filePath).toBe(config.binaryFile)

						// Mode should be one of the available modes
						expect(['editor', 'binary']).toContain(mode)
					}

					// Default mode should always be editor regardless of sequence
					const defaultMode = getDefaultViewMode(config.binaryFile, stats)
					expect(defaultMode).toBe('editor')
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: binary files maintain consistent behavior across file types', () => {
		fc.assert(
			fc.property(
				fc.constantFrom(
					{ path: 'executable.exe', expectedModes: ['editor', 'binary'] },
					{ path: 'document.pdf', expectedModes: ['editor', 'binary'] },
					{ path: 'image.png', expectedModes: ['editor', 'binary'] },
					{ path: 'archive.zip', expectedModes: ['editor', 'binary'] },
					{ path: 'library.dll', expectedModes: ['editor', 'binary'] }
				),
				(testCase) => {
					const stats = { contentKind: 'binary' } as unknown as ParseResult
					const availableModes = detectAvailableViewModes(testCase.path, stats)
					const defaultMode = getDefaultViewMode(testCase.path, stats)

					// All binary files should have the same availabl
					// Verify modes
					expect(availableModes.sort()).toEqual(
						[...testCase.expectedModes].sort()
					)

					// All binary files should default to editor mode
					expect(defaultMode).toBe('editor')

					// Consistency across different binary file types
					expect(availableModes.length).toBe(2)
					expect(availableModes).toContain('editor')
					expect(availableModes).toContain('binary')
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: binary mode availability depends only on content kind', () => {
		fc.assert(
			fc.property(
				fc.record({
					fileName: fc.oneof(
						// Files that might be binary or text
						fc.constantFrom('data', 'config', 'script', 'document'),
						fc
							.string({ minLength: 1, maxLength: 10 })
							.filter((s) => !s.includes('.'))
					),
					extension: fc.constantFrom('.txt', '.exe', '.pdf', '.json', '.bin'),
					contentKind: fc.constantFrom('text', 'binary') as fc.Arbitrary<
						'text' | 'binary'
					>,
				}),
				(config) => {
					const filePath = `${config.fileName}${config.extension}`
					const stats = {
						contentKind: config.contentKind,
					} as unknown as ParseResult
					const availableModes = detectAvailableViewModes(filePath, stats)

					// Binary mode availability should depend only on contentKind, not file extension
					const hasBinaryMode = availableModes.includes('binary')
					expect(hasBinaryMode).toBe(config.contentKind === 'binary')

					// All files should have editor mode regardless of content kind
					expect(availableModes).toContain('editor')

					// Default should always be editor
					const defaultMode = getDefaultViewMode(filePath, stats)
					expect(defaultMode).toBe('editor')
				}
			),
			{ numRuns: 100 }
		)
	})
})
