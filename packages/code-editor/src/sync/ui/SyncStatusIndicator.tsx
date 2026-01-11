import { createMemo, Show } from 'solid-js'
import { createSyncStatus } from '../context/SyncStatusContext'
import { SyncStatusTracker } from '../sync-status-tracker'

/**
 * Props for SyncStatusIndicator component
 */
export interface SyncStatusIndicatorProps {
	/** File path to show status for */
	filePath: string
	/** Size variant of the indicator */
	size?: 'sm' | 'md' | 'lg'
	/** Whether to show tooltip on hover */
	showTooltip?: boolean
	/** Additional CSS classes */
	class?: string
}

/**
 * Reactive sync status indicator component
 * Shows visual indicator for file sync state (synced, dirty, conflict, etc.)
 */
export function SyncStatusIndicator(props: SyncStatusIndicatorProps) {
	const status = createSyncStatus(() => props.filePath)

	const sizeClasses = createMemo(() => {
		switch (props.size ?? 'md') {
			case 'sm':
				return 'w-2 h-2'
			case 'md':
				return 'w-3 h-3'
			case 'lg':
				return 'w-4 h-4'
		}
	})

	const statusClasses = createMemo(() => {
		const baseClasses = 'rounded-full flex-shrink-0'
		const statusClass = SyncStatusTracker.getStatusClassName(status())
		return `${baseClasses} ${statusClass} ${sizeClasses()}`
	})

	const statusColor = createMemo(() => {
		switch (status().type) {
			case 'synced':
				return 'bg-green-500'
			case 'dirty':
				return 'bg-orange-500'
			case 'external-changes':
				return 'bg-blue-500'
			case 'conflict':
				return 'bg-red-500'
			case 'error':
				return 'bg-red-600'
			case 'not-watched':
				return 'bg-gray-400'
			default:
				return 'bg-gray-400'
		}
	})

	const tooltip = createMemo(() => {
		if (!props.showTooltip) return undefined
		return SyncStatusTracker.getStatusDescription(status())
	})

	return (
		<div
			class={`${statusClasses()} ${statusColor()} ${props.class ?? ''}`}
			title={tooltip()}
		>
			<Show when={status().type === 'conflict'}>
				<div class="w-full h-full flex items-center justify-center text-white text-xs font-bold">
					!
				</div>
			</Show>
		</div>
	)
}

/**
 * Props for SyncStatusBadge component
 */
export interface SyncStatusBadgeProps {
	/** File path to show status for */
	filePath: string
	/** Whether to show the status text */
	showText?: boolean
	/** Additional CSS classes */
	class?: string
}

/**
 * Badge-style sync status indicator with optional text
 */
export function SyncStatusBadge(props: SyncStatusBadgeProps) {
	const status = createSyncStatus(() => props.filePath)

	const badgeClasses = createMemo(() => {
		const baseClasses =
			'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium'

		switch (status().type) {
			case 'synced':
				return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`
			case 'dirty':
				return `${baseClasses} bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200`
			case 'external-changes':
				return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`
			case 'conflict':
				return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`
			case 'error':
				return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`
			case 'not-watched':
				return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`
			default:
				return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`
		}
	})

	const statusIcon = createMemo(() => {
		switch (status().type) {
			case 'synced':
				return '✓'
			case 'dirty':
				return '●'
			case 'external-changes':
				return '↻'
			case 'conflict':
				return '⚠'
			case 'error':
				return '✗'
			case 'not-watched':
				return '○'
			default:
				return '?'
		}
	})

	const statusText = createMemo(() => {
		if (!props.showText) return undefined

		switch (status().type) {
			case 'synced':
				return 'Synced'
			case 'dirty':
				return 'Modified'
			case 'external-changes':
				return 'External Changes'
			case 'conflict':
				return 'Conflict'
			case 'error':
				return 'Error'
			case 'not-watched':
				return 'Not Watched'
			default:
				return 'Unknown'
		}
	})

	return (
		<span class={`${badgeClasses()} ${props.class ?? ''}`}>
			<span>{statusIcon()}</span>
			<Show when={props.showText}>
				<span>{statusText()}</span>
			</Show>
		</span>
	)
}

/**
 * Props for SyncStatusSummary component
 */
export interface SyncStatusSummaryProps {
	/** List of file paths to summarize */
	filePaths: string[]
	/** Additional CSS classes */
	class?: string
}

/**
 * Summary component showing aggregate sync status for multiple files
 */
export function SyncStatusSummary(props: SyncStatusSummaryProps) {
	const statuses = createMemo(() =>
		props.filePaths.map((path) => createSyncStatus(() => path)())
	)

	const summary = createMemo(() => {
		const counts = {
			synced: 0,
			dirty: 0,
			conflicts: 0,
			errors: 0,
			total: statuses().length,
		}

		statuses().forEach((status) => {
			switch (status.type) {
				case 'synced':
					counts.synced++
					break
				case 'dirty':
					counts.dirty++
					break
				case 'conflict':
					counts.conflicts++
					break
				case 'error':
					counts.errors++
					break
			}
		})

		return counts
	})

	const hasIssues = createMemo(
		() => summary().conflicts > 0 || summary().errors > 0
	)

	return (
		<div class={`flex items-center gap-2 text-sm ${props.class ?? ''}`}>
			<Show when={summary().total > 0}>
				<span class="text-gray-600 dark:text-gray-400">
					{summary().total} files
				</span>

				<Show when={summary().conflicts > 0}>
					<span class="text-red-600 dark:text-red-400 font-medium">
						{summary().conflicts} conflicts
					</span>
				</Show>

				<Show when={summary().errors > 0}>
					<span class="text-red-600 dark:text-red-400 font-medium">
						{summary().errors} errors
					</span>
				</Show>

				<Show when={summary().dirty > 0 && !hasIssues()}>
					<span class="text-orange-600 dark:text-orange-400">
						{summary().dirty} modified
					</span>
				</Show>

				<Show when={summary().synced === summary().total && !hasIssues()}>
					<span class="text-green-600 dark:text-green-400">All synced</span>
				</Show>
			</Show>

			<Show when={summary().total === 0}>
				<span class="text-gray-500 dark:text-gray-500">No files tracked</span>
			</Show>
		</div>
	)
}
