import { createEffect } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { FsActions } from '../context/FsContext'
import { useTabs } from './useTabs'
import { createTabId, parseTabId, type ViewMode } from '../types/TabIdentity'
import {
	getDefaultViewMode,
	detectAvailableViewModes,
	getViewModeLabel,
} from '../utils/viewModeDetection'

const SETTINGS_FILE_PATH = '/.system/settings.json'

type UseSelectedFileTabsParams = {
	currentPath: Accessor<string | undefined>
	currentViewMode?: Accessor<ViewMode | undefined>
	selectedPath: Accessor<string | undefined>
	selectPath: FsActions['selectPath']
	setOpenTabs: FsActions['fileCache']['setOpenTabs']
	shouldShowJSONView: Accessor<boolean>
	maxTabs?: number
}

export const useSelectedFileTabs = (params: UseSelectedFileTabsParams) => {
	// Create a computed tab ID from current path and view mode
	const currentTabId = () => {
		const path = params.currentPath()
		if (!path) return undefined

		const viewMode = params.currentViewMode?.() ?? getDefaultViewMode(path)
		return createTabId({ path, viewMode })
	}

	const [tabsState, tabsActions] = useTabs(currentTabId, {
		maxTabs: params.maxTabs,
	})

	createEffect(() => {
		// Convert tab IDs back to paths for backward compatibility with existing code
		const tabPaths = tabsState().map((tabId) => parseTabId(tabId).path)
		params.setOpenTabs(tabPaths)
	})

	const handleTabSelect = (tabId: string) => {
		if (!tabId) return
		const identity = parseTabId(tabId)
		if (identity.path === params.selectedPath()) return
		void params.selectPath(identity.path)
	}

	const handleTabClose = (tabId: string) => {
		const selectedPath = params.selectedPath()
		const identity = parseTabId(tabId)
		const isClosingActiveTab = identity.path === selectedPath
		const previousTabId = isClosingActiveTab
			? tabsActions.getPreviousTab(tabId)
			: undefined

		tabsActions.closeTab(tabId)

		if (!isClosingActiveTab) return

		const nextPath = previousTabId ? parseTabId(previousTabId).path : ''

		void params.selectPath(nextPath)
	}

	const tabLabel = (tabId: string) => {
		const identity = parseTabId(tabId)
		const { path, viewMode } = identity

		// Get the base file name
		const fileName = path.split('/').pop() || path

		// Special handling for settings file
		if (path === SETTINGS_FILE_PATH) {
			if (viewMode === 'ui') {
				return 'Settings'
			} else {
				return 'Settings (JSON)'
			}
		}

		// For other files, add view mode indicator for non-default modes
		if (viewMode !== 'editor') {
			const modeLabel = getViewModeLabel(viewMode)
			return `${fileName} (${modeLabel})`
		}

		return fileName
	}

	// Enhanced tooltip information for tabs (Requirements 8.4)
	const getTabTooltip = (tabId: string) => {
		const identity = parseTabId(tabId)
		const { path, viewMode } = identity
		const modeLabel = getViewModeLabel(viewMode)

		return `${path} - ${modeLabel} mode`
	}

	// Check if a file supports multiple view modes (Requirements 2.1, 2.4)
	const supportsMultipleViewModes = (path: string) => {
		const availableModes = detectAvailableViewModes(path)
		return availableModes.length > 1
	}

	// Get available view modes for a file
	const getAvailableViewModes = (path: string) => {
		return detectAvailableViewModes(path)
	}

	return {
		tabsState,
		handleTabSelect,
		handleTabClose,
		tabLabel,
		getTabTooltip,
		supportsMultipleViewModes,
		getAvailableViewModes,
		// Utility functions for working with tab identities
		getTabIdentity: tabsActions.getTabIdentity,
		createTabId: tabsActions.createTabId,
	}
}
