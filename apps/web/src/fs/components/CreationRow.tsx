import { createSignal, onMount } from 'solid-js'
import { FileIcon } from './FileIcon'
import { VsFolder } from '@repo/icons/vs/VsFolder'
import { TextField, TextFieldInput } from '@repo/ui/text-field'
import { Flex } from '@repo/ui/flex'

type CreationRowProps = {
	depth: number
	type: 'file' | 'folder'
	onSubmit: (name: string) => void
	onCancel: () => void
}

const TREE_INDENT_PX = 8

export const CreationRow = (props: CreationRowProps) => {
	let inputRef: HTMLInputElement | undefined
	const [value, setValue] = createSignal('')

	onMount(() => {
		// Small timeout to ensure DOM is ready for focus
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
		<Flex
			alignItems="center"
			class="relative pr-2 h-[22px]"
			style={{
				'padding-left': `${indentationOffset()}px`,
				'margin-left': `-${indentationOffset()}px`,
			}}
		>
			<span class="tree-node-icon ml-2 shrink-0 flex items-center justify-center">
				{props.type === 'folder' ? (
					<VsFolder size={16} />
				) : (
					<FileIcon name={value()} size={16} />
				)}
			</span>
			<TextField
				value={value()}
				onChange={setValue}
				class="w-full min-w-0 flex-1 ml-1 h-full"
			>
				<TextFieldInput
					ref={(el) => (inputRef = el)}
					onKeyDown={handleKeyDown}
					onBlur={handleSubmit}
					class="flatten-input h-full min-h-0 w-full p-0 text-sm bg-transparent border-none focus-visible:ring-0 rounded-none shadow-none leading-tight"
					placeholder={
						props.type === 'file' ? 'File name...' : 'Folder name...'
					}
				/>
			</TextField>
		</Flex>
	)
}
