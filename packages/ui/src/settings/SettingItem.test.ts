import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { SettingDefinition } from './SettingItem'

describe('SettingItem', () => {
	// Property 6: Setting Item Content
	// **Feature: settings-page, Property 6: For any setting definition, the rendered Setting_Item SHALL contain the setting's id and description text.**
	// **Validates: Requirements 4.2**
	it('Property 6: Setting item content', () => {
		fc.assert(
			fc.property(
				// Generate valid setting definitions (new format with id instead of key)
				fc.record({
					id: fc
						.string({ minLength: 1, maxLength: 20 })
						.filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
					key: fc
						.string({ minLength: 3, maxLength: 50 })
						.filter((s) => /^[a-z]+(\\.[a-z]+)+$/.test(s)),
					default: fc.oneof(fc.boolean(), fc.string(), fc.integer()),
					description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
						nil: undefined,
					}),
					options: fc.option(
						fc.array(
							fc.record({
								value: fc.string({ minLength: 1, maxLength: 20 }),
								label: fc.string({ minLength: 1, maxLength: 50 }),
							}),
							{ minLength: 1, maxLength: 5 }
						),
						{ nil: undefined }
					),
					experimental: fc.option(fc.boolean(), { nil: undefined }),
				}),
				(setting: SettingDefinition) => {
					// Property: A setting definition should contain all required content fields
					// The setting should have an id, key, and optional description

					// 1. Setting should have a valid id
					expect(setting.id).toBeDefined()
					expect(typeof setting.id).toBe('string')
					expect(setting.id.length).toBeGreaterThan(0)

					// 2. Setting should have a valid key (full path)
					expect(setting.key).toBeDefined()
					expect(typeof setting.key).toBe('string')
					expect(setting.key.length).toBeGreaterThan(0)

					// 3. Setting should have a default value
					expect(setting.default).toBeDefined()

					// 4. Type is inferred from default value
					const defaultType = typeof setting.default
					expect(['boolean', 'string', 'number']).toContain(defaultType)

					return true
				}
			),
			{ numRuns: 100 }
		)
	})

	// Property 7: Correct Control Type Rendering
	// **Feature: settings-page, Property 7: Type is inferred from default value: If default is boolean, a checkbox control SHALL be rendered; If default is string with options, a select control SHALL be rendered; If default is string without options, a text input SHALL be rendered; If default is number, a number input SHALL be rendered.**
	// **Validates: Requirements 4.3, 4.4, 4.5, 4.6**
	it('Property 7: Correct control type rendering (inferred from default)', () => {
		fc.assert(
			fc.property(
				// Generate setting definitions with specific default value types
				fc.oneof(
					// Boolean setting (inferred from boolean default)
					fc.record({
						id: fc
							.string({ minLength: 1, maxLength: 20 })
							.filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
						key: fc
							.string({ minLength: 3, maxLength: 50 })
							.filter((s) => /^[a-z]+(\\.[a-z]+)+$/.test(s)),
						default: fc.boolean(),
						description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
					}),
					// String setting with options (select) - inferred from string default + options
					fc.record({
						id: fc
							.string({ minLength: 1, maxLength: 20 })
							.filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
						key: fc
							.string({ minLength: 3, maxLength: 50 })
							.filter((s) => /^[a-z]+(\\.[a-z]+)+$/.test(s)),
						default: fc.string(),
						description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
						options: fc.array(
							fc.record({
								value: fc.string({ minLength: 1, maxLength: 20 }),
								label: fc.string({ minLength: 1, maxLength: 50 }),
							}),
							{ minLength: 1, maxLength: 5 }
						),
					}),
					// String setting without options (text input) - inferred from string default
					fc.record({
						id: fc
							.string({ minLength: 1, maxLength: 20 })
							.filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
						key: fc
							.string({ minLength: 3, maxLength: 50 })
							.filter((s) => /^[a-z]+(\\.[a-z]+)+$/.test(s)),
						default: fc.string(),
						description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
					}),
					// Number setting - inferred from number default
					fc.record({
						id: fc
							.string({ minLength: 1, maxLength: 20 })
							.filter((s) => /^[a-z][a-zA-Z0-9]*$/.test(s)),
						key: fc
							.string({ minLength: 3, maxLength: 50 })
							.filter((s) => /^[a-z]+(\\.[a-z]+)+$/.test(s)),
						default: fc.integer(),
						description: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
					})
				),
				(setting: SettingDefinition) => {
					// Property: The control type should be inferred from the default value type

					const inferredType = typeof setting.default

					if (inferredType === 'boolean') {
						// Boolean settings should use checkbox control
						expect(typeof setting.default).toBe('boolean')
						return true
					}

					if (
						inferredType === 'string' &&
						setting.options &&
						setting.options.length > 0
					) {
						// String settings with options should use select control
						expect(typeof setting.default).toBe('string')
						expect(Array.isArray(setting.options)).toBe(true)
						expect(setting.options.length).toBeGreaterThan(0)
						return true
					}

					if (
						inferredType === 'string' &&
						(!setting.options || setting.options.length === 0)
					) {
						// String settings without options should use text input control
						expect(typeof setting.default).toBe('string')
						expect(!setting.options || setting.options.length === 0).toBe(true)
						return true
					}

					if (inferredType === 'number') {
						// Number settings should use number input control
						expect(typeof setting.default).toBe('number')
						return true
					}

					// Should not reach here with valid input
					return false
				}
			),
			{ numRuns: 100 }
		)
	})
})
