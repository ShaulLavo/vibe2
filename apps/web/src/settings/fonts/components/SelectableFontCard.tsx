import { VsCheck } from '@repo/icons/vs'
import { FontCard, type FontCardProps } from './FontCard'

export interface SelectableFontCardProps extends FontCardProps {
	isSelected: boolean
	isSelectMode: boolean
	onToggle: () => void
}

export const SelectableFontCard = (props: SelectableFontCardProps) => {
	return (
		<div class="relative group">
			<div
				class="relative transition-transform duration-200"
				classList={{
					'scale-[0.98]': props.isSelected,
					'cursor-pointer': props.isSelectMode,
				}}
				onClick={(e) => {
					if (props.isSelectMode) {
						e.preventDefault()
						e.stopPropagation()
						props.onToggle()
					}
				}}
			>
				<FontCard {...props} />

				{/* Selection Overlay */}
				<div
					class="absolute inset-0 rounded-lg border-2 pointer-events-none transition-colors"
					classList={{
						'border-primary bg-primary/5': props.isSelected,
						'border-transparent': !props.isSelected,
					}}
				/>
			</div>

			{/* Checkbox */}
			<button
				onClick={(e) => {
					e.preventDefault()
					e.stopPropagation()
					props.onToggle()
				}}
				class="absolute top-2 right-2 z-10 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
				classList={{
					'opacity-0 group-hover:opacity-100':
						!props.isSelectMode && !props.isSelected,
					'opacity-100': props.isSelectMode || props.isSelected,
					'bg-primary border-primary text-primary-foreground': props.isSelected,
					'bg-background/80 backdrop-blur border-muted-foreground/30 hover:border-primary/50 text-transparent':
						!props.isSelected,
				}}
			>
				<VsCheck class="w-3.5 h-3.5" />
			</button>
		</div>
	)
}
