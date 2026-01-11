import { Show } from 'solid-js'
import type { ConflictInfo } from '../types'

/**
 * Props for ConflictNotification component
 */
export interface ConflictNotificationProps {
	/** Conflict information to display */
	conflictInfo: ConflictInfo
	/** Whether the notification is visible */
	isVisible: boolean
	/** Callback when user clicks to resolve */
	onResolve: () => void
	/** Callback when notification is dismissed */
	onDismiss: () => void
}

/**
 * Notification component that appears when a conflict is detected
 */
export function ConflictNotification(props: ConflictNotificationProps) {
	const fileName = () =>
		props.conflictInfo.path.split('/').pop() || props.conflictInfo.path

	return (
		<Show when={props.isVisible}>
			<div class="fixed top-4 right-4 max-w-sm w-full bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg shadow-lg z-40">
				<div class="p-4">
					<div class="flex items-start">
						<div class="shrink-0">
							<svg
								class="h-5 w-5 text-yellow-400"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<div class="ml-3 flex-1">
							<h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
								File Conflict
							</h3>
							<div class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
								<p>
									<span class="font-medium">{fileName()}</span> has conflicting
									changes.
								</p>
							</div>
						</div>
						<div class="ml-4 shrink-0">
							<button
								onClick={() => props.onDismiss()}
								class="inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none focus:text-yellow-600"
							>
								<span class="sr-only">Dismiss</span>
								<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						</div>
					</div>

					<div class="mt-4">
						<div class="flex space-x-2">
							<button
								onClick={() => props.onResolve()}
								class="text-sm bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700 px-3 py-1.5 rounded-md font-medium transition-colors"
							>
								Resolve Conflict
							</button>
						</div>
					</div>

					<div class="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
						Detected{' '}
						{new Date(
							props.conflictInfo.conflictTimestamp
						).toLocaleTimeString()}
					</div>
				</div>
			</div>
		</Show>
	)
}
