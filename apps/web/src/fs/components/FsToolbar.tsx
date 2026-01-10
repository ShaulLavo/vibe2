import { VsNewFile } from '@repo/icons/vs/VsNewFile'
import { VsNewFolder } from '@repo/icons/vs/VsNewFolder'
import { VsRefresh } from '@repo/icons/vs/VsRefresh'
import { VsCollapseAll } from '@repo/icons/vs/VsCollapseAll'
import { Button } from '@repo/ui/button'
import { Flex } from '@repo/ui/flex'
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
		<Flex class="fs-toolbar gap-0.5">
			<Button
				variant="ghost"
				size="icon"
				class="fs-toolbar-btn h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
				onClick={handleNewFile}
				title="New File"
			>
				<VsNewFile />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				class="fs-toolbar-btn h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
				onClick={handleNewFolder}
				title="New Folder"
			>
				<VsNewFolder />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				class="fs-toolbar-btn h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
				onClick={handleRefresh}
				title="Refresh"
			>
				<VsRefresh />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				class="fs-toolbar-btn h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
				onClick={handleCollapseAll}
				title="Collapse All"
			>
				<VsCollapseAll />
			</Button>
		</Flex>
	)
}
