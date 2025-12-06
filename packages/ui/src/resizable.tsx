import type { JSX, ValidComponent } from 'solid-js'
import { splitProps } from 'solid-js'

import type {
	DynamicProps,
	HandleProps,
	RootProps
} from '@corvu/resizable'
import ResizablePrimitive from '@corvu/resizable'

import { cn } from './lib/utils'

type ResizableProps<T extends ValidComponent = 'div'> = RootProps<T> & {
	class?: string
}

const Resizable = <T extends ValidComponent = 'div'>(
	props: DynamicProps<T, ResizableProps<T>>
) => {
	const [local, others] = splitProps(props as ResizableProps, ['class'])
	return (
		<ResizablePrimitive
			class={cn(
				'flex size-full data-[orientation=vertical]:flex-col',
				local.class
			)}
			{...others}
		/>
	)
}

const ResizablePanel = ResizablePrimitive.Panel

type ResizableHandleProps<T extends ValidComponent = 'button'> =
	HandleProps<T> & {
		class?: string
		indicatorClass?: string
		children?: JSX.Element
	}

const ResizableHandle = <T extends ValidComponent = 'button'>(
	props: DynamicProps<T, ResizableHandleProps<T>>
) => {
	const [local, others] = splitProps(props as ResizableHandleProps, [
		'class',
		'indicatorClass',
		'children'
	])

	return (
		<ResizablePrimitive.Handle
			class={cn(
				'group relative flex basis-3 shrink-0 cursor-col-resize items-center justify-center px-0.75 transition-colors data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:cursor-row-resize data-[orientation=vertical]:px-0 data-[orientation=vertical]:py-0.75',
				local.class
			)}
			{...others}
		>
			{local.children ?? (
				<div
					class={cn(
						'size-full rounded-sm bg-zinc-800/70 transition-colors group-data-active:bg-zinc-700 group-data-dragging:bg-zinc-600',
						local.indicatorClass
					)}
				/>
			)}
		</ResizablePrimitive.Handle>
	)
}

export { Resizable, ResizablePanel, ResizableHandle }
export type { ResizableHandleProps, ResizableProps }
