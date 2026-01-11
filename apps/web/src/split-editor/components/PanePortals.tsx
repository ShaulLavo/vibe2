/**
 * PanePortals Component
 *
 * Renders active tab content for all panes via SolidJS portals.
 * This enables future drag-and-drop functionality where tabs
 * can be moved without remounting their content.
 *
 * The pane is agnostic to content types - consumers provide a single
 * renderTabContent function that handles all tab types.
 */

import { createMemo, For, Show, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useLayoutManager } from './SplitEditor'
import { TabContent } from './TabContent'
import type { EditorPane, Tab } from '../types'
import { isPane } from '../types'

export interface PanePortalsProps {
	/**
	 * Custom renderer for tab content. If not provided, uses default TabContent component.
	 * The pane is agnostic to content types - consumers handle rendering based on tab.content.type.
	 */
	renderTabContent?: (tab: Tab, pane: EditorPane) => JSX.Element
}

export function PanePortals(props: PanePortalsProps) {
	const layout = useLayoutManager()

	return (
		<For each={layout.paneIds()}>
			{(paneId) => (
				<PanePortal paneId={paneId} renderTabContent={props.renderTabContent} />
			)}
		</For>
	)
}

interface PanePortalProps {
	paneId: string
	renderTabContent?: (tab: Tab, pane: EditorPane) => JSX.Element
}

function PanePortal(props: PanePortalProps) {
	const layout = useLayoutManager()

	const pane = createMemo(() => {
		const node = layout.state.nodes[props.paneId]
		return node && isPane(node) ? node : null
	})

	const activeTab = createMemo(() => {
		const p = pane()
		if (!p || !p.activeTabId) return null
		return p.tabs.find((t) => t.id === p.activeTabId) ?? null
	})

	const target = createMemo(() =>
		document.getElementById(`pane-target-${props.paneId}`)
	)

	return (
		<Show when={target() && pane()}>
			<Portal mount={target()!}>
				<div class="pane-content h-full w-full" data-pane-id={props.paneId}>
					<Show when={activeTab()} fallback={<EmptyPaneContent />}>
						{(tab) => (
							<Show
								when={props.renderTabContent}
								fallback={<TabContent tab={tab()} pane={pane()!} />}
							>
								{(render) => render()(tab(), pane()!)}
							</Show>
						)}
					</Show>
				</div>
			</Portal>
		</Show>
	)
}

function EmptyPaneContent() {
	return (
		<div
			class="flex h-full w-full items-center justify-center bg-background/50 text-muted-foreground"
			data-testid="empty-pane-content"
		>
			<span class="text-sm">No tabs open</span>
		</div>
	)
}
