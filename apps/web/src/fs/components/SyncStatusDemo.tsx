import { createSignal, onMount } from 'solid-js'
import { SyncStatusIndicator } from './SyncStatusIndicator'
import { SyncStatusTooltip } from './SyncStatusTooltip'
import type { SyncStatusInfo, SyncStatusType } from '@repo/code-editor/sync'
import { useSyncStatusContext } from '../context/SyncStatusContext'

/**
 * Demo component to test sync status indicators
 * This will be removed once real integration is complete
 */
export const SyncStatusDemo = () => {
	const { updateSyncStatus, simulateStatusChange } = useSyncStatusContext()
	const [currentStatus, setCurrentStatus] = createSignal<SyncStatusInfo>({
		type: 'synced',
		lastSyncTime: Date.now(),
		hasLocalChanges: false,
		hasExternalChanges: false,
	})

	// Mock some file paths for testing
	const mockFiles = [
		'/test/file1.ts',
		'/test/file2.js',
		'/test/file3.md',
		'/test/file4.json',
	]

	const statusTypes: SyncStatusType[] = [
		'synced',
		'dirty',
		'external-changes',
		'conflict',
		'error',
		'not-watched',
	]

	onMount(() => {
		// Set up some mock sync statuses
		mockFiles.forEach((path, index) => {
			const statusType = statusTypes[index % statusTypes.length]
			simulateStatusChange(path, statusType)
		})
	})

	const cycleStatus = () => {
		const currentIndex = statusTypes.indexOf(currentStatus().type)
		const nextIndex = (currentIndex + 1) % statusTypes.length
		const nextType = statusTypes[nextIndex]
		
		const newStatus: SyncStatusInfo = {
			type: nextType,
			lastSyncTime: Date.now(),
			hasLocalChanges: nextType === 'dirty' || nextType === 'conflict',
			hasExternalChanges: nextType === 'external-changes' || nextType === 'conflict',
			errorMessage: nextType === 'error' ? 'Mock sync error' : undefined,
		}
		
		setCurrentStatus(newStatus)
	}

	return (
		<div class="p-4 space-y-4 border border-border rounded-lg bg-background">
			<h3 class="text-lg font-semibold">Sync Status Indicators Demo</h3>
			
			<div class="space-y-2">
				<h4 class="font-medium">All Status Types:</h4>
				<div class="flex gap-4 items-center">
					{statusTypes.map(type => {
						const mockStatus: SyncStatusInfo = {
							type,
							lastSyncTime: Date.now(),
							hasLocalChanges: type === 'dirty' || type === 'conflict',
							hasExternalChanges: type === 'external-changes' || type === 'conflict',
							errorMessage: type === 'error' ? 'Mock error message' : undefined,
						}
						return (
							<div class="flex items-center gap-2">
								<SyncStatusIndicator status={mockStatus} size={16} />
								<span class="text-sm">{type}</span>
							</div>
						)
					})}
				</div>
			</div>

			<div class="space-y-2">
				<h4 class="font-medium">Interactive Status:</h4>
				<div class="flex items-center gap-4">
					<SyncStatusIndicator status={currentStatus()} size={20} />
					<button 
						onClick={cycleStatus}
						class="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
					>
						Cycle Status ({currentStatus().type})
					</button>
				</div>
				<div class="p-2 bg-muted rounded text-sm">
					<SyncStatusTooltip status={currentStatus()} />
				</div>
			</div>
		</div>
	)
}