/* eslint-disable solid/reactivity */
import {
	Resizable as ResizableRoot,
	ResizableHandle,
	ResizablePanel,
} from '@repo/ui/resizable'
import { makePersisted } from '@solid-primitives/storage'
import { children, createSignal, type JSX } from 'solid-js'
import { dualStorage } from '@repo/utils/DualStorage'

export interface ResizableProps {
	children: [JSX.Element, JSX.Element]
	orientation: 'horizontal' | 'vertical'
	storageKey: string
	defaultSizes?: [number, number]
	minSize?: number
	class?: string
	firstPanelClass?: string
	secondPanelClass?: string
	handleAriaLabel?: string
}

export const Resizable = (props: ResizableProps) => {
	const defaults = props.defaultSizes ?? [0.3, 0.7]
	const storageKey = props.storageKey

	const [panelSizes, setPanelSizes] = makePersisted(
		createSignal<number[]>(defaults),
		{
			name: storageKey,
			storage: dualStorage,
		}
	)

	const resolved = children(() => props.children)

	return (
		<ResizableRoot
			class={props.class ?? 'flex flex-1 min-h-0'}
			orientation={props.orientation}
			onSizesChange={(sizes) => {
				if (sizes.length !== 2) return
				setPanelSizes(() => [...sizes])
			}}
		>
			<ResizablePanel
				initialSize={panelSizes()[0] ?? defaults[0]}
				minSize={props.minSize ?? 0}
				collapsible
				class={
					props.firstPanelClass ??
					'min-h-0 overflow-auto border-r border-border/30 bg-muted/60'
				}
			>
				{(resolved() as JSX.Element[])[0]}
			</ResizablePanel>
			<ResizableHandle
				class="z-20"
				aria-label={props.handleAriaLabel ?? 'Resize panels'}
			/>
			<ResizablePanel
				initialSize={panelSizes()[1] ?? defaults[1]}
				class={
					props.secondPanelClass ??
					'flex-1 min-h-0 overflow-auto bg-background/30'
				}
			>
				{(resolved() as JSX.Element[])[1]}
			</ResizablePanel>
		</ResizableRoot>
	)
}
