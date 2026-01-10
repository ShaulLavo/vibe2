import type { Component, JSX } from 'solid-js'
import { children, createSignal, splitProps } from 'solid-js'
import { useTheme } from '@repo/theme'
import { Scrollbar } from '../Scrollbar'
import { useScrollbar } from '../useScrollbar'
import { cn } from '../utils'

export type SettingsScrollAreaProps = JSX.HTMLAttributes<HTMLDivElement> & {
	contentClass?: string
	children: JSX.Element
}

const SCROLLBAR_WIDTH = 10
const SCROLLBAR_MIN_THUMB = 24

export const SettingsScrollArea: Component<SettingsScrollAreaProps> = (
	props
) => {
	const [local, others] = splitProps(props as SettingsScrollAreaProps, [
		'class',
		'contentClass',
		'children',
	])
	const resolved = children(() => local.children)
	const { theme } = useTheme()
	const [scrollElement, setScrollElement] = createSignal<HTMLElement | null>(
		null
	)

	const scrollbar = useScrollbar({
		scrollElement,
		minThumbSize: SCROLLBAR_MIN_THUMB,
	})

	const resolveThumbStyle = (state: {
		isHovered: boolean
		isDragging: boolean
	}) => ({
		'background-color':
			theme.editor.scrollbarThumb ??
			(state.isDragging
				? 'rgba(255, 255, 255, 0.3)'
				: state.isHovered
					? 'rgba(255, 255, 255, 0.12)'
					: 'rgba(255, 255, 255, 0.08)'),
		opacity: state.isDragging ? 0.8 : state.isHovered ? 0.6 : 0.45,
		'border-radius': '0px',
		transition: state.isDragging ? 'none' : 'background-color 0.15s ease',
		'backdrop-filter': 'blur(4px)',
	})

	return (
		<div
			class={cn('relative h-full min-h-0 overflow-hidden', local.class)}
			{...others}
		>
			<div
				ref={setScrollElement}
				class={cn('h-full min-h-0 overflow-y-auto', local.contentClass)}
			>
				{resolved()}
			</div>
			<Scrollbar
				class="absolute right-0 top-0 h-full"
				size={SCROLLBAR_WIDTH}
				containerRef={scrollbar.setContainerRef}
				thumbOffset={scrollbar.thumbOffset}
				thumbSize={scrollbar.thumbSize}
				isVisible={scrollbar.isVisible}
				onScrollTo={scrollbar.scrollToRatio}
				onScrollBy={scrollbar.scrollBy}
				thumbStyle={resolveThumbStyle}
			/>
		</div>
	)
}
