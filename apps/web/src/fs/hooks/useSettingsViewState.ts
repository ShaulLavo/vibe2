import { createMemo, createSignal } from 'solid-js'
import type { Accessor } from 'solid-js'

const SETTINGS_FILE_PATH = '/.system/settings.json'

type UseSettingsViewStateParams = {
	selectedPath: Accessor<string | undefined>
}

// Simple local state for settings UI (exported for direct access from commands)
const [currentCategory, setCurrentCategory] = createSignal<string>('editor')
const [isJsonView, setIsJsonView] = createSignal(true)

// Export direct setters for command palette usage
export const setSettingsJsonView = () => setIsJsonView(true)
export const setSettingsUIView = () => setIsJsonView(false)

export const useSettingsViewState = (params: UseSettingsViewStateParams) => {
	const isSettingsFile = createMemo(
		() => params.selectedPath() === SETTINGS_FILE_PATH
	)
	const shouldShowSettings = createMemo(() => isSettingsFile())
	const shouldShowJSONView = createMemo(() => isJsonView())

	const handleCategoryChange = (categoryId: string) => {
		setCurrentCategory(categoryId)
		setIsJsonView(false)
	}

	const openJSONView = () => {
		setIsJsonView(true)
	}

	const openUIView = () => {
		setIsJsonView(false)
	}

	return {
		isSettingsFile,
		shouldShowSettings,
		shouldShowJSONView,
		handleCategoryChange,
		currentCategory,
		openJSONView,
		openUIView,
	}
}
