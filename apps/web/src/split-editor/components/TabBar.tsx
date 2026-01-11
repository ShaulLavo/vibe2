/**
 * TabBar Component
 *
 * Renders horizontal list of tabs with horizontal scroll support for overflow.
 * Includes ViewModeToggle for files that support multiple view modes.
 * Requirements: 7.8, 15.6, View Mode Support
 */

import { createMemo, For, Show } from 'solid-js'
import { useLayoutManager } from './SplitEditor'
import { TabItem } from './TabItem'
import { isPane } from '../types'
import { ViewModeToggle } from '../../fs/components/ViewModeToggle'
import { detectAvailableViewModes } from '../../fs/utils/viewModeDetection'
import { viewModeRegistry } from '../../fs/registry/ViewModeRegistry'
import type { ViewMode } from '../../fs/types/ViewMode'

export interface TabBarProps {
	paneId: string
}

export function TabBar(props: TabBarProps) {
	const layout = useLayoutManager()

	// Get pane reactively from store
	const pane = createMemo(() => {
		const node = layout.state.nodes[props.paneId]
		return node && isPane(node) ? node : null
	})

	const tabs = createMemo(() => pane()?.tabs ?? [])
	const activeTabId = createMemo(() => pane()?.activeTabId ?? null)

	// Get active tab
	const activeTab = createMemo(() => {
		const id = activeTabId()
		return tabs().find(t => t.id === id)
	})

	// Get current file path
	const currentFilePath = createMemo(() => {
		const tab = activeTab()
		if (tab && tab.content.type === 'file' && tab.content.filePath) {
			return tab.content.filePath
		}
		return null
	})

	// Get current view mode
	const currentViewMode = createMemo((): ViewMode => {
		const tab = activeTab()
		return tab?.viewMode ?? 'editor'
	})

	// Get available view modes for current file
	const availableViewModes = createMemo(() => {
		const path = currentFilePath()
		if (!path) return []

		// Ensure registry is initialized
		viewModeRegistry.initialize()

		const modes = detectAvailableViewModes(path, undefined)
		return modes
			.map((mode) => viewModeRegistry.getViewMode(mode))
			.filter((mode): mode is NonNullable<typeof mode> => mode !== undefined)
	})

	// Handle view mode selection
	const handleViewModeSelect = (newViewMode: ViewMode) => {
		const tab = activeTab()
		if (tab) {
			layout.setTabViewMode(props.paneId, tab.id, newViewMode)
		}
	}

	return (
		<div class="tab-bar flex h-9 shrink-0 border-b border-border bg-surface-1">
			<div class="flex flex-1 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-surface-3">
				<For each={tabs()}>
					{(tab) => (
						<TabItem
							tab={tab}
							paneId={props.paneId}
							isActive={activeTabId() === tab.id}
						/>
					)}
				</For>
			</div>

			{/* View Mode Toggle */}
			<Show when={currentFilePath()}>
				<ViewModeToggle
					currentPath={currentFilePath()!}
					currentViewMode={currentViewMode()}
					availableModes={availableViewModes()}
					onModeSelect={handleViewModeSelect}
				/>
			</Show>
		</div>
	)
}
