/**
 * TabContent Switcher Component
 *
 * Switches on content type (file, diff, empty, custom) and renders
 * the appropriate placeholder component. Used by PanePortal as a
 * default when no custom renderTabContent is provided.
 *
 * For actual content rendering (e.g., real file editor, diff view),
 * consumers should provide their own renderTabContent to PanePortals.
 *
 * Requirements: 7.2
 */

import { createMemo, Match, Switch } from 'solid-js'
import type { EditorPane, Tab, TabContent as TabContentType } from '../types'

export interface TabContentProps {
	tab: Tab
	pane: EditorPane
}

/**
 * TabContent - Default placeholder renderer that switches on content type
 *
 * This component provides placeholder content for each tab type.
 * For actual editors, consumers should use renderTabContent prop on PanePortals/SplitEditor.
 */
export function TabContent(props: TabContentProps) {
	return (
		<Switch fallback={<EmptyContent />}>
			<Match when={props.tab.content.type === 'file'}>
				<FileContentPlaceholder tab={props.tab} />
			</Match>
			<Match when={props.tab.content.type === 'diff'}>
				<DiffContentPlaceholder tab={props.tab} />
			</Match>
			<Match when={props.tab.content.type === 'empty'}>
				<EmptyContent />
			</Match>
			<Match when={props.tab.content.type === 'custom'}>
				<CustomContentPlaceholder tab={props.tab} />
			</Match>
		</Switch>
	)
}

/**
 * Placeholder for file content
 */
function FileContentPlaceholder(props: { tab: Tab }) {
	const fileName = createMemo(() => {
		const filePath = props.tab.content.filePath
		if (!filePath) return 'Untitled'
		return filePath.split('/').pop() ?? 'Untitled'
	})

	return (
		<div
			class="flex h-full w-full flex-col items-center justify-center bg-background/50 text-muted-foreground"
			data-testid="file-content-placeholder"
			data-file-path={props.tab.content.filePath}
		>
			<div class="mb-2 text-4xl opacity-20">📄</div>
			<span class="text-sm font-medium">{fileName()}</span>
			<span class="mt-1 text-xs opacity-60">File content placeholder</span>
		</div>
	)
}

/**
 * Placeholder for diff content
 */
function DiffContentPlaceholder(props: { tab: Tab }) {
	const diffInfo = createMemo(() => {
		const diffData = props.tab.content.diffData
		if (!diffData) return { original: 'unknown', modified: 'unknown' }
		return {
			original: diffData.originalPath.split('/').pop() ?? 'original',
			modified: diffData.modifiedPath.split('/').pop() ?? 'modified',
		}
	})

	return (
		<div
			class="flex h-full w-full flex-col items-center justify-center bg-background/50 text-muted-foreground"
			data-testid="diff-content-placeholder"
		>
			<div class="mb-2 text-4xl opacity-20">↔️</div>
			<span class="text-sm font-medium">Diff View</span>
			<span class="mt-1 text-xs opacity-60">
				{diffInfo().original} ↔ {diffInfo().modified}
			</span>
		</div>
	)
}

/**
 * Empty content state
 */
function EmptyContent() {
	return (
		<div
			class="flex h-full w-full flex-col items-center justify-center bg-background/50 text-muted-foreground"
			data-testid="empty-content"
		>
			<div class="mb-2 text-4xl opacity-20">📋</div>
			<span class="text-sm">No content</span>
		</div>
	)
}

/**
 * Placeholder for custom content
 */
function CustomContentPlaceholder(props: { tab: Tab }) {
	return (
		<div
			class="flex h-full w-full flex-col items-center justify-center bg-background/50 text-muted-foreground"
			data-testid="custom-content-placeholder"
			data-custom-component={props.tab.content.customComponent}
		>
			<div class="mb-2 text-4xl opacity-20">🔧</div>
			<span class="text-sm font-medium">Custom Content</span>
			<span class="mt-1 text-xs opacity-60">
				{props.tab.content.customComponent ?? 'Unknown component'}
			</span>
		</div>
	)
}

/**
 * Helper function to get a human-readable content type label
 */
export function getContentTypeLabel(content: TabContentType): string {
	switch (content.type) {
		case 'file':
			return content.filePath?.split('/').pop() ?? 'Untitled'
		case 'diff':
			return 'Diff View'
		case 'empty':
			return 'Empty'
		case 'custom':
			return content.customComponent ?? 'Custom'
		default:
			return 'Unknown'
	}
}
