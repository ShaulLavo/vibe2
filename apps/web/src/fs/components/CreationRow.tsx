import { createSignal, onMount } from 'solid-js'
import { FileIcon } from './FileIcon'
import { VsFolder } from '@repo/icons/vs/VsFolder'

type CreationRowProps = {
	depth: number
	type: 'file' | 'folder'
	onSubmit: (name: string) => void
	onCancel: () => void
}

const TREE_INDENT_PX = 8

export const CreationRow = (props: CreationRowProps) => {
	let inputRef: HTMLInputElement = null!
	const [value, setValue] = createSignal('')

	onMount(() => {
		setTimeout(() => {
			inputRef?.focus()
		}, 0)
	})

	const handleSubmit = () => {
		const name = value().trim()
		if (name) {
			props.onSubmit(name)
		} else {
			props.onCancel()
		}
	}

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			handleSubmit()
		} else if (e.key === 'Escape') {
			e.preventDefault()
			props.onCancel()
		}
	}

	const indentationOffset = () => Math.max(props.depth - 1, 0) * TREE_INDENT_PX

	return (
		<div
			class="relative flex items-center pr-2"
			style={{
				'padding-left': `${indentationOffset()}px`,
				'margin-left': `-${indentationOffset()}px`,
			}}
		>
			<span class="tree-node-icon ml-2">
				{props.type === 'folder' ? (
					<VsFolder size={16} />
				) : (
					<FileIcon name={value()} size={16} />
				)}
			</span>
			<input
				ref={inputRef}
				type="text"
				value={value()}
				onInput={(e) => setValue(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
				onBlur={handleSubmit}
				class="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
				placeholder={props.type === 'file' ? 'File name...' : 'Folder name...'}
			/>
		</div>
	)
}
