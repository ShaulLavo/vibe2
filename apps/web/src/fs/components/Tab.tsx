type TabProps = {
	value: string
	label: string
	isActive?: boolean
	onSelect?: (value: string) => void
	title?: string
}

export const Tab = (props: TabProps) => {
	const handleSelect = () => {
		props.onSelect?.(props.value)
	}

	return (
		<button
			type="button"
			role="tab"
			tabIndex={props.isActive ? 0 : -1}
			onClick={handleSelect}
			title={props.title ?? props.value}
			class={
				'flex items-center gap-2 px-3 py-1 font-semibold transition-colors ' +
				(props.isActive
					? 'bg-background text-foreground'
					: 'text-muted-foreground hover:text-foreground')
			}
			aria-selected={props.isActive}
		>
			<span class="max-w-48 truncate">{props.label}</span>
		</button>
	)
}
