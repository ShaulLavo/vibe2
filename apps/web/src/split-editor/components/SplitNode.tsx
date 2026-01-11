/**
 * SplitNode Recursive Renderer
 *
 * Recursively renders the layout tree, switching between SplitContainer
 * and EditorPaneSlot based on node type. Handles unlimited nesting depth.
 */

import { createMemo, Match, Switch } from 'solid-js'
import { SplitContainer } from './SplitContainer'
import { EditorPaneSlot } from './EditorPaneSlot'
import { useLayoutManager } from './SplitEditor'
import type { SplitContainer as SplitContainerType, EditorPane } from '../types'
import { isContainer, isPane } from '../types'

export interface SplitNodeProps {
	/** The ID of the node to render */
	nodeId: string
}

/** Recursive node renderer - switches between container and pane */
export function SplitNode(props: SplitNodeProps) {
	const layout = useLayoutManager()

	const node = createMemo(() => layout.state.nodes[props.nodeId])

	const containerNode = createMemo(() => {
		const n = node()
		return n && isContainer(n) ? (n as SplitContainerType) : null
	})

	const paneNode = createMemo(() => {
		const n = node()
		return n && isPane(n) ? (n as EditorPane) : null
	})

	return (
		<Switch>
			<Match when={containerNode()}>
				{(container) => <SplitContainer node={container()} />}
			</Match>
			<Match when={paneNode()}>
				{(pane) => <EditorPaneSlot pane={pane()} />}
			</Match>
		</Switch>
	)
}
