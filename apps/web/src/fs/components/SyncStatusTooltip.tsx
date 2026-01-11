import { Show } from 'solid-js'
import type { SyncStatusInfo } from '@repo/code-editor/sync'

type SyncStatusTooltipProps = {
	status: SyncStatusInfo
}

/**
 * Detailed tooltip content for sync status
 * Provides comprehensive information about the file's sync state
 */
export const SyncStatusTooltip = (props: SyncStatusTooltipProps) => {
	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp)
		return date.toLocaleTimeString()
	}

	const getStatusDescription = () => {
		switch (props.status.type) {
			case 'synced':
				return 'File is up to date with no changes'
			case 'dirty':
				return 'File has unsaved local changes'
			case 'external-changes':
				return 'File has been modified externally'
			case 'conflict':
				return 'File has both local and external changes'
			case 'error':
				return 'Sync error occurred'
			case 'not-watched':
				return 'File is not being watched for changes'
			default:
				return 'Unknown sync status'
		}
	}

	return (
		<div class="text-ui space-y-1">
			<div class="font-medium">{getStatusDescription()}</div>
			
			<Show when={props.status.lastSyncTime > 0}>
				<div class="text-muted-foreground">
					Last sync: {formatTime(props.status.lastSyncTime)}
				</div>
			</Show>

			<Show when={props.status.hasLocalChanges}>
				<div class="text-orange-500">• Has local changes</div>
			</Show>

			<Show when={props.status.hasExternalChanges}>
				<div class="text-blue-500">• Has external changes</div>
			</Show>

			<Show when={props.status.errorMessage}>
				<div class="text-red-500">
					Error: {props.status.errorMessage}
				</div>
			</Show>
		</div>
	)
}