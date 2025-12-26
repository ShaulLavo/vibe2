import { Accessor, For, Show } from 'solid-js'
import type { FsDirTreeNode } from '@repo/fs'
import { TreeNode } from './TreeNode'

type TreeViewProps = {
	tree: Accessor<FsDirTreeNode | undefined>
	loading: Accessor<boolean>
}
export const TreeView = (props: TreeViewProps) => (
	<div class="min-w-max">
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
				<For each={tree().children}>{(child) => <TreeNode node={child} />}</For>
			)}
		</Show>
	</div>
)
