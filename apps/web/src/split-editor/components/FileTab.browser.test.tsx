/**
 * FileTab Component Browser Tests
 *
 * Tests FileTab component integration with Resource Manager,
 * mount/cleanup lifecycle, and editor integration.
 *
 * Requirements: 2.1, 2.5, 8.1, 8.2, 8.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-solid'
import { createSignal } from 'solid-js'
import { FileTab } from './FileTab'
import { SplitEditor } from './SplitEditor'
import { createLayoutManager } from '../createLayoutManager'
import { createResourceManager } from '../createResourceManager'
import type { Tab, EditorPane } from '../types'
import { createFileContent, createDefaultTabState, createDefaultViewSettings } from '../types'

describe('FileTab Component', () => {
	let layoutManager: ReturnType<typeof createLayoutManager>
	let resourceManager: ReturnType<typeof createResourceManager>

	beforeEach(() => {
		layoutManager = createLayoutManager()
		resourceManager = createResourceManager()
		layoutManager.initialize()
	})

	afterEach(() => {
		cleanup()
		resourceManager.cleanup()
	})

	it('registers with Resource Manager on mount', async () => {
		const filePath = '/test/file.ts'

		// Verify no resources initially
		expect(resourceManager.hasResourcesForFile(filePath)).toBe(false)

		const { unmount } = render(() => (
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={(tab, pane) => {
					// Only render FileTab for file content type
					if (tab.content.type === 'file' && tab.content.filePath) {
						return <FileTab tab={tab} pane={pane} filePath={tab.content.filePath} />
					}
					return <div>Other content</div>
				}}
			/>
		))

		// Open a file tab to trigger FileTab rendering
		const tabId = layoutManager.openTab(layoutManager.state.rootId, createFileContent(filePath))
		
		// Wait for component to mount and register
		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify resources are created
		expect(resourceManager.hasResourcesForFile(filePath)).toBe(true)
		expect(resourceManager.getTabCountForFile(filePath)).toBe(1)

		unmount()
	})

	it('unregisters from Resource Manager on cleanup', async () => {
		const filePath = '/test/cleanup.ts'

		const { unmount } = render(() => (
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={(tab, pane) => {
					if (tab.content.type === 'file' && tab.content.filePath) {
						return <FileTab tab={tab} pane={pane} filePath={tab.content.filePath} />
					}
					return <div>Other content</div>
				}}
			/>
		))

		// Open tab to trigger rendering
		const tabId = layoutManager.openTab(layoutManager.state.rootId, createFileContent(filePath))
		
		// Wait for mount
		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify resources exist
		expect(resourceManager.hasResourcesForFile(filePath)).toBe(true)

		// Close the tab to trigger cleanup
		layoutManager.closeTab(layoutManager.state.rootId, tabId)

		// Wait for cleanup
		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify resources are cleaned up
		expect(resourceManager.hasResourcesForFile(filePath)).toBe(false)
		expect(resourceManager.getTabCountForFile(filePath)).toBe(0)

		unmount()
	})

	it('uses shared buffer for content', async () => {
		const filePath = '/test/shared.ts'

		const { unmount } = render(() => (
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={(tab, pane) => {
					if (tab.content.type === 'file' && tab.content.filePath) {
						return <FileTab tab={tab} pane={pane} filePath={tab.content.filePath} />
					}
					return <div>Other content</div>
				}}
			/>
		))

		// Open first tab
		const tab1Id = layoutManager.openTab(layoutManager.state.rootId, createFileContent(filePath))
		await new Promise(resolve => setTimeout(resolve, 50))

		// Verify one tab registered
		expect(resourceManager.getTabCountForFile(filePath)).toBe(1)

		// Split pane and open same file in second pane
		const newPaneId = layoutManager.splitPane(layoutManager.state.rootId, 'horizontal')
		const tab2Id = layoutManager.openTab(newPaneId, createFileContent(filePath))
		await new Promise(resolve => setTimeout(resolve, 50))

		// Verify both tabs share resources
		expect(resourceManager.getTabCountForFile(filePath)).toBe(2)
		
		// Both should use the same buffer
		const buffer = resourceManager.getBuffer(filePath)
		expect(buffer).toBeDefined()

		unmount()
	})

	it('maintains independent scroll state per tab', async () => {
		const filePath = '/test/scroll.ts'

		const { unmount } = render(() => (
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={(tab, pane) => {
					if (tab.content.type === 'file' && tab.content.filePath) {
						return <FileTab tab={tab} pane={pane} filePath={tab.content.filePath} />
					}
					return <div>Other content</div>
				}}
			/>
		))

		// Open tab
		const tabId = layoutManager.openTab(layoutManager.state.rootId, createFileContent(filePath))
		
		// Update tab state to test independent state
		layoutManager.updateTabState(layoutManager.state.rootId, tabId, {
			scrollTop: 100,
			scrollLeft: 50,
		})

		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify FileTab component is rendered with correct data attributes
		const fileTabElement = document.querySelector('[data-testid="file-tab"]')
		expect(fileTabElement).toBeTruthy()
		expect(fileTabElement?.getAttribute('data-file-path')).toBe(filePath)
		expect(fileTabElement?.getAttribute('data-tab-id')).toBe(tabId)

		// Verify tab state is maintained
		const pane = layoutManager.state.nodes[layoutManager.state.rootId] as EditorPane
		const tab = pane.tabs.find(t => t.id === tabId)
		expect(tab?.state.scrollTop).toBe(100)
		expect(tab?.state.scrollLeft).toBe(50)

		unmount()
	})

	it('uses pane view settings for display', async () => {
		const filePath = '/test/settings.ts'

		const { unmount } = render(() => (
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={(tab, pane) => {
					if (tab.content.type === 'file' && tab.content.filePath) {
						return <FileTab tab={tab} pane={pane} filePath={tab.content.filePath} />
					}
					return <div>Other content</div>
				}}
			/>
		))

		// Update pane view settings
		layoutManager.updateViewSettings(layoutManager.state.rootId, {
			fontSize: 16,
			showLineNumbers: false,
		})

		// Open tab
		const tabId = layoutManager.openTab(layoutManager.state.rootId, createFileContent(filePath))
		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify component renders
		const fileTabElement = document.querySelector('[data-testid="file-tab"]')
		expect(fileTabElement).toBeTruthy()

		// Verify view settings are applied to pane
		const pane = layoutManager.state.nodes[layoutManager.state.rootId] as EditorPane
		expect(pane.viewSettings.fontSize).toBe(16)
		expect(pane.viewSettings.showLineNumbers).toBe(false)

		unmount()
	})

	it('handles multiple tabs for same file correctly', async () => {
		const filePath = '/test/multiple.ts'
		
		const { unmount } = render(() => (
			<SplitEditor
				layoutManager={layoutManager}
				resourceManager={resourceManager}
				renderTabContent={(tab, pane) => {
					if (tab.content.type === 'file' && tab.content.filePath) {
						return <FileTab tab={tab} pane={pane} filePath={tab.content.filePath} />
					}
					return <div>Other content</div>
				}}
			/>
		))

		// Open same file in multiple tabs
		const tab1Id = layoutManager.openTab(layoutManager.state.rootId, createFileContent(filePath))
		const newPaneId = layoutManager.splitPane(layoutManager.state.rootId, 'horizontal')
		const tab2Id = layoutManager.openTab(newPaneId, createFileContent(filePath))

		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify both tabs are tracked
		expect(resourceManager.getTabCountForFile(filePath)).toBe(2)

		// Close one tab
		layoutManager.closeTab(layoutManager.state.rootId, tab1Id)
		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify one tab still tracked
		expect(resourceManager.getTabCountForFile(filePath)).toBe(1)

		// Close second tab (this will close the pane too)
		layoutManager.closeTab(newPaneId, tab2Id)
		await new Promise(resolve => setTimeout(resolve, 100))

		// Verify resources cleaned up
		expect(resourceManager.getTabCountForFile(filePath)).toBe(0)

		unmount()
	})
})