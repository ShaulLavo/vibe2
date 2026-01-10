import { useFs } from '../../fs/context/FsContext'

const USER_SETTINGS_FILE_PATH = '/.system/userSettings.json'

export const useSettingsIntegration = () => {
	const [, { selectPath }] = useFs()

	const openSettings = async () => {
		await selectPath(USER_SETTINGS_FILE_PATH)
	}

	const openJSONView = async () => {
		await selectPath(USER_SETTINGS_FILE_PATH)
	}

	const openUIView = async () => {
		await selectPath(USER_SETTINGS_FILE_PATH)
	}

	const isSettingsFile = (path: string | undefined) => {
		return path === USER_SETTINGS_FILE_PATH
	}

	return {
		openSettings,
		openJSONView,
		openUIView,
		isSettingsFile,
		USER_SETTINGS_FILE_PATH,
	}
}
