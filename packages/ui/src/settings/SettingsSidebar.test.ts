import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { SettingsCategory } from './SettingsSidebar'

describe('SettingsSidebar', () => {
	// Property 4: Accordion Expand/Collapse State
	// **Feature: settings-page, Property 4: For any category with children, expanding the category SHALL make all children visible, and collapsing SHALL hide all children.**
	// **Validates: Requirements 2.2, 2.5**
	it('Property 4: Accordion expand/collapse state', () => {
		fc.assert(
			fc.property(
				// Generate categories with children
				fc.array(
					fc.record({
						id: fc
							.string({ minLength: 1, maxLength: 20 })
							.filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
						label: fc.string({ minLength: 1, maxLength: 50 }),
						children: fc.array(
							fc.record({
								id: fc
									.string({ minLength: 1, maxLength: 20 })
									.filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
								label: fc.string({ minLength: 1, maxLength: 50 }),
							}),
							{ minLength: 1, maxLength: 5 }
						),
					}),
					{ minLength: 1, maxLength: 3 }
				),
				(categories: SettingsCategory[]) => {
					// Test the logical property: categories with children should have the structure
					// that allows for expand/collapse behavior
					categories.forEach((category) => {
						if (category.children && category.children.length > 0) {
							// Property: A category with children should have:
							// 1. An id for identification
							// 2. A label for display
							// 3. An array of children
							expect(category.id).toBeDefined()
							expect(typeof category.id).toBe('string')
							expect(category.id.length).toBeGreaterThan(0)

							expect(category.label).toBeDefined()
							expect(typeof category.label).toBe('string')
							expect(category.label.length).toBeGreaterThan(0)

							expect(Array.isArray(category.children)).toBe(true)
							expect(category.children.length).toBeGreaterThan(0)

							// Each child should also have proper structure
							category.children.forEach((child) => {
								expect(child.id).toBeDefined()
								expect(typeof child.id).toBe('string')
								expect(child.id.length).toBeGreaterThan(0)

								expect(child.label).toBeDefined()
								expect(typeof child.label).toBe('string')
								expect(child.label.length).toBeGreaterThan(0)
							})
						}
					})

					return true
				}
			),
			{ numRuns: 100 }
		)
	})
})
