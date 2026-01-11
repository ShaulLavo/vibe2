import { createSignal, Show, For } from 'solid-js'
import type {
	ConflictInfo,
	ConflictResolution,
	BatchResolutionResult,
} from '../types'
import { ConflictResolutionDialog } from './ConflictResolutionDialog'
import { ConflictNotification } from './ConflictNotification'
import { DiffView } from './DiffView'

/**
 * Props for ConflictResolutionUI component
 */
export interface ConflictResolutionUIProps {
	/** List of pending conflicts */
	conflicts: ConflictInfo[]
	/** Callback when a conflict is resolved */
	onResolveConflict: (
		path: string,
		resolution: ConflictResolution
	) => Promise<void>
	/** Callback for batch conflict resolution */
	onBatchResolve?: (
		conflicts: ConflictInfo[],
		strategy: string
	) => Promise<BatchResolutionResult>
}

/**
 * Main UI component for handling conflict resolution
 */
export function ConflictResolutionUI(props: ConflictResolutionUIProps) {
	const [activeConflict, setActiveConflict] = createSignal<ConflictInfo | null>(
		null
	)
	const [showDialog, setShowDialog] = createSignal(false)
	const [showDiffView, setShowDiffView] = createSignal(false)
	const [dismissedNotifications, setDismissedNotifications] = createSignal<
		Set<string>
	>(new Set())

	const handleShowConflictResolution = (conflict: ConflictInfo) => {
		setActiveConflict(conflict)
		setShowDialog(true)
	}

	const handleResolveFromDialog = async (resolution: ConflictResolution) => {
		const conflict = activeConflict()
		if (!conflict) return

		if (resolution.strategy === 'manual-merge') {
			// Show diff view for manual merging
			setShowDialog(false)
			setShowDiffView(true)
		} else {
			// Resolve directly
			try {
				await props.onResolveConflict(conflict.path, resolution)
				setShowDialog(false)
				setActiveConflict(null)
			} catch (error) {
				console.error('Failed to resolve conflict:', error)
				// TODO: Show error notification
			}
		}
	}

	const handleMergeComplete = async (mergedContent: string) => {
		const conflict = activeConflict()
		if (!conflict) return

		const resolution: ConflictResolution = {
			strategy: 'manual-merge',
			mergedContent,
		}

		try {
			await props.onResolveConflict(conflict.path, resolution)
			setShowDiffView(false)
			setActiveConflict(null)
		} catch (error) {
			console.error('Failed to save merged content:', error)
			// TODO: Show error notification
		}
	}

	const handleCancelDialog = () => {
		setShowDialog(false)
		setActiveConflict(null)
	}

	const handleCancelDiffView = () => {
		setShowDiffView(false)
		// Go back to dialog
		setShowDialog(true)
	}

	const handleDismissNotification = (conflictPath: string) => {
		setDismissedNotifications((prev) => new Set([...prev, conflictPath]))
	}

	const isNotificationVisible = (conflict: ConflictInfo) => {
		return !dismissedNotifications().has(conflict.path)
	}

	return (
		<>
			<For each={props.conflicts}>
				{(conflict) => (
					<Show when={isNotificationVisible(conflict)}>
						<ConflictNotification
							conflictInfo={conflict}
							isVisible={true}
							onResolve={() => handleShowConflictResolution(conflict)}
							onDismiss={() => handleDismissNotification(conflict.path)}
						/>
					</Show>
				)}
			</For>

			<Show when={activeConflict()}>
				{(conflict) => (
					<ConflictResolutionDialog
						conflictInfo={conflict()}
						isOpen={showDialog()}
						onResolve={handleResolveFromDialog}
						onCancel={handleCancelDialog}
					/>
				)}
			</Show>

			<Show when={activeConflict()}>
				{(conflict) => (
					<DiffView
						conflictInfo={conflict()}
						isOpen={showDiffView()}
						onMergeComplete={handleMergeComplete}
						onCancel={handleCancelDiffView}
					/>
				)}
			</Show>
		</>
	)
}

/**
 * Interface for conflict resolution UI system
 */
export interface ConflictResolutionUISystem {
	/** Show conflict resolution dialog for a specific file */
	showConflictDialog(conflictInfo: ConflictInfo): Promise<ConflictResolution>

	/** Show diff view for manual merging */
	showDiffView(conflictInfo: ConflictInfo): Promise<string | null>

	/** Show batch conflict resolution interface */
	showBatchResolution(conflicts: ConflictInfo[]): Promise<BatchResolutionResult>
}

/**
 * Create a conflict resolution UI system
 */
export function createConflictResolutionUISystem(): ConflictResolutionUISystem {
	return {
		async showConflictDialog(
			_conflictInfo: ConflictInfo
		): Promise<ConflictResolution> {
			// This would be implemented by the consuming application
			// For now, return a default resolution
			return { strategy: 'manual-merge' }
		},

		async showDiffView(_conflictInfo: ConflictInfo): Promise<string | null> {
			// This would be implemented by the consuming application
			// For now, return null (cancelled)
			return null
		},

		async showBatchResolution(
			_conflicts: ConflictInfo[]
		): Promise<BatchResolutionResult> {
			// This would be implemented by the consuming application
			// For now, return empty result
			return {
				resolutions: new Map(),
			}
		},
	}
}
