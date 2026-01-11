/**
 * EditorPaneSlot Component
 *
 * Renders the slot where pane portal content will be mounted.
 * Includes TabBar for tab management and handles focus.
 */

import { createMemo, Show } from 'solid-js'
import { useLayoutManager } from './SplitEditor'
import { TabBar } from './TabBar'
import type { EditorPane } from '../types'

export interface EditorPaneSlotProps {
	pane: EditorPane
}

export function EditorPaneSlot(props: EditorPaneSlotProps) {
	const layout = useLayoutManager()

	const isFocused = createMemo(
		() => layout.state.focusedPaneId === props.pane.id
	)

	const handleClick = () => {
		layout.setFocusedPane(props.pane.id)
	}

	return (
		<div
			class="editor-pane-slot relative flex h-full w-full flex-col"
			classList={{
				'ring-2 ring-primary ring-inset': isFocused(),
			}}
			onClick={handleClick}
			data-pane-id={props.pane.id}
			style={{ contain: 'strict' }}
		>
			<Show when={props.pane.tabs.length > 0}>
				<TabBar pane={props.pane} />
			</Show>
			<div
				id={`pane-target-${props.pane.id}`}
				class="min-h-0 flex-1 overflow-hidden"
			/>
		</div>
	)
}
