import { VsNewFile } from '@repo/icons/vs/VsNewFile'
import { VsNewFolder } from '@repo/icons/vs/VsNewFolder'
import { VsRefresh } from '@repo/icons/vs/VsRefresh'
import { VsCollapseAll } from '@repo/icons/vs/VsCollapseAll'
import { useFs } from '../context/FsContext'

type FsToolbarProps = {
	parentPath: () => string
}

export const FsToolbar = (props: FsToolbarProps) => {
	const [, actions] = useFs()

	const handleNewFile = () => {
		const parent = props.parentPath()
		actions.setCreationState({
			type: 'file',
			parentPath: parent,
		})
	}

	const handleNewFolder = () => {
		const parent = props.parentPath()
		actions.setCreationState({
			type: 'folder',
			parentPath: parent,
		})
	}

	const handleRefresh = () => {
		void actions.refresh()
	}

	const handleCollapseAll = () => {
		actions.collapseAll()
	}

	return (
		<div class="fs-toolbar">
			<button
				type="button"
				class="fs-toolbar-btn"
				onClick={handleNewFile}
				title="New File"
			>
				<VsNewFile />
			</button>
			<button
				type="button"
				class="fs-toolbar-btn"
				onClick={handleNewFolder}
				title="New Folder"
			>
				<VsNewFolder />
			</button>
			<button
				type="button"
				class="fs-toolbar-btn"
				onClick={handleRefresh}
				title="Refresh"
			>
				<VsRefresh />
			</button>
			<button
				type="button"
				class="fs-toolbar-btn"
				onClick={handleCollapseAll}
				title="Collapse All"
			>
				<VsCollapseAll />
			</button>
		</div>
	)
}
