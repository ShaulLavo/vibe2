/**
 * Split Editor Module
 *
 * Recursive split editor system with Layout Manager, Resource Manager, and UI components.
 */

export * from './types'
export { createLayoutManager, type LayoutManager } from './createLayoutManager'
export {
	createPersistedLayoutManager,
	type PersistedLayoutManager,
} from './createPersistedLayoutManager'
export {
	createResourceManager,
	type ResourceManager,
	type SharedBuffer,
	type HighlightState,
	type TextEdit,
} from './createResourceManager'

// UI Components
export {
	SplitEditor,
	useLayoutManager,
	useResourceManager,
	SplitNode,
	SplitContainer,
	EditorPaneSlot,
	PanePortals,
} from './components'
export type {
	SplitEditorProps,
	SplitNodeProps,
	SplitContainerProps,
	EditorPaneSlotProps,
	PanePortalsProps,
} from './components'
