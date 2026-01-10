import type { Component, JSXElement } from 'solid-js'
import { createEffect, on, splitProps } from 'solid-js'

import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import type { IconProps } from '@repo/icons'
import {
	VsArrowDown,
	VsArrowSmallDown,
	VsArrowSmallUp,
	VsArrowUp,
	VsRemove,
} from '@repo/icons/vs'

import { cn } from './lib/utils'
import type { BadgeProps } from './badge'
import { Badge } from './badge'

type DeltaType =
	| 'increase'
	| 'moderateIncrease'
	| 'unchanged'
	| 'moderateDecrease'
	| 'decrease'

const badgeDeltaVariants = cva('', {
	variants: {
		variant: {
			success: 'bg-success text-success-foreground hover:bg-success',
			warning: 'bg-warning text-warning-foreground hover:bg-warning',
			error: 'bg-error text-error-foreground hover:bg-error',
		},
	},
})
type DeltaVariant = NonNullable<
	VariantProps<typeof badgeDeltaVariants>['variant']
>

const iconMap: {
	[key in DeltaType]: (props: IconProps) => JSXElement
} = {
	increase: VsArrowUp,
	moderateIncrease: VsArrowSmallUp,
	unchanged: VsRemove,
	moderateDecrease: VsArrowSmallDown,
	decrease: VsArrowDown,
}

const variantMap: { [key in DeltaType]: DeltaVariant } = {
	increase: 'success',
	moderateIncrease: 'success',
	unchanged: 'warning',
	moderateDecrease: 'error',
	decrease: 'error',
}

type BadgeDeltaProps = Omit<BadgeProps, 'variant'> & {
	deltaType: DeltaType
}

const BadgeDelta: Component<BadgeDeltaProps> = (props) => {
	const [local, others] = splitProps(props, ['class', 'children', 'deltaType'])

	// eslint-disable-next-line solid/reactivity
	let Icon = iconMap[local.deltaType]
	createEffect(
		on(
			() => local.deltaType,
			() => {
				Icon = iconMap[local.deltaType]
			}
		)
	)

	return (
		<Badge
			class={cn(
				badgeDeltaVariants({ variant: variantMap[local.deltaType] }),
				local.class
			)}
			{...others}
		>
			<span class="flex gap-1">
				<Icon class="size-4" />
				{local.children}
			</span>
		</Badge>
	)
}

export { BadgeDelta }
