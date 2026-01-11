import { describe, it, expect, beforeEach } from 'vitest'
import fc from 'fast-check'
import { createLayoutManager } from './createLayoutManager'
import type { LayoutManager } from './createLayoutManager'
import type { SplitDirection, SplitContainer, EditorPane, NodeId } from './types'
import { isContainer, isPane } from './types'

/**
 * Property-based tests for Split Editor Layout Manager
 * **Feature: split-editor**
 */
describe('Layout Manager Properties', () => {
	let manager: LayoutManager

	beforeEach(() => {
		manager = createLayoutManager()
		manager.initialize()
	})

	/**
	 * Helper: Get all pane IDs from the layout
	 */
	function getAllPaneIds(): NodeId[] {
		return Object.values(manager.state.nodes)
			.filter((n): n is EditorPane => isPane(n))
			.map((p) => p.id)
	}

	/**
	 * Helper: Validate tree integrity
	 * - Every container has exactly 2 children
	 * - Every node (except root) has exactly one parent
	 * - All child references point to existing nodes
	 * - All parent references are correct
	 */
	function validateTreeIntegrity(): boolean {
		const { nodes, rootId } = manager.state
		if (!rootId || !nodes[rootId]) return false

		// Root should have no parent
		if (nodes[rootId].parentId !== null) return false

		for (const node of Object.values(nodes)) {
			if (isContainer(node)) {
				// Container must have exactly 2 children
				if (node.children.length !== 2) return false

				// Both children must exist
				const [child1Id, child2Id] = node.children
				if (!nodes[child1Id] || !nodes[child2Id]) return false

				// Children must reference this container as parent
				if (nodes[child1Id].parentId !== node.id) return false
				if (nodes[child2Id].parentId !== node.id) return false
			}

			// Non-root nodes must have a valid parent
			if (node.id !== rootId) {
				if (!node.parentId || !nodes[node.parentId]) return false
				const parent = nodes[node.parentId]
				if (!parent || !isContainer(parent)) return false
				if (!parent.children.includes(node.id)) return false
			}
		}

		return true
	}

	/**
	 * Property 1: Layout Tree Integrity
	 * For any sequence of split and close operations, the layout tree SHALL remain a valid binary tree
	 * where every Split_Container has exactly two children and every node (except root) has exactly one parent.
	 * **Validates: Requirements 1.3, 3.1, 3.2**
	 */
	it('property: layout tree integrity after random operations', () => {
		fc.assert(
			fc.property(
				fc.record({
					operations: fc.array(
						fc.oneof(
							fc.record({
								type: fc.constant('split' as const),
								direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
							}),
							fc.record({
								type: fc.constant('close' as const),
							})
						),
						{ minLength: 1, maxLength: 20 }
					),
				}),
				(config) => {
					// Reset manager for each test
					manager = createLayoutManager()
					manager.initialize()

					// Verify initial state is valid
					expect(validateTreeIntegrity()).toBe(true)

					// Apply operations
					for (const operation of config.operations) {
						const panesBefore = getAllPaneIds()
						
						if (operation.type === 'split') {
							// Split a random pane
							if (panesBefore.length > 0) {
								const randomPaneIndex = Math.floor(Math.random() * panesBefore.length)
								const paneToSplit = panesBefore[randomPaneIndex]
								if (paneToSplit) {
									manager.splitPane(paneToSplit, operation.direction)
								}
							}
						} else if (operation.type === 'close') {
							// Close a random pane (but not if it's the last one)
							if (panesBefore.length > 1) {
								const randomPaneIndex = Math.floor(Math.random() * panesBefore.length)
								const paneToClose = panesBefore[randomPaneIndex]
								if (paneToClose) {
									manager.closePane(paneToClose)
								}
							}
						}

						// Verify tree integrity after each operation
						expect(validateTreeIntegrity()).toBe(true)

						// Verify we always have at least one pane
						const panesAfter = getAllPaneIds()
						expect(panesAfter.length).toBeGreaterThan(0)

						// Verify root exists and is valid
						expect(manager.state.rootId).toBeDefined()
						expect(manager.state.nodes[manager.state.rootId]).toBeDefined()
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 2: Split Operation Correctness
	 * For any pane that is split, the resulting layout SHALL contain a new SplitContainer
	 * at the original pane's position with the original pane and a new pane as its two children.
	 * **Validates: Requirements 3.2, 4.1, 4.2**
	 */
	it('property: split operation creates correct container structure', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					splitCount: fc.integer({ min: 1, max: 5 }),
				}),
				(config) => {
					// Reset manager for each test
					manager = createLayoutManager()
					manager.initialize()

					const initialPaneId = manager.state.rootId
					const initialPaneCount = getAllPaneIds().length
					expect(initialPaneCount).toBe(1)

					// Perform splits
					for (let i = 0; i < config.splitCount; i++) {
						const panesBefore = getAllPaneIds()
						const paneToSplit = panesBefore[panesBefore.length - 1]
						if (!paneToSplit) continue

						// Split the pane
						const newPaneId = manager.splitPane(paneToSplit, config.direction)

						// Verify new pane was created
						expect(newPaneId).toBeDefined()
						const newPaneNode = manager.state.nodes[newPaneId]
						expect(newPaneNode).toBeDefined()
						if (!newPaneNode) continue
						expect(isPane(newPaneNode)).toBe(true)

						// Verify container was created
						const newPane = newPaneNode as EditorPane
						const containerId = newPane.parentId
						expect(containerId).toBeDefined()
						if (!containerId) continue
						
						const containerNode = manager.state.nodes[containerId]
						expect(containerNode).toBeDefined()
						if (!containerNode) continue
						expect(isContainer(containerNode)).toBe(true)

						// Verify container structure
						const container = containerNode as SplitContainer
						expect(container.children.length).toBe(2)
						expect(container.children).toContain(paneToSplit)
						expect(container.children).toContain(newPaneId)
						expect(container.direction).toBe(config.direction)
						expect(container.sizes).toEqual([0.5, 0.5])

						// Verify original pane's parent was updated
						const originalPaneNode = manager.state.nodes[paneToSplit]
						expect(originalPaneNode).toBeDefined()
						const originalPane = originalPaneNode as EditorPane
						expect(originalPane.parentId).toBe(containerId)

						// Verify tree integrity
						expect(validateTreeIntegrity()).toBe(true)
					}

					// Verify final pane count
					const finalPaneCount = getAllPaneIds().length
					expect(finalPaneCount).toBe(initialPaneCount + config.splitCount)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 3: Close Operation Correctness
	 * For any pane that is closed (except the last pane), the parent SplitContainer
	 * SHALL be removed and the sibling SHALL be promoted to the parent's position.
	 * **Validates: Requirements 6.2, 6.3, 6.4**
	 */
	it('property: close operation promotes sibling correctly', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					splitCount: fc.integer({ min: 1, max: 4 }),
					closeIndex: fc.integer({ min: 0, max: 10 }),
				}),
				(config) => {
					// Reset manager for each test
					manager = createLayoutManager()
					manager.initialize()

					// Create some splits first
					for (let i = 0; i < config.splitCount; i++) {
						const panes = getAllPaneIds()
						const paneToSplit = panes[panes.length - 1]
						if (!paneToSplit) continue
						manager.splitPane(paneToSplit, config.direction)
					}

					const panesBeforeClose = getAllPaneIds()
					expect(panesBeforeClose.length).toBe(config.splitCount + 1)

					// Select a pane to close (not the last one)
					const paneIndexToClose = config.closeIndex % panesBeforeClose.length
					const paneToClose = panesBeforeClose[paneIndexToClose]
					if (!paneToClose) return
					
					const paneBeforeCloseNode = manager.state.nodes[paneToClose]
					if (!paneBeforeCloseNode || !isPane(paneBeforeCloseNode)) return
					
					const paneBeforeClose = paneBeforeCloseNode as EditorPane
					const parentIdBeforeClose = paneBeforeClose.parentId

					// If this is the root pane (no parent), closing should be prevented
					if (!parentIdBeforeClose) {
						manager.closePane(paneToClose)
						// Pane should still exist
						expect(manager.state.nodes[paneToClose]).toBeDefined()
						expect(getAllPaneIds().length).toBe(panesBeforeClose.length)
						return
					}

					// Get sibling before close
					const parentBeforeCloseNode = manager.state.nodes[parentIdBeforeClose]
					if (!parentBeforeCloseNode || !isContainer(parentBeforeCloseNode)) return
					
					const parentBeforeClose = parentBeforeCloseNode as SplitContainer
					const siblingId = parentBeforeClose.children.find((id) => id !== paneToClose)
					if (!siblingId) return
					
					const grandparentId = parentBeforeClose.parentId

					// Close the pane
					manager.closePane(paneToClose)

					// Verify pane was removed
					expect(manager.state.nodes[paneToClose]).toBeUndefined()

					// Verify parent container was removed
					expect(manager.state.nodes[parentIdBeforeClose]).toBeUndefined()

					// Verify sibling was promoted
					const sibling = manager.state.nodes[siblingId]
					expect(sibling).toBeDefined()
					if (!sibling) return
					
					expect(sibling.parentId).toBe(grandparentId)

					// If grandparent exists, verify it now references sibling
					if (grandparentId) {
						const grandparentNode = manager.state.nodes[grandparentId]
						if (grandparentNode && isContainer(grandparentNode)) {
							const grandparent = grandparentNode as SplitContainer
							expect(grandparent.children).toContain(siblingId)
						}
					} else {
						// Sibling should be the new root
						expect(manager.state.rootId).toBe(siblingId)
					}

					// Verify tree integrity
					expect(validateTreeIntegrity()).toBe(true)

					// Verify pane count decreased by 1
					const panesAfterClose = getAllPaneIds()
					expect(panesAfterClose.length).toBe(panesBeforeClose.length - 1)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Additional property: Cannot close the last pane
	 * **Validates: Requirements 6.3**
	 */
	it('property: cannot close the last remaining pane', () => {
		fc.assert(
			fc.property(
				fc.constant(null),
				() => {
					// Reset manager
					manager = createLayoutManager()
					manager.initialize()

					const panes = getAllPaneIds()
					expect(panes.length).toBe(1)

					const lastPaneId = panes[0]
					if (!lastPaneId) return

					// Try to close the last pane
					manager.closePane(lastPaneId)

					// Pane should still exist
					expect(manager.state.nodes[lastPaneId]).toBeDefined()
					expect(getAllPaneIds().length).toBe(1)
					expect(manager.state.rootId).toBe(lastPaneId)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Additional property: Focus updates when focused pane is closed
	 * **Validates: Requirements 6.4**
	 */
	it('property: focus updates when focused pane is closed', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
				}),
				(config) => {
					// Reset manager
					manager = createLayoutManager()
					manager.initialize()

					const initialPaneId = manager.state.rootId

					// Split to create two panes
					const newPaneId = manager.splitPane(initialPaneId, config.direction)

					// Set focus to the new pane
					manager.setFocusedPane(newPaneId)
					expect(manager.state.focusedPaneId).toBe(newPaneId)

					// Close the focused pane
					manager.closePane(newPaneId)

					// Focus should have moved to the sibling (original pane)
					expect(manager.state.focusedPaneId).toBe(initialPaneId)
					expect(manager.state.nodes[manager.state.focusedPaneId!]).toBeDefined()
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 11: Tab Close Cascading
	 * For any pane, when the last tab is closed, the pane itself SHALL be closed.
	 * **Validates: Requirements 7.7**
	 */
	it('property: closing last tab closes the pane', () => {
		fc.assert(
			fc.property(
				fc.record({
					direction: fc.constantFrom<SplitDirection>('horizontal', 'vertical'),
					tabCount: fc.integer({ min: 1, max: 5 }),
				}),
				(config) => {
					// Reset manager
					manager = createLayoutManager()
					manager.initialize()

					const initialPaneId = manager.state.rootId

					// Split to create two panes so we can close one
					const newPaneId = manager.splitPane(initialPaneId, config.direction)

					// Add tabs to the new pane
					const tabIds: string[] = []
					for (let i = 0; i < config.tabCount; i++) {
						const tabId = manager.openTab(newPaneId, {
							type: 'file',
							filePath: `/test/file${i}.txt`,
						})
						tabIds.push(tabId)
					}

					// Verify tabs were created
					const paneBeforeClose = manager.state.nodes[newPaneId] as EditorPane
					expect(paneBeforeClose).toBeDefined()
					expect(paneBeforeClose.tabs.length).toBe(config.tabCount)
					expect(paneBeforeClose.activeTabId).toBe(tabIds[tabIds.length - 1])

					// Close all tabs except the last one
					for (let i = 0; i < tabIds.length - 1; i++) {
						manager.closeTab(newPaneId, tabIds[i])
						
						// Pane should still exist
						const paneAfterPartialClose = manager.state.nodes[newPaneId] as EditorPane
						expect(paneAfterPartialClose).toBeDefined()
						expect(paneAfterPartialClose.tabs.length).toBe(config.tabCount - i - 1)
					}

					// Close the last tab
					const lastTabId = tabIds[tabIds.length - 1]
					manager.closeTab(newPaneId, lastTabId)

					// Pane should be closed (removed from nodes)
					expect(manager.state.nodes[newPaneId]).toBeUndefined()

					// Tree integrity should be maintained
					expect(validateTreeIntegrity()).toBe(true)

					// Should have one less pane
					const remainingPanes = getAllPaneIds()
					expect(remainingPanes.length).toBe(1)
					expect(remainingPanes[0]).toBe(initialPaneId)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property 12: Active Tab Consistency
	 * For any pane with tabs, closing the active tab SHALL result in another tab becoming active,
	 * with preference for the next tab or previous if at end.
	 * **Validates: Requirements 7.6**
	 */
	it('property: closing active tab activates next tab', () => {
		fc.assert(
			fc.property(
				fc.record({
					tabCount: fc.integer({ min: 2, max: 8 }),
					activeTabIndex: fc.integer({ min: 0, max: 7 }),
				}),
				(config) => {
					// Reset manager
					manager = createLayoutManager()
					manager.initialize()

					const paneId = manager.state.rootId

					// Add multiple tabs
					const tabIds: string[] = []
					for (let i = 0; i < config.tabCount; i++) {
						const tabId = manager.openTab(paneId, {
							type: 'file',
							filePath: `/test/file${i}.txt`,
						})
						tabIds.push(tabId)
					}

					// Set a specific tab as active
					const activeIndex = config.activeTabIndex % config.tabCount
					const activeTabId = tabIds[activeIndex]
					manager.setActiveTab(paneId, activeTabId)

					// Verify setup
					const paneBeforeClose = manager.state.nodes[paneId] as EditorPane
					expect(paneBeforeClose.activeTabId).toBe(activeTabId)
					expect(paneBeforeClose.tabs.length).toBe(config.tabCount)

					// Close the active tab
					manager.closeTab(paneId, activeTabId)

					// Verify pane still exists (since we have more than 1 tab)
					const paneAfterClose = manager.state.nodes[paneId] as EditorPane
					expect(paneAfterClose).toBeDefined()
					expect(paneAfterClose.tabs.length).toBe(config.tabCount - 1)

					// Verify a new tab is active
					expect(paneAfterClose.activeTabId).not.toBeNull()
					expect(paneAfterClose.activeTabId).not.toBe(activeTabId)

					// Verify the active tab exists in the remaining tabs
					const activeTab = paneAfterClose.tabs.find(t => t.id === paneAfterClose.activeTabId)
					expect(activeTab).toBeDefined()

					// Verify the closed tab is no longer in the tabs array
					const closedTab = paneAfterClose.tabs.find(t => t.id === activeTabId)
					expect(closedTab).toBeUndefined()

					// Tree integrity should be maintained
					expect(validateTreeIntegrity()).toBe(true)
				}
			),
			{ numRuns: 100 }
		)
	})
})
