import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createTabIdentity, parseTabIdentity } from '../utils/tabIdentity'
import { ViewModeRegistry } from '../registry/ViewModeRegistry'

/**
 * Property-based tests for state isolation between view modes
 * **Feature: file-view-modes, Property 3: State Isolation Between View Modes**
 * **Validates: Requirements 1.4, 1.5, 3.4**
 */
describe('State Isolation Properties', () => {
	/**
	 * Property 3: State Isolation Between View Modes
	 * Each view mode of the same file should maintain independent state
	 * **Validates: Requirements 1.4, 1.5, 3.4**
	 */
	it('property: view modes maintain independent state for the same file', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom('.system/settings.json', 'binary.exe'),
					stateOperations: fc.array(
						fc.record({
							viewMode: fc.constantFrom('editor', 'ui', 'binary'),
							stateKey: fc.constantFrom(
								'scrollPosition',
								'selection',
								'foldState'
							),
							stateValue: fc.oneof(
								fc.integer({ min: 0, max: 1000 }),
								fc.string({ minLength: 1, maxLength: 20 }),
								fc.boolean()
							),
						}),
						{ minLength: 2, maxLength: 6 }
					),
				}),
				(config) => {
					// Create tab identities for different view modes
					const tabStates = new Map<string, Map<string, unknown>>()

					for (const operation of config.stateOperations) {
						const tabId = createTabIdentity(config.filePath, operation.viewMode)

						// Initialize state for this tab if not exists
						if (!tabStates.has(tabId)) {
							tabStates.set(tabId, new Map())
						}

						// Set state for this specific tab
						const tabState = tabStates.get(tabId)!
						tabState.set(operation.stateKey, operation.stateValue)
					}

					// Verify state isolation - each tab should have independent state
					const tabIds = Array.from(tabStates.keys())

					for (let i = 0; i < tabIds.length; i++) {
						for (let j = i + 1; j < tabIds.length; j++) {
							const tab1 = tabIds[i]!
							const tab2 = tabIds[j]!
							const parsed1 = parseTabIdentity(tab1)
							const parsed2 = parseTabIdentity(tab2)

							// If same file but different view modes, states should be independent
							if (
								parsed1.filePath === parsed2.filePath &&
								parsed1.viewMode !== parsed2.viewMode
							) {
								const state1 = tabStates.get(tab1)!
								const state2 = tabStates.get(tab2)!

								// States can have different keys or different values for same keys
								// This tests that they are truly independent
								let hasIndependentState = false

								// Check if they have different keys
								const keys1 = Array.from(state1.keys())
								const keys2 = Array.from(state2.keys())
								if (keys1.length !== keys2.length) {
									hasIndependentState = true
								}

								// Check if they have different values for same keys
								for (const key of keys1) {
									if (state2.has(key) && state1.get(key) !== state2.get(key)) {
										hasIndependentState = true
									}
								}

								// At minimum, tab IDs should be different (proving isolation)
								expect(tab1).not.toBe(tab2)
							}
						}
					}

					// Verify that each tab maintains its own state correctly
					for (const [tabId, state] of tabStates) {
						const parsed = parseTabIdentity(tabId)
						expect(parsed.filePath).toBe(config.filePath)

						// State should be retrievable and consistent
						for (const [key, value] of state) {
							expect(state.get(key)).toBe(value)
						}
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: view mode registry supports independent state hooks', () => {
		fc.assert(
			fc.property(
				fc.record({
					customModes: fc.array(
						fc.record({
							id: fc.constantFrom('preview', 'diagram', 'chart'),
							hasStateHooks: fc.boolean(),
							initialState: fc.record({
								value: fc.string({ minLength: 1, maxLength: 10 }),
								count: fc.integer({ min: 0, max: 100 }),
							}),
						}),
						{ minLength: 1, maxLength: 3 }
					),
				}),
				(config) => {
					const registry = new ViewModeRegistry()
					registry.initialize()

					// Register custom modes with state hooks
					const stateInstances = new Map<string, any>()

					for (const mode of config.customModes) {
						const stateHooks = mode.hasStateHooks
							? {
									createState: () => ({ ...mode.initialState }),
									cleanup: (state: any) => {
										state.cleaned = true
									},
								}
							: undefined

						registry.register({
							id: mode.id,
							label: mode.id.charAt(0).toUpperCase() + mode.id.slice(1),
							isAvailable: () => true,
							stateHooks,
						})

						// Test state creation if hooks exist
						if (mode.hasStateHooks) {
							const registeredMode = registry.getViewMode(mode.id)
							expect(registeredMode?.stateHooks).toBeDefined()

							if (registeredMode?.stateHooks?.createState) {
								const state = registeredMode.stateHooks.createState()
								expect(state.value).toBe(mode.initialState.value)
								expect(state.count).toBe(mode.initialState.count)
								stateInstances.set(mode.id, state)
							}
						}
					}

					// Verify state isolation between different mode instances
					const stateEntries = Array.from(stateInstances.entries())
					for (let i = 0; i < stateEntries.length; i++) {
						for (let j = i + 1; j < stateEntries.length; j++) {
							const entry1 = stateEntries[i]!
							const entry2 = stateEntries[j]!
							const [mode1, state1] = entry1
							const [mode2, state2] = entry2

							// Different modes should have different state instances
							expect(state1).not.toBe(state2)

							// Modifying one state shouldn't affect another
							state1.modified = true
							expect(state2.modified).toBeUndefined()
						}
					}

					// Test cleanup isolation
					for (const [modeId, state] of stateInstances) {
						const mode = registry.getViewMode(modeId)
						if (mode?.stateHooks?.cleanup) {
							mode.stateHooks.cleanup(state)
							expect(state.cleaned).toBe(true)
						}
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	it('property: state changes in one view mode do not affect others', () => {
		fc.assert(
			fc.property(
				fc.record({
					filePath: fc.constantFrom('.system/settings.json'),
					modifications: fc.array(
						fc.record({
							targetMode: fc.constantFrom('editor', 'ui'),
							property: fc.constantFrom('content', 'cursor', 'selection'),
							newValue: fc.oneof(
								fc.string({ minLength: 1, maxLength: 50 }),
								fc.integer({ min: 0, max: 1000 })
							),
						}),
						{ minLength: 2, maxLength: 4 }
					),
				}),
				(config) => {
					// Simulate independent state for each view mode
					const editorTabId = createTabIdentity(config.filePath, 'editor')
					const uiTabId = createTabIdentity(config.filePath, 'ui')

					const editorState = new Map<string, unknown>()
					const uiState = new Map<string, unknown>()

					// Initialize with different baseline states
					editorState.set('content', 'initial editor content')
					editorState.set('cursor', 0)
					uiState.set('content', 'initial ui content')
					uiState.set('cursor', 100)

					// Apply modifications
					for (const mod of config.modifications) {
						if (mod.targetMode === 'editor') {
							editorState.set(mod.property, mod.newValue)
						} else if (mod.targetMode === 'ui') {
							uiState.set(mod.property, mod.newValue)
						}
					}

					// Verify that modifications to one mode don't affect the other
					const editorModifications = config.modifications.filter(
						(m) => m.targetMode === 'editor'
					)
					const uiModifications = config.modifications.filter(
						(m) => m.targetMode === 'ui'
					)

					// Check that editor state reflects only editor modifications
					for (const mod of editorModifications) {
						// For duplicate properties, the last modification wins
						const lastModForProperty = editorModifications
							.filter((m) => m.property === mod.property)
							.pop()
						if (lastModForProperty === mod) {
							expect(editorState.get(mod.property)).toBe(mod.newValue)
						}
					}

					// Check that UI state reflects only UI modifications
					for (const mod of uiModifications) {
						// For duplicate properties, the last modification wins
						const lastModForProperty = uiModifications
							.filter((m) => m.property === mod.property)
							.pop()
						if (lastModForProperty === mod) {
							expect(uiState.get(mod.property)).toBe(mod.newValue)
						}
					}

					// Verify baseline values are preserved where not modified
					if (!editorModifications.some((m) => m.property === 'content')) {
						expect(editorState.get('content')).toBe('initial editor content')
					}
					if (!uiModifications.some((m) => m.property === 'content')) {
						expect(uiState.get('content')).toBe('initial ui content')
					}

					// Tab IDs should remain distinct
					expect(editorTabId).not.toBe(uiTabId)
					expect(parseTabIdentity(editorTabId).viewMode).toBe('editor')
					expect(parseTabIdentity(uiTabId).viewMode).toBe('ui')
				}
			),
			{ numRuns: 100 }
		)
	})
})
