import { Accessor, createMemo, For, Show, onCleanup, onMount } from 'solid-js'
import type { FsDirTreeNode } from '@repo/fs'
import { useFocusManager } from '~/focus/focusManager'
import { useFs } from '../context/FsContext'
import { TreeNode } from './TreeNode'
import { FsToolbar } from './FsToolbar'
import { CreationRow } from './CreationRow'

type TreeViewProps = {
	tree: Accessor<FsDirTreeNode | undefined>
	loading: Accessor<boolean>
}

export const TreeView = (props: TreeViewProps) => {
	const focus = useFocusManager()
	const [state, actions] = useFs()
	let containerRef: HTMLDivElement = null!

	onMount(() => {
		if (!containerRef) return
		const unregister = focus.registerArea('fileTree', () => containerRef)
		onCleanup(unregister)
	})

	// Get parent path for creating new files/folders
	// If a file is selected, use its parent directory
	// If a directory is selected, use that directory
	// Otherwise use root
	const parentPath = createMemo(() => {
		const selected = state.selectedPath
		if (!selected) return ''

		const node = state.selectedNode
		if (!node) return ''

		if (node.kind === 'dir') {
			return node.path
		}
		// For files, get parent dir by removing last segment
		const lastSlash = selected.lastIndexOf('/')
		return lastSlash > 0 ? selected.slice(0, lastSlash) : ''
	})

	return (
		<div ref={containerRef} class="h-full min-w-max">
			<div class="flex items-center justify-between">
				<p class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
					Explorer
				</p>
				<FsToolbar parentPath={parentPath} />
			</div>
			<Show
				when={!props.loading() && props.tree()}
				fallback={
					<p class="text-sm text-muted-foreground">
						{props.loading() ? '' : 'No filesystem loaded.'}
					</p>
				}
			>
				{(tree) => (
					<>
						<For each={tree().children}>
							{(child) => <TreeNode node={child} />}
						</For>
						<Show
							when={
								state.creationState && state.creationState.parentPath === ''
							}
						>
							<CreationRow
								depth={1}
								type={state.creationState!.type}
								onSubmit={async (name) => {
									const parent = state.creationState!.parentPath
									const type = state.creationState!.type
									if (type === 'file') {
										await actions.createFile(parent, name)
									} else {
										await actions.createDir(parent, name)
									}
									actions.setCreationState(null)
								}}
								onCancel={() => actions.setCreationState(null)}
							/>
						</Show>
					</>
				)}
			</Show>
		</div>
	)
}
