/**
 * Split Editor Panel
 *
 * Replaces the single editor with a split editor system.
 * Integrates with the existing file system context and provides
 * tab-based editing with split panes.
 */

import { createMemo, createSignal, onMount, createEffect, type Accessor, type JSX } from 'solid-js'
import { SplitEditor } from '../../split-editor/components/SplitEditor'
import { createLayoutManager } from '../../split-editor/createLayoutManager'
import { createResourceManager } from '../../split-editor/createResourceManager'
import { createFileContent } from '../../split-editor/types'
import { useFs } from '../context/FsContext'
import type { Tab, EditorPane, LayoutManager } from '../../split-editor'

type SplitEditorPanelProps = {
	isFileSelected: Accessor<boolean>
	currentPath?: string
	onLayoutManagerReady?: (layoutManager: LayoutManager) => void
}

export const SplitEditorPanel = (props: SplitEditorPanelProps) => {
	const [state] = useFs()
	
	// Create layout and resource managers
	const layoutManager = createLayoutManager()
	const resourceManager = createResourceManager()
	
	// Initialize with single pane
	onMount(() => {
		layoutManager.initialize()
		
		// Notify parent that layout manager is ready
		props.onLayoutManagerReady?.(layoutManager)
		
		// If there's a current file, open it as the first tab
		const currentPath = props.currentPath
		if (currentPath && props.isFileSelected()) {
			const focusedPaneId = layoutManager.state.focusedPaneId
			if (focusedPaneId) {
				const content = createFileContent(currentPath)
				layoutManager.openTab(focusedPaneId, content)
			}
		} else {
			// Open a welcome tab if no file is selected
			const focusedPaneId = layoutManager.state.focusedPaneId
			if (focusedPaneId) {
				const content = { type: 'empty' as const }
				layoutManager.openTab(focusedPaneId, content)
			}
		}
	})
	
	// Function to open a file as a tab (exposed for external use)
	const openFileAsTab = (filePath: string) => {
		const focusedPaneId = layoutManager.state.focusedPaneId
		if (focusedPaneId) {
			// Check if file is already open in any pane
			const existingTab = layoutManager.findTabByFilePath(filePath)()
			if (existingTab) {
				// Switch to existing tab
				layoutManager.setActiveTab(existingTab.paneId, existingTab.tab.id)
				layoutManager.setFocusedPane(existingTab.paneId)
			} else {
				// Open as new tab in focused pane
				const content = createFileContent(filePath)
				layoutManager.openTab(focusedPaneId, content)
			}
		}
	}
	
	// Expose the openFileAsTab function
	;(layoutManager as any).openFileAsTab = openFileAsTab
	
	// Custom tab content renderer that integrates with existing editor
	const renderTabContent = (tab: Tab, pane: EditorPane): JSX.Element => {
		if (tab.content.type === 'empty') {
			return (
				<div class="h-full w-full flex items-center justify-center text-muted-foreground">
					<div class="text-center">
						<div class="text-lg font-medium mb-2">Welcome to Split Editor</div>
						<div class="text-sm">
							Select a file from the tree to start editing
						</div>
					</div>
				</div>
			)
		}
		
		if (tab.content.type === 'file' && tab.content.filePath) {
			return (
				<div class="h-full w-full flex items-center justify-center text-muted-foreground">
					<div class="text-center">
						<div class="text-lg font-medium mb-2">File Editor</div>
						<div class="text-sm">
							File: {tab.content.filePath}
						</div>
						<div class="text-xs mt-2 opacity-75">
							(Editor integration coming in next tasks)
						</div>
					</div>
				</div>
			)
		}
		
		return (
			<div class="h-full w-full flex items-center justify-center text-muted-foreground">
				<div class="text-center">
					<div class="text-lg font-medium mb-2">Split Editor</div>
					<div class="text-sm">Empty tab</div>
				</div>
			</div>
		)
	}
	
	return (
		<div class="h-full w-full">
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={renderTabContent}
			/>
		</div>
	)
}