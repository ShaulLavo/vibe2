import { Resizable } from '~/components/Resizable'
import { useFs } from '../../fs/context/FsContext'
import { SelectedFilePanel } from './SelectedFilePanel'
import { TreeView } from './TreeView'

export const Fs = () => {
	const [state, actions] = useFs()

	return (
		<div class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/30 bg-muted/60 shadow-xl">
			<button type="button" onClick={() => void actions.pickNewRoot()}>
				Pick New Folder
			</button>
			<Resizable
				orientation="horizontal"
				storageKey="fs-horizontal-panel-size"
				defaultSizes={[0.3, 0.7]}
				handleAriaLabel="Resize file tree"
			>
				<TreeView tree={() => state.tree} loading={() => state.loading} />
				<SelectedFilePanel
					isFileSelected={() => state.lastKnownFileNode?.kind === 'file'}
					currentPath={state.lastKnownFilePath}
				/>
			</Resizable>
		</div>
	)
}
