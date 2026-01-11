import { createSignal, Show, For } from 'solid-js'
import type { ConflictInfo, ConflictResolution, ConflictResolutionStrategy } from '../types'

/**
 * Props for ConflictResolutionDialog component
 */
export interface ConflictResolutionDialogProps {
	/** Conflict information to display */
	conflictInfo: ConflictInfo
	/** Whether the dialog is open */
	isOpen: boolean
	/** Callback when resolution is selected */
	onResolve: (resolution: ConflictResolution) => void
	/** Callback when dialog is cancelled */
	onCancel: () => void
}

/**
 * Dialog component for resolving file conflicts
 */
export function ConflictResolutionDialog(props: ConflictResolutionDialogProps) {
	const [selectedStrategy, setSelectedStrategy] = createSignal<ConflictResolutionStrategy>('manual-merge')

	const fileName = () => props.conflictInfo.path.split('/').pop() || props.conflictInfo.path

	const handleResolve = () => {
		const strategy = selectedStrategy()
		const resolution: ConflictResolution = { strategy }
		props.onResolve(resolution)
	}

	const handleShowDiff = () => {
		const resolution: ConflictResolution = { strategy: 'manual-merge' }
		props.onResolve(resolution)
	}

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
					{/* Header */}
					<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
							File Conflict Detected
						</h2>
						<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
							{fileName()}
						</p>
					</div>

					{/* Content */}
					<div class="px-6 py-4">
						<p class="text-sm text-gray-700 dark:text-gray-300 mb-4">
							This file has been modified both locally and externally. 
							Choose how to resolve the conflict:
						</p>

						{/* Resolution Options */}
						<div class="space-y-3">
							<label class="flex items-start space-x-3 cursor-pointer">
								<input
									type="radio"
									name="resolution"
									value="keep-local"
									checked={selectedStrategy() === 'keep-local'}
									onChange={() => setSelectedStrategy('keep-local')}
									class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
								/>
								<div class="flex-1">
									<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
										Keep My Changes
									</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">
										Overwrite the external changes with your local modifications
									</div>
								</div>
							</label>

							<label class="flex items-start space-x-3 cursor-pointer">
								<input
									type="radio"
									name="resolution"
									value="use-external"
									checked={selectedStrategy() === 'use-external'}
									onChange={() => setSelectedStrategy('use-external')}
									class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
								/>
								<div class="flex-1">
									<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
										Use External Changes
									</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">
										Discard your local changes and use the external version
									</div>
								</div>
							</label>

							<label class="flex items-start space-x-3 cursor-pointer">
								<input
									type="radio"
									name="resolution"
									value="manual-merge"
									checked={selectedStrategy() === 'manual-merge'}
									onChange={() => setSelectedStrategy('manual-merge')}
									class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
								/>
								<div class="flex-1">
									<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
										Show Diff & Merge Manually
									</div>
									<div class="text-xs text-gray-500 dark:text-gray-400">
										View differences and manually merge the changes
									</div>
								</div>
							</label>
						</div>

						{/* Conflict Details */}
						<div class="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
							<div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
								<div>
									<span class="font-medium">Conflict detected:</span>{' '}
									{new Date(props.conflictInfo.conflictTimestamp).toLocaleString()}
								</div>
								<div>
									<span class="font-medium">External modified:</span>{' '}
									{new Date(props.conflictInfo.lastModified).toLocaleString()}
								</div>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
						<button
							onClick={props.onCancel}
							class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
						>
							Cancel
						</button>
						
						<Show when={selectedStrategy() === 'manual-merge'}>
							<button
								onClick={handleShowDiff}
								class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
							>
								Show Diff
							</button>
						</Show>
						
						<Show when={selectedStrategy() !== 'manual-merge'}>
							<button
								onClick={handleResolve}
								class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
							>
								Resolve
							</button>
						</Show>
					</div>
				</div>
			</div>
		</Show>
	)
}