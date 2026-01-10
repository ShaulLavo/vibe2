import type { SettingDefinition, SettingsSchema } from '../types'

export type ValidationError = {
	type: 'missing_field' | 'invalid_key_format' | 'invalid_type'
	message: string
	settingKey?: string
	field?: string
}

export type ValidationResult = {
	isValid: boolean
	errors: ValidationError[]
}

/**
 * Validates that a setting key follows dot-notation format (lowercase letters separated by dots)
 */
export const validateKeyFormat = (key: string): boolean => {
	const dotNotationPattern = /^[a-z]+(\.[a-z]+)+$/
	return dotNotationPattern.test(key)
}

/**
 * Validates that a setting definition has all required fields
 */
export const validateSettingDefinition = (
	setting: unknown
): ValidationResult => {
	const errors: ValidationError[] = []

	if (!setting || typeof setting !== 'object') {
		return {
			isValid: false,
			errors: [{ type: 'invalid_type', message: 'Setting must be an object' }],
		}
	}

	const settingObj = setting as Record<string, unknown>
	const requiredFields = ['key', 'type', 'default', 'description', 'category']

	// Check for required fields
	for (const field of requiredFields) {
		if (!(field in settingObj) || settingObj[field] === undefined) {
			errors.push({
				type: 'missing_field',
				message: `Missing required field: ${field}`,
				field,
				settingKey:
					typeof settingObj.key === 'string' ? settingObj.key : undefined,
			})
		}
	}

	// Validate key format if key exists
	if (typeof settingObj.key === 'string') {
		if (!validateKeyFormat(settingObj.key)) {
			errors.push({
				type: 'invalid_key_format',
				message: `Key must follow dot-notation format (lowercase letters separated by dots): ${settingObj.key}`,
				settingKey: settingObj.key,
			})
		}
	}

	// Validate type field
	if (settingObj.type !== undefined && typeof settingObj.type === 'string') {
		const validTypes = ['boolean', 'string', 'number']
		if (!validTypes.includes(settingObj.type)) {
			errors.push({
				type: 'invalid_type',
				message: `Invalid type: ${settingObj.type}. Must be one of: ${validTypes.join(', ')}`,
				settingKey:
					typeof settingObj.key === 'string' ? settingObj.key : undefined,
			})
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}

/**
 * Validates an entire settings schema
 */
export const validateSettingsSchema = (schema: unknown): ValidationResult => {
	const errors: ValidationError[] = []

	if (!schema || typeof schema !== 'object') {
		return {
			isValid: false,
			errors: [{ type: 'invalid_type', message: 'Schema must be an object' }],
		}
	}

	const schemaObj = schema as Record<string, unknown>

	// Validate that settings array exists
	if (!Array.isArray(schemaObj.settings)) {
		errors.push({
			type: 'missing_field',
			message: 'Schema must have a settings array',
			field: 'settings',
		})
	} else {
		// Validate each setting definition
		for (let i = 0; i < schemaObj.settings.length; i++) {
			const settingResult = validateSettingDefinition(schemaObj.settings[i])
			if (!settingResult.isValid) {
				errors.push(
					...settingResult.errors.map((error) => ({
						...error,
						message: `Setting ${i}: ${error.message}`,
					}))
				)
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	}
}
