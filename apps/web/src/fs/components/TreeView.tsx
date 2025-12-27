import { Accessor, For, Show, onCleanup, onMount } from 'solid-js'
import type { FsDirTreeNode } from '@repo/fs'
import { useFocusManager } from '~/focus/focusManager'
import { TreeNode } from './TreeNode'

type TreeViewProps = {
	tree: Accessor<FsDirTreeNode | undefined>
	loading: Accessor<boolean>
}

export const TreeView = (props: TreeViewProps) => {
	const focus = useFocusManager()
	let containerRef: HTMLDivElement = null!

	onMount(() => {
		if (!containerRef) return
		const unregister = focus.registerArea('fileTree', () => containerRef)
		onCleanup(unregister)
	})

	return (
		<div ref={containerRef} class="h-full min-w-max">
			<p class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
				Tree
			</p>
			<Show
				when={!props.loading() && props.tree()}
				fallback={
					<p class="text-sm text-muted-foreground">
						{props.loading() ? '' : 'No filesystem loaded.'}
					</p>
				}
			>
				{(tree) => (
					<For each={tree().children}>
						{(child) => <TreeNode node={child} />}
					</For>
				)}
			</Show>
		</div>
	)
}
