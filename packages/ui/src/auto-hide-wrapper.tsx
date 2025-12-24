import { type Component, type JSX, mergeProps, splitProps } from 'solid-js'
import { clsx } from 'clsx'

export const enum AutoHideVisibility {
	SHOW = 'show',
	HIDE = 'hide',
	AUTO = 'auto',
}

export interface AutoHideWrapperProps extends JSX.HTMLAttributes<HTMLDivElement> {
	visibility: AutoHideVisibility
}

export const AutoHideWrapper: Component<AutoHideWrapperProps> = (props) => {
	const merged = mergeProps(
		{
			visibility: 'auto' as AutoHideVisibility,
		},
		props
	)

	// Split out onWheel to handle it with { passive: false } via on:wheel syntax
	const [wheelProps, restProps] = splitProps(merged, ['onWheel'])

	// Create handler with passive:false to allow preventDefault() without browser warnings
	const wheelHandler = () => {
		const handler = wheelProps.onWheel
		if (!handler) return undefined
		return {
			passive: false,
			handleEvent: (e: WheelEvent) => {
				if (typeof handler === 'function') {
					handler(e)
				}
			},
		}
	}

	return (
		<div
			class={clsx(
				'transition-opacity duration-300',
				{
					// SHOW: Always visible
					'opacity-100': restProps.visibility === 'show',

					// HIDE: Hidden and no pointer events
					'opacity-0 pointer-events-none': restProps.visibility === 'hide',

					// AUTO: Hidden by default, visible on hover
					'opacity-0 hover:opacity-100': restProps.visibility === 'auto',
				},
				restProps.class
			)}
			on:wheel={wheelHandler()}
			{...restProps}
		>
			{restProps.children}
		</div>
	)
}
