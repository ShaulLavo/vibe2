import { Component } from 'solid-js'

type ResetDatabaseButtonProps = {
	onReset: () => void
	variant?: 'sidebar' | 'error'
}

export const ResetDatabaseButton: Component<ResetDatabaseButtonProps> = (
	props
) => {
	const handleClick = () => {
		if (
			confirm(
				'Are you sure you want to reset the database? This will clear all data.'
			)
		) {
			props.onReset()
		}
	}

	const baseClass =
		'flex items-center justify-center gap-2 rounded-md font-medium transition-colors'

	const variants = {
		sidebar:
			'w-full px-3 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-xs',
		error:
			'px-3 py-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm text-xs',
	}

	return (
		<button
			onClick={handleClick}
			class={`${baseClass} ${variants[props.variant || 'sidebar']}`}
		>
			Reset Database
		</button>
	)
}
