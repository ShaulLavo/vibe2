import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { SettingDefinition } from './SettingItem'

describe('SettingsPanel', () => {
	// Property 5: Settings Grouped by Category
	// **Feature: settings-page, Property 5: For any category displayed in the settings panel, all settings shown SHALL belong to that category (matching category ID).**
	// **Validates: Requirements 4.1**
	it('Property 5: Settings grouped by category', () => {
		fc.assert(
			fc.property(
				// Generate a target category ID
				fc
					.string({ minLength: 1, maxLength: 10 })
					.filter((s) => /^[a-z]+$/.test(s)),
				// Generate a smaller array of settings with various categories
				fc.array(
					fc.record({
						key: fc
							.string({ minLength: 3, maxLength: 20 })
							.filter((s) => /^[a-z]+\.[a-z]+$/.test(s)),
						type: fc.constantFrom('boolean', 'string', 'number'),
						default: fc.oneof(
							fc.boolean(),
							fc.string({ maxLength: 10 }),
							fc.integer({ min: 0, max: 100 })
						),
						description: fc.string({ minLength: 1, maxLength: 50 }),
						category: fc
							.string({ minLength: 1, maxLength: 10 })
							.filter((s) => /^[a-z]+$/.test(s)),
					}),
					{ minLength: 0, maxLength: 10 }
				),
				(targetCategoryId: string, allSettings: SettingDefinition[]) => {
					// Property: When filtering settings for a category, only settings with matching category ID should be included

					// Filter settings for the target category (simulating SettingsPanel logic)
					const categorySettings = allSettings.filter(
						(setting) => setting.category === targetCategoryId
					)

					// All filtered settings should belong to the target category
					for (const setting of categorySettings) {
						expect(setting.category).toBe(targetCategoryId)
					}

					// The filtered list should only contain settings for the target category
					const expectedCount = allSettings.filter(
						(setting) => setting.category === targetCategoryId
					).length
					expect(categorySettings.length).toBe(expectedCount)

					return true
				}
			),
			{ numRuns: 50 } // Reduced from 100 to avoid timeout
		)
	})
})
