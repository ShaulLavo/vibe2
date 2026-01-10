import { Component } from 'solid-js'
import { Button } from '@repo/ui/button'

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

	const isSidebar = () => (props.variant || 'sidebar') === 'sidebar'

	return (
		<Button
			onClick={handleClick}
			variant={isSidebar() ? 'ghost' : 'destructive'}
			size="sm"
			class={
				isSidebar()
					? 'w-full justify-center bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20'
					: 'shadow-sm'
			}
		>
			Reset Database
		</Button>
	)
}
