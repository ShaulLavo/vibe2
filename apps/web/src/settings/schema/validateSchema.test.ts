import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
	validateKeyFormat,
	validateSettingDefinition,
	validateSettingsSchema,
} from './validateSchema'
import type { SettingDefinition } from '../types'

describe('Schema Validation Properties', () => {
	/**
	 * **Feature: settings-page, Property 12: Schema Validation**
	 * For any setting in the schema, it SHALL have all required fields: key, type, default, description, and category.
	 */
	it('Property 12: Schema Validation - all settings must have required fields', () => {
		fc.assert(
			fc.property(
				fc.record({
					key: fc
						.array(fc.stringMatching(/^[a-z]+$/), {
							minLength: 2,
							maxLength: 3,
						})
						.map((parts) => parts.join('.')),
					type: fc.constantFrom('boolean', 'string', 'number'),
					default: fc.oneof(
						fc.boolean(),
						fc.string(),
						fc.integer(),
						fc.constant(null)
					),
					description: fc.string({ minLength: 1 }),
					category: fc.string({ minLength: 1 }),
					subcategory: fc.option(fc.string({ minLength: 1 })),
					options: fc.option(
						fc.array(
							fc.record({
								value: fc.string(),
								label: fc.string(),
							})
						)
					),
					experimental: fc.option(fc.boolean()),
				}),
				(validSetting) => {
					const result = validateSettingDefinition(validSetting)

					// A setting with all required fields and valid key format should be valid
					expect(result.isValid).toBe(true)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('Property 12: Schema Validation - missing required fields should be invalid', () => {
		fc.assert(
			fc.property(
				fc.record({
					key: fc.option(fc.string()),
					type: fc.option(fc.constantFrom('boolean', 'string', 'number')),
					default: fc.option(fc.anything()),
					description: fc.option(fc.string()),
					category: fc.option(fc.string()),
				}),
				(incompleteSetting) => {
					const requiredFields = [
						'key',
						'type',
						'default',
						'description',
						'category',
					]
					const missingFields = requiredFields.filter(
						(field) =>
							!(field in incompleteSetting) ||
							incompleteSetting[field as keyof typeof incompleteSetting] ===
								undefined
					)

					// Skip if all required fields are present
					if (missingFields.length === 0) return

					const result = validateSettingDefinition(incompleteSetting)

					// Should be invalid if any required field is missing
					expect(result.isValid).toBe(false)

					// Should have missing_field errors for each missing field
					const missingFieldErrors = result.errors.filter(
						(error) => error.type === 'missing_field'
					)
					expect(missingFieldErrors.length).toBeGreaterThan(0)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * **Feature: settings-page, Property 13: Dot-Notation Key Format**
	 * For any setting key in the schema, it SHALL match the pattern ^[a-z]+(\.[a-z]+)+ (lowercase dot-notation).
	 */
	it('Property 13: Dot-Notation Key Format - valid keys should pass validation', () => {
		fc.assert(
			fc.property(
				fc.array(fc.stringMatching(/^[a-z]+$/), { minLength: 2, maxLength: 5 }),
				(keyParts) => {
					const dotNotationKey = keyParts.join('.')

					const result = validateKeyFormat(dotNotationKey)

					expect(result).toBe(true)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('Property 13: Dot-Notation Key Format - invalid keys should fail validation', () => {
		fc.assert(
			fc.property(
				fc.oneof(
					// Single word (no dots)
					fc.stringMatching(/^[a-z]+$/),
					// Contains uppercase
					fc.stringMatching(/^[a-zA-Z]+\.[a-zA-Z]+$/),
					// Contains numbers
					fc.stringMatching(/^[a-z0-9]+\.[a-z0-9]+$/),
					// Contains special characters
					fc.stringMatching(/^[a-z_-]+\.[a-z_-]+$/),
					// Empty string
					fc.constant(''),
					// Starts or ends with dot
					fc.oneof(
						fc.stringMatching(/^\.[a-z]+$/),
						fc.stringMatching(/^[a-z]+\.$/),
						fc.stringMatching(/^\.[a-z]+\.[a-z]+$/),
						fc.stringMatching(/^[a-z]+\.[a-z]+\.$/)
					)
				),
				(invalidKey) => {
					// Skip if the key accidentally matches valid format
					if (/^[a-z]+(\.[a-z]+)+$/.test(invalidKey)) return

					const result = validateKeyFormat(invalidKey)

					expect(result).toBe(false)
				}
			),
			{ numRuns: 100 }
		)
	})

	it('Property 13: Dot-Notation Key Format - setting validation includes key format check', () => {
		fc.assert(
			fc.property(
				fc.record({
					key: fc.oneof(
						// Valid dot-notation key
						fc
							.array(fc.stringMatching(/^[a-z]+$/), {
								minLength: 2,
								maxLength: 3,
							})
							.map((parts) => parts.join('.')),
						// Invalid key
						fc.stringMatching(/^[A-Z][a-z]*$/) // Starts with uppercase
					),
					type: fc.constantFrom('boolean', 'string', 'number'),
					default: fc.anything(),
					description: fc.string({ minLength: 1 }),
					category: fc.string({ minLength: 1 }),
				}),
				(setting) => {
					const result = validateSettingDefinition(setting)
					const isValidKeyFormat = /^[a-z]+(\.[a-z]+)+$/.test(setting.key)

					if (isValidKeyFormat) {
						// Valid key format should not have key format errors
						const hasKeyFormatError = result.errors.some(
							(error) => error.type === 'invalid_key_format'
						)
						expect(hasKeyFormatError).toBe(false)
					} else {
						// Invalid key format should have key format error
						const hasKeyFormatError = result.errors.some(
							(error) => error.type === 'invalid_key_format'
						)
						expect(hasKeyFormatError).toBe(true)
					}
				}
			),
			{ numRuns: 100 }
		)
	})
})
