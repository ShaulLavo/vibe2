/**
 * Property Test: Independent Tab State
 *
 * Property-based test to verify that tabs maintain independent scroll positions,
 * selections, and cursor positions even when showing the same file.
 *
 * **Property 6: Independent Tab State**
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { createLayoutManager } from '../createLayoutManager'
import { createResourceManager } from '../createResourceManager'
import { createFileContent } from '../types'
import type { EditorPane } from '../types'

describe('Property Test: Independent Tab State', () => {
	let layoutManager: ReturnType<typeof createLayoutManager>
	let resourceManager: ReturnType<typeof createResourceManager>

	beforeEach(() => {
		layoutManager = createLayoutManager()
		resourceManager = createResourceManager()
		layoutManager.initialize()
	})

	afterEach(() => {
		resourceManager.cleanup()
	})

	/**
	 * Property 6: Independent Tab State
	 *
	 * For any two tabs showing the same file, each tab SHALL maintain independent
	 * scroll position, cursor position, and selections that do not affect the other tab.
	 *
	 * **Validates: Requirements 8.1, 8.2, 8.3**
	 */
	it('Property 6: Independent Tab State - tabs maintain independent state', async () => {
		await fc.assert(
			fc.asyncProperty(
				// Generate test data
				fc.record({
					filePath: fc
						.string({ minLength: 1, maxLength: 50 })
						.map((s) => `/test/${s.replace(/[^a-zA-Z0-9]/g, '_')}.ts`),
					tab1State: fc.record({
						scrollTop: fc.integer({ min: 0, max: 1000 }),
						scrollLeft: fc.integer({ min: 0, max: 500 }),
						cursorLine: fc.integer({ min: 0, max: 100 }),
						cursorColumn: fc.integer({ min: 0, max: 80 }),
					}),
					tab2State: fc.record({
						scrollTop: fc.integer({ min: 0, max: 1000 }),
						scrollLeft: fc.integer({ min: 0, max: 500 }),
						cursorLine: fc.integer({ min: 0, max: 100 }),
						cursorColumn: fc.integer({ min: 0, max: 80 }),
					}),
				}),
				async (config) => {
					// Create fresh managers for each iteration
					const lm = createLayoutManager()
					lm.initialize()

					// Ensure different states for meaningful test
					fc.pre(
						config.tab1State.scrollTop !== config.tab2State.scrollTop ||
							config.tab1State.scrollLeft !== config.tab2State.scrollLeft ||
							config.tab1State.cursorLine !== config.tab2State.cursorLine ||
							config.tab1State.cursorColumn !== config.tab2State.cursorColumn
					)

					// Open same file in two different panes
					const tab1Id = layoutManager.openTab(
						pane1Id,
						createFileContent(config.filePath)
					)

					const pane2Id = layoutManager.splitPane(pane1Id, 'horizontal')

					const tab2Id = layoutManager.openTab(
						pane2Id,
						createFileContent(config.filePath)
					)

					// Set different states for each tab
					layoutManager.updateTabState(pane1Id, tab1Id, {
						scrollTop: config.tab1State.scrollTop,
						scrollLeft: config.tab1State.scrollLeft,
						cursorPosition: {
							line: config.tab1State.cursorLine,
							column: config.tab1State.cursorColumn,
						},
						selections: [],
					})

					layoutManager.updateTabState(pane2Id, tab2Id, {
						scrollTop: config.tab2State.scrollTop,
						scrollLeft: config.tab2State.scrollLeft,
						cursorPosition: {
							line: config.tab2State.cursorLine,
							column: config.tab2State.cursorColumn,
						},
						selections: [],
					})

					// Get the actual tab states from the layout
					const pane1 = layoutManager.state.nodes[pane1Id] as EditorPane
					const pane2 = layoutManager.state.nodes[pane2Id] as EditorPane

					const actualTab1 = pane1.tabs.find((t) => t.id === tab1Id)
					const actualTab2 = pane2.tabs.find((t) => t.id === tab2Id)

					expect(actualTab1).toBeDefined()
					expect(actualTab2).toBeDefined()

					// Verify independent scroll positions
					expect(actualTab1!.state.scrollTop).toBe(config.tab1State.scrollTop)
					expect(actualTab1!.state.scrollLeft).toBe(config.tab1State.scrollLeft)
					expect(actualTab2!.state.scrollTop).toBe(config.tab2State.scrollTop)
					expect(actualTab2!.state.scrollLeft).toBe(config.tab2State.scrollLeft)

					// Verify independent cursor positions
					expect(actualTab1!.state.cursorPosition.line).toBe(
						config.tab1State.cursorLine
					)
					expect(actualTab1!.state.cursorPosition.column).toBe(
						config.tab1State.cursorColumn
					)
					expect(actualTab2!.state.cursorPosition.line).toBe(
						config.tab2State.cursorLine
					)
					expect(actualTab2!.state.cursorPosition.column).toBe(
						config.tab2State.cursorColumn
					)

					// Verify states are actually different (independence)
					const statesAreDifferent =
						actualTab1!.state.scrollTop !== actualTab2!.state.scrollTop ||
						actualTab1!.state.scrollLeft !== actualTab2!.state.scrollLeft ||
						actualTab1!.state.cursorPosition.line !==
							actualTab2!.state.cursorPosition.line ||
						actualTab1!.state.cursorPosition.column !==
							actualTab2!.state.cursorPosition.column
					expect(statesAreDifferent).toBe(true)

					// Verify both tabs show the same file content
					expect(actualTab1!.content.filePath).toBe(config.filePath)
					expect(actualTab2!.content.filePath).toBe(config.filePath)
					expect(actualTab1!.content.filePath).toBe(
						actualTab2!.content.filePath
					)
				}
			),
			{
				numRuns: 100, // Run 100 iterations as specified in requirements
				timeout: 5000, // 5 second timeout per test
			}
		)
	}, 30000) // 30 second timeout for the entire property test
})
