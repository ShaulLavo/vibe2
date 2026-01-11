/* eslint-disable solid/reactivity */
/**
 * Persisted Layout Manager
 *
 * Wraps the base layout manager with auto-persistence using makePersisted and dualStorage.
 * Automatically saves layout changes with debouncing and restores on initialization.
 */

import { createEffect, createSignal, onCleanup } from 'solid-js'
import { makePersisted } from '@solid-primitives/storage'
import { dualStorage } from '@repo/utils/DualStorage'
import { createLayoutManager, type LayoutManager } from './createLayoutManager'
import type { SerializedLayout } from './types'

const PERSISTENCE_KEY = 'split-editor-layout'
const DEBOUNCE_MS = 500

export interface PersistedLayoutManager extends LayoutManager {
	/**
	 * Clear persisted layout from storage.
	 * Useful for testing or resetting the layout.
	 */
	clearPersistedLayout(): void
}

export function createPersistedLayoutManager(): PersistedLayoutManager {
	const baseManager = createLayoutManager()

	// Create persisted signal for layout storage
	const layoutSignal = createSignal<SerializedLayout | null>(null)
	const [persistedLayout, setPersistedLayout] = makePersisted(layoutSignal, {
		storage: dualStorage,
		name: PERSISTENCE_KEY,
		serialize: JSON.stringify,
		deserialize: JSON.parse,
	})

	// Debounce timeout ref
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null

	// Debounced persistence function
	function persistLayout(): void {
		if (debounceTimeout) {
			clearTimeout(debounceTimeout)
		}

		debounceTimeout = setTimeout(() => {
			const layout = baseManager.getLayoutTree()
			setPersistedLayout(layout)
			debounceTimeout = null
		}, DEBOUNCE_MS)
	}

	// Override initialize to restore from storage first
	const originalInitialize = baseManager.initialize
	function initialize(): void {
		const saved = persistedLayout()

		if (saved && isValidLayout(saved)) {
			try {
				baseManager.restoreLayout(saved)
			} catch (error) {
				console.error('Failed to restore layout, initializing fresh:', error)
				originalInitialize()
			}
		} else {
			originalInitialize()
		}

		// Set up auto-persistence effect after initialization
		// This effect will run whenever the layout state changes
		createEffect(() => {
			// Access state properties to track them reactively
			const rootId = baseManager.state.rootId
			const nodes = baseManager.state.nodes
			// Track these properties without using their values
			void baseManager.state.focusedPaneId
			void baseManager.state.scrollSyncGroups

			// Only persist if we have a valid layout (rootId exists)
			if (rootId && Object.keys(nodes).length > 0) {
				persistLayout()
			}
		})

		// Clean up debounce timeout on cleanup
		onCleanup(() => {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout)
				debounceTimeout = null
			}
		})
	}

	function clearPersistedLayout(): void {
		setPersistedLayout(null)
	}

	return {
		...baseManager,
		initialize,
		clearPersistedLayout,
	}
}

/**
 * Validate that a serialized layout has the minimum required structure.
 * This helps handle cases where stored data might be corrupted or from an older version.
 */
function isValidLayout(layout: SerializedLayout): boolean {
	if (!layout || typeof layout !== 'object') return false
	if (layout.version !== 1) return false
	if (!layout.rootId || typeof layout.rootId !== 'string') return false
	if (!Array.isArray(layout.nodes) || layout.nodes.length === 0) return false

	// Verify the root node exists in the nodes array
	const rootNode = layout.nodes.find((n) => n.id === layout.rootId)
	if (!rootNode) return false

	return true
}
