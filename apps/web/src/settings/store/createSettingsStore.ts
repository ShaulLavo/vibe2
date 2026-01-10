import { createStore, produce, unwrap } from 'solid-js/store'
import { createSignal, onCleanup } from 'solid-js'
import type { SettingsSchema, SettingDefinition } from '../types'
import { ensureFs } from '../../fs/runtime/fsRuntime'
import type { FsSource } from '../../fs/types'

export type SettingsState = {
	schema: SettingsSchema
	values: Record<string, unknown> // Merged: defaults + user overrides
	defaults: Record<string, unknown> // Default values from schema (read-only)
	userOverrides: Record<string, unknown> // Only user-changed settings
	isLoaded: boolean
}

export type SettingsActions = {
	getSetting: <T>(key: string) => T
	setSetting: (key: string, value: unknown) => void
	resetSetting: (key: string) => void
	resetAllSettings: () => void
	getSettingsForCategory: (categoryId: string) => SettingDefinition[]
}

export type SettingsStore = [SettingsState, SettingsActions]

const USER_SETTINGS_FILE_PATH = '/.system/userSettings.json'
const DEFAULT_SETTINGS_FILE_PATH = '/.system/defaultSettings.json'

export const createSettingsStore = (
	source: FsSource = 'opfs'
): SettingsStore => {
	const [state, setState] = createStore<SettingsState>({
		schema: { categories: [], settings: [] },
		values: {},
		defaults: {},
		userOverrides: {},
		isLoaded: false,
	})

	const [isSaving, setIsSaving] = createSignal(false)

	const loadSchema = async (): Promise<SettingsSchema> => {
		try {
			const [editorSchema, appearanceSchema, terminalSchema, uiSchema] =
				await Promise.all([
					import('../schemas/editor.json'),
					import('../schemas/appearance.json'),
					import('../schemas/terminal.json'),
					import('../schemas/ui.json'),
				])

			const categories = [
				editorSchema.category,
				terminalSchema.category,
				uiSchema.category,
				appearanceSchema.category,
			]

			const settings: SettingDefinition[] = [
				...(editorSchema.settings as SettingDefinition[]),
				...(terminalSchema.settings as SettingDefinition[]),
				...(uiSchema.settings as SettingDefinition[]),
				...(appearanceSchema.settings as SettingDefinition[]),
			]

			return { categories, settings }
		} catch (error) {
			console.error('[Settings] Failed to load schema:', error)
			return { categories: [], settings: [] }
		}
	}

	const extractDefaults = (schema: SettingsSchema): Record<string, unknown> => {
		const defaults: Record<string, unknown> = {}
		for (const setting of schema.settings) {
			defaults[setting.key] = setting.default
		}
		return defaults
	}

	const ensureSettingsFilesExist = async (defaults: Record<string, unknown>) => {
		try {
			const ctx = await ensureFs(source)
			await ctx.ensureDir('/.system')

			// Ensure defaultSettings.json exists with current defaults
			const defaultsExist = await ctx.exists(DEFAULT_SETTINGS_FILE_PATH)
			const defaultsJson = JSON.stringify(defaults, null, 2)
			
			if (!defaultsExist) {
				await ctx.write(DEFAULT_SETTINGS_FILE_PATH, defaultsJson)
				console.log('[Settings] Created defaultSettings.json')
			} else {
				// Only update if content actually changed (avoid race with file reading)
				try {
					const file = ctx.file(DEFAULT_SETTINGS_FILE_PATH, 'r')
					const existingContent = await file.text()
					if (existingContent !== defaultsJson) {
						await ctx.write(DEFAULT_SETTINGS_FILE_PATH, defaultsJson)
						console.log('[Settings] Updated defaultSettings.json (schema changed)')
					}
				} catch {
					// If we can't read, just write
					await ctx.write(DEFAULT_SETTINGS_FILE_PATH, defaultsJson)
				}
			}

			// Ensure userSettings.json exists
			const userExists = await ctx.exists(USER_SETTINGS_FILE_PATH)
			if (!userExists) {
				await ctx.write(USER_SETTINGS_FILE_PATH, '{}')
				console.log('[Settings] Created empty userSettings.json')
			}
		} catch (error) {
			console.error('[Settings] Failed to ensure settings files exist:', error)
		}
	}

	const loadUserOverrides = async (defaults: Record<string, unknown>): Promise<Record<string, unknown>> => {
		try {
			await ensureSettingsFilesExist(defaults)

			const ctx = await ensureFs(source)
			const file = ctx.file(USER_SETTINGS_FILE_PATH, 'r')
			const content = await file.text()

			if (!content.trim() || content.trim() === '{}') {
				return {}
			}

			return JSON.parse(content)
		} catch (error) {
			console.warn('[Settings] Failed to load user settings:', error)
			return {}
		}
	}

	// Save to file - called when UI changes a setting
	const saveToFile = async () => {
		if (isSaving()) return
		setIsSaving(true)

		try {
			const ctx = await ensureFs(source)
			await ctx.ensureDir('/.system')
			await ctx.write(
				USER_SETTINGS_FILE_PATH,
				JSON.stringify(unwrap(state.userOverrides), null, 2)
			)
		} catch (error) {
			console.error('[Settings] Failed to save settings:', error)
		} finally {
			setIsSaving(false)
		}
	}

	const initialize = async () => {
		try {
			const schema = await loadSchema()
			const defaults = extractDefaults(schema)
			const userOverrides = await loadUserOverrides(defaults)

			const mergedValues = { ...defaults, ...userOverrides }

			setState(
				produce((s) => {
					s.schema = schema
					s.defaults = defaults
					s.userOverrides = userOverrides
					s.values = mergedValues
					s.isLoaded = true
				})
			)
		} catch (error) {
			console.error('[Settings] Failed to initialize settings store:', error)
		}
	}

	void initialize()

	// Listen for settings file saves from the editor
	const handleSettingsFileSaved = (event: CustomEvent) => {
		const newOverrides = event.detail as Record<string, unknown>
		console.log('[Settings] Settings file saved from editor, updating store...')

		setState(
			produce((s) => {
				s.userOverrides = newOverrides
				s.values = { ...s.defaults, ...newOverrides }
			})
		)
	}

	if (typeof window !== 'undefined') {
		window.addEventListener(
			'settings-file-saved',
			handleSettingsFileSaved as EventListener
		)

		onCleanup(() => {
			window.removeEventListener(
				'settings-file-saved',
				handleSettingsFileSaved as EventListener
			)
		})
	}

	const getSetting = <T>(key: string): T => {
		return state.values[key] as T
	}

	const setSetting = (key: string, value: unknown) => {
		const defaultValue = state.defaults[key]
		const isDefault = value === defaultValue

		setState(
			produce((s) => {
				if (isDefault) {
					delete s.userOverrides[key]
				} else {
					s.userOverrides[key] = value
				}
				s.values[key] = value
			})
		)

		// Save immediately when user changes a setting via UI
		void saveToFile()
	}

	const resetSetting = (key: string) => {
		setState(
			produce((s) => {
				delete s.userOverrides[key]
				s.values[key] = s.defaults[key]
			})
		)

		void saveToFile()
	}

	const resetAllSettings = () => {
		setState(
			produce((s) => {
				s.userOverrides = {}
				s.values = { ...s.defaults }
			})
		)

		void saveToFile()
	}

	const getSettingsForCategory = (categoryId: string): SettingDefinition[] => {
		return state.schema.settings.filter(
			(setting) => setting.category === categoryId
		)
	}

	const actions: SettingsActions = {
		getSetting,
		setSetting,
		resetSetting,
		resetAllSettings,
		getSettingsForCategory,
	}

	return [state, actions]
}
