/**
 * Split Editor Layout Types
 *
 * Defines the binary tree structure for recursive split layouts.
 * Each node is either a SplitContainer (with two children) or an EditorPane (leaf).
 * Each EditorPane can hold multiple tabs (VS Code editor group model).
 */

/** Unique identifier for nodes in the layout tree */
export type NodeId = string

/** Unique identifier for tabs */
export type TabId = string

/** Direction of a split */
export type SplitDirection = 'horizontal' | 'vertical'

/** Position in the editor */
export interface Position {
	line: number
	column: number
}

/** Text selection range */
export interface Selection {
	start: Position
	end: Position
}

/** View settings per pane (shared across all tabs in the pane) */
export interface ViewSettings {
	showLineNumbers: boolean
	showMinimap: boolean
	wordWrap: boolean
	fontSize: number
}

/** Diff data for diff tabs */
export interface DiffData {
	originalPath: string
	modifiedPath: string
	originalContent?: string
	modifiedContent?: string
}

/** Content displayed in a tab */
export interface TabContent {
	type: 'file' | 'diff' | 'empty' | 'custom'
	filePath?: string
	diffData?: DiffData
	customComponent?: string
}

/** Per-tab state (independent per tab) */
export interface TabState {
	scrollTop: number
	scrollLeft: number
	selections: Selection[]
	cursorPosition: Position
}

/** A single tab within a pane */
export interface Tab {
	id: TabId
	content: TabContent
	state: TabState
	isDirty: boolean
}

/** Base node in the layout tree */
interface BaseNode {
	id: NodeId
	parentId: NodeId | null
}

/** A split container with two children */
export interface SplitContainer extends BaseNode {
	type: 'container'
	direction: SplitDirection
	sizes: [number, number]
	children: [NodeId, NodeId]
}

/** An editor pane (leaf node) - contains multiple tabs */
export interface EditorPane extends BaseNode {
	type: 'pane'
	tabs: Tab[]
	activeTabId: TabId | null
	viewSettings: ViewSettings
}

/** Union type for all nodes */
export type SplitNode = SplitContainer | EditorPane

/** Scroll sync mode */
export type ScrollSyncMode = 'line' | 'percentage'

/** Scroll sync group - links specific tabs */
export interface ScrollSyncGroup {
	id: string
	tabIds: TabId[]
	mode: ScrollSyncMode
}

/** Complete layout state */
export interface LayoutState {
	rootId: NodeId
	nodes: Record<NodeId, SplitNode>
	focusedPaneId: NodeId | null
	scrollSyncGroups: ScrollSyncGroup[]
}

// ============================================================================
// Serialization Types (for persistence)
// ============================================================================

/** Serialized tab for persistence */
export interface SerializedTab {
	id: TabId
	content: TabContent
	state: TabState
	isDirty: boolean
}

/** Serialized node for persistence */
export interface SerializedNode {
	id: NodeId
	parentId: NodeId | null
	type: 'container' | 'pane'
	// Container fields
	direction?: SplitDirection
	sizes?: [number, number]
	children?: [NodeId, NodeId]
	// Pane fields
	tabs?: SerializedTab[]
	activeTabId?: TabId | null
	viewSettings?: ViewSettings
}

/** Serialized layout for persistence */
export interface SerializedLayout {
	version: 1
	rootId: NodeId
	nodes: SerializedNode[]
	focusedPaneId: NodeId | null
	scrollSyncGroups: ScrollSyncGroup[]
}

// ============================================================================
// Type Guards
// ============================================================================

export function isContainer(node: SplitNode): node is SplitContainer {
	return node.type === 'container'
}

export function isPane(node: SplitNode): node is EditorPane {
	return node.type === 'pane'
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultViewSettings(): ViewSettings {
	return {
		showLineNumbers: true,
		showMinimap: false,
		wordWrap: false,
		fontSize: 14,
	}
}

export function createDefaultTabState(): TabState {
	return {
		scrollTop: 0,
		scrollLeft: 0,
		selections: [],
		cursorPosition: { line: 0, column: 0 },
	}
}

export function createEmptyContent(): TabContent {
	return { type: 'empty' }
}

export function createFileContent(filePath: string): TabContent {
	return { type: 'file', filePath }
}

export function createDiffContent(diffData: DiffData): TabContent {
	return { type: 'diff', diffData }
}

export function createTab(content: TabContent): Tab {
	return {
		id: crypto.randomUUID(),
		content,
		state: createDefaultTabState(),
		isDirty: false,
	}
}
