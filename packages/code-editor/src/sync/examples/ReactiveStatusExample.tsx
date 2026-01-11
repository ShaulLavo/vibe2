import { createSignal, For, Show } from 'solid-js'
import {
	SyncStatusProvider,
	createSyncStatus,
	createConflictTracker,
} from '../context/SyncStatusContext'
import { createAggregatedSyncStatus } from '../hooks/createSyncStatusHooks'
import {
	SyncStatusIndicator,
	SyncStatusBadge,
	SyncStatusSummary,
} from '../ui/SyncStatusIndicator'
import type { EditorFileSyncManager } from '../editor-file-sync-manager'

/**
 * Example showing how to use the reactive sync status system
 */
export function ReactiveStatusExample(props: {
	syncManager: EditorFileSyncManager
}) {
	const [openFiles] = createSignal([
		'/src/components/App.tsx',
		'/src/utils/helpers.ts',
		'/src/types/index.ts',
		'/README.md',
	])

	return (
		<SyncStatusProvider syncManager={props.syncManager}>
			<div class="p-4 space-y-6">
				<h2 class="text-xl font-semibold">Reactive Sync Status Example</h2>

				<section>
					<h3 class="text-lg font-medium mb-3">Individual File Status</h3>
					<div class="space-y-2">
						<For each={openFiles()}>
							{(filePath) => <FileStatusRow filePath={filePath} />}
						</For>
					</div>
				</section>

				<section>
					<h3 class="text-lg font-medium mb-3">Aggregate Status</h3>
					<AggregateStatusDisplay filePaths={openFiles()} />
				</section>

				<section>
					<h3 class="text-lg font-medium mb-3">Conflict Tracker</h3>
					<ConflictTrackerDisplay />
				</section>

				<section>
					<h3 class="text-lg font-medium mb-3">Status Summary</h3>
					<SyncStatusSummary filePaths={openFiles()} />
				</section>
			</div>
		</SyncStatusProvider>
	)
}

/**
 * Component showing status for a single file
 */
function FileStatusRow(props: { filePath: string }) {
	const status = createSyncStatus(() => props.filePath)

	return (
		<div class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
			<SyncStatusIndicator filePath={props.filePath} showTooltip />
			<span class="font-mono text-sm flex-1">{props.filePath}</span>
			<SyncStatusBadge filePath={props.filePath} showText />
			<span class="text-xs text-gray-500">{status().type}</span>
		</div>
	)
}

/**
 * Component showing aggregate status across multiple files
 */
function AggregateStatusDisplay(props: { filePaths: string[] }) {
	const aggregated = createAggregatedSyncStatus(() => props.filePaths)

	return (
		<div class="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
				<div>
					<div class="font-medium text-blue-800 dark:text-blue-200">
						Total Files
					</div>
					<div class="text-2xl font-bold">{aggregated().counts.total}</div>
				</div>
				<div>
					<div class="font-medium text-green-800 dark:text-green-200">
						Synced
					</div>
					<div class="text-2xl font-bold text-green-600">
						{aggregated().counts.synced}
					</div>
				</div>
				<div>
					<div class="font-medium text-orange-800 dark:text-orange-200">
						Modified
					</div>
					<div class="text-2xl font-bold text-orange-600">
						{aggregated().counts.dirty}
					</div>
				</div>
				<div>
					<div class="font-medium text-red-800 dark:text-red-200">
						Conflicts
					</div>
					<div class="text-2xl font-bold text-red-600">
						{aggregated().counts.conflicts}
					</div>
				</div>
			</div>

			<div class="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium">Overall Status:</span>
					<SyncStatusBadge filePath="" showText />
					<span class="text-sm">{aggregated().overallStatus}</span>
				</div>

				<Show when={aggregated().hasIssues}>
					<div class="mt-2 text-sm text-red-700 dark:text-red-300">
						⚠️ {aggregated().counts.conflicts} conflicts and{' '}
						{aggregated().counts.errors} errors need attention
					</div>
				</Show>
			</div>
		</div>
	)
}

/**
 * Component showing conflict tracking information
 */
function ConflictTrackerDisplay() {
	const conflictTracker = createConflictTracker()

	return (
		<div class="bg-red-50 dark:bg-red-900 p-4 rounded-lg">
			<div class="flex items-center gap-3">
				<div class="flex-1">
					<div class="font-medium text-red-800 dark:text-red-200">
						Conflict Status
					</div>
					<div class="text-sm text-red-600 dark:text-red-400">
						{conflictTracker.hasConflicts()
							? `${conflictTracker.conflictCount()} files have conflicts`
							: 'No conflicts detected'}
					</div>
				</div>

				<Show when={conflictTracker.hasConflicts()}>
					<div class="text-2xl">⚠️</div>
				</Show>

				<Show when={!conflictTracker.hasConflicts()}>
					<div class="text-2xl">✅</div>
				</Show>
			</div>
		</div>
	)
}

/**
 * Example of using status change watchers
 */
export function StatusChangeWatcherExample(props: {
	syncManager: EditorFileSyncManager
}) {
	const [notifications, setNotifications] = createSignal<string[]>([])

	const addNotification = (message: string) => {
		setNotifications((prev) => [...prev, message])
		// Auto-remove after 3 seconds
		setTimeout(() => {
			setNotifications((prev) => prev.slice(1))
		}, 3000)
	}

	return (
		<SyncStatusProvider syncManager={props.syncManager}>
			<div class="p-4">
				<h3 class="text-lg font-medium mb-3">Status Change Notifications</h3>

				<div class="space-y-2 mb-4">
					<For each={notifications()}>
						{(notification) => (
							<div class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 p-2 rounded text-sm">
								{notification}
							</div>
						)}
					</For>
				</div>

				<div class="space-y-2">
					<StatusWatcherRow
						filePath="/example/file1.ts"
						onStatusChange={(status) =>
							addNotification(`File1 status changed to: ${status.type}`)
						}
					/>
					<StatusWatcherRow
						filePath="/example/file2.ts"
						onStatusChange={(status) =>
							addNotification(`File2 status changed to: ${status.type}`)
						}
					/>
				</div>
			</div>
		</SyncStatusProvider>
	)
}

function StatusWatcherRow(props: {
	filePath: string
	onStatusChange: (status: any) => void
}) {
	const status = createSyncStatus(() => props.filePath)

	// Watch for status changes
	let previousStatus: string | undefined

	// This would be better implemented with createEffect in a real app
	const currentStatus = status().type
	if (previousStatus && previousStatus !== currentStatus) {
		props.onStatusChange(status())
	}
	previousStatus = currentStatus

	return (
		<div class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded">
			<SyncStatusIndicator filePath={props.filePath} />
			<span class="font-mono text-sm flex-1">{props.filePath}</span>
			<span class="text-xs text-gray-500">{status().type}</span>
		</div>
	)
}
