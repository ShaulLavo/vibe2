/**
 * TabBar Component
 *
 * Renders horizontal list of tabs with horizontal scroll support for overflow.
 * Requirements: 7.8, 15.6
 */

import { For } from 'solid-js'
import { TabItem } from './TabItem'
import type { EditorPane } from '../types'

export interface TabBarProps {
	pane: EditorPane
}

export function TabBar(props: TabBarProps) {
	return (
		<div class="tab-bar flex h-9 shrink-0 overflow-x-auto border-b border-border bg-surface-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-surface-3">
			<For each={props.pane.tabs}>
				{(tab) => (
					<TabItem
						tab={tab}
						paneId={props.pane.id}
						isActive={props.pane.activeTabId === tab.id}
					/>
				)}
			</For>
		</div>
	)
}