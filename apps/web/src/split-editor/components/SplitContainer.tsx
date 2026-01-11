/**
 * SplitContainer Component
 *
 * Wraps the @repo/ui Resizable component to render a split container
 * with two children. Handles direction, sizes, and size change callbacks.
 */

import {
	Resizable as ResizableRoot,
	ResizableHandle,
	ResizablePanel,
} from '@repo/ui/resizable'
import { SplitNode } from './SplitNode'
import { useLayoutManager } from './SplitEditor'
import type { SplitContainer as SplitContainerType } from '../types'

export interface SplitContainerProps {
	/** The container node to render */
	node: SplitContainerType
}

/** Container component using existing Resizable from @repo/ui */
export function SplitContainer(props: SplitContainerProps) {
	const layout = useLayoutManager()

	const handleSizesChange = (sizes: number[]) => {
		if (sizes.length === 2) {
			layout.updateSplitSizes(props.node.id, [sizes[0]!, sizes[1]!])
		}
	}

	return (
		<ResizableRoot
			class="flex size-full"
			orientation={props.node.direction}
			onSizesChange={handleSizesChange}
		>
			<ResizablePanel
				initialSize={props.node.sizes[0]}
				minSize={0.05}
				class="min-h-0 min-w-0 overflow-hidden"
			>
				<SplitNode nodeId={props.node.children[0]} />
			</ResizablePanel>
			<ResizableHandle
				class="z-20"
				aria-label={`Resize ${props.node.direction} split`}
			/>
			<ResizablePanel
				initialSize={props.node.sizes[1]}
				minSize={0.05}
				class="min-h-0 min-w-0 overflow-hidden"
			>
				<SplitNode nodeId={props.node.children[1]} />
			</ResizablePanel>
		</ResizableRoot>
	)
}
