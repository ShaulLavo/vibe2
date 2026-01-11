/**
 * TabItem Component
 *
 * Individual tab within a TabBar. Shows file name, dirty indicator, and close button.
 * Handles click to setActiveTab and close button click to closeTab.
 * Requirements: 7.9, 7.10, 7.11, 14.4
 */

import { createMemo, Show } from 'solid-js'
import { VsEdit } from '@repo/icons/vs/VsEdit'
import { VsSettingsGear } from '@repo/icons/vs/VsSettingsGear'
import { useLayoutManager } from './SplitEditor'
import { FileIcon } from '../../fs/components/FileIcon'
import type { Tab } from '../types'
import type { ViewMode } from '../../fs/types/ViewMode'

export interface TabItemProps {
	tab: Tab
	paneId: string
	isActive: boolean
}

export function TabItem(props: TabItemProps) {
	const layout = useLayoutManager()

	const fileName = createMemo(() => {
		if (props.tab.content.type === 'file' && props.tab.content.filePath) {
			return props.tab.content.filePath.split('/').pop() ?? 'Untitled'
		}
		if (props.tab.content.type === 'diff') {
			return 'Diff'
		}
		if (props.tab.content.type === 'empty') {
			return 'Empty'
		}
		if (props.tab.content.type === 'custom') {
			return 'Custom'
		}
		return 'Untitled'
	})

	// Check if this file supports view mode toggle (settings files)
	const supportsViewModeToggle = createMemo(() => {
		if (props.tab.content.type !== 'file' || !props.tab.content.filePath) {
			return false
		}
		const path = props.tab.content.filePath
		// Settings files in .system directory or ending with Settings.json
		return path.includes('.system') && path.endsWith('.json')
	})

	const handleClick = (e: MouseEvent) => {
		e.stopPropagation()
		layout.setActiveTab(props.paneId, props.tab.id)
	}

	const handleClose = (e: MouseEvent) => {
		e.stopPropagation()
		layout.closeTab(props.paneId, props.tab.id)
	}

	const handleViewModeToggle = (e: MouseEvent) => {
		e.stopPropagation()
		const newMode: ViewMode = props.tab.viewMode === 'editor' ? 'ui' : 'editor'
		layout.setTabViewMode(props.paneId, props.tab.id, newMode)
	}

	return (
		<div
			class="tab-item group flex h-full min-w-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 transition-colors"
			classList={{
				'bg-surface-2 text-foreground': props.isActive,
				'bg-surface-1 text-muted-foreground hover:bg-surface-1-hover hover:text-foreground': !props.isActive,
			}}
			onClick={handleClick}
			role="tab"
			aria-selected={props.isActive}
			tabindex={props.isActive ? 0 : -1}
		>
			{/* File icon */}
			<Show when={props.tab.content.type === 'file' && props.tab.content.filePath}>
				<FileIcon name={fileName()} size={14} class="shrink-0" />
			</Show>

			{/* File name */}
			<span
				class="max-w-32 truncate text-sm font-medium"
				title={fileName()}
			>
				{fileName()}
			</span>

			{/* Dirty indicator (dot when isDirty) */}
			<Show when={props.tab.isDirty}>
				<span
					class="h-2 w-2 shrink-0 rounded-full bg-primary"
					title="Unsaved changes"
					aria-label="Unsaved changes"
				/>
			</Show>

			{/* View mode toggle for settings files */}
			<Show when={supportsViewModeToggle()}>
				<button
					class="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-primary"
					classList={{
						'text-primary': props.tab.viewMode === 'ui',
						'text-muted-foreground': props.tab.viewMode !== 'ui',
					}}
					onClick={handleViewModeToggle}
					title={props.tab.viewMode === 'editor' ? 'Switch to UI view' : 'Switch to editor view'}
					aria-label={props.tab.viewMode === 'editor' ? 'Switch to UI view' : 'Switch to editor view'}
					tabindex={-1}
				>
					<Show when={props.tab.viewMode === 'editor'} fallback={<VsEdit class="h-3.5 w-3.5" />}>
						<VsSettingsGear class="h-3.5 w-3.5" />
					</Show>
				</button>
			</Show>

			{/* Close button */}
			<button
				class="flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-surface-3 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-primary"
				classList={{ 'opacity-100': props.isActive }}
				onClick={handleClose}
				aria-label={`Close ${fileName()}`}
				tabindex={-1}
			>
				<svg class="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
					<path d="M9.35 3.35a.5.5 0 0 0-.7-.7L6 5.29 3.35 2.65a.5.5 0 1 0-.7.7L5.29 6 2.65 8.65a.5.5 0 1 0 .7.7L6 6.71l2.65 2.64a.5.5 0 0 0 .7-.7L6.71 6l2.64-2.65z" />
				</svg>
			</button>
		</div>
	)
}