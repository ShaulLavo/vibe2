import { createSignal } from 'solid-js'

export const createFileDisplayState = () => {
	const [selectedFileSize, setSelectedFileSize] = createSignal<
		number | undefined
	>(undefined)
	const [selectedFilePreviewBytes, setSelectedFilePreviewBytes] = createSignal<
		Uint8Array | undefined
	>(undefined)
	const [selectedFileContent, setSelectedFileContent] = createSignal('')
	const [selectedFileLoading, setSelectedFileLoading] = createSignal(false)
	const [error, setError] = createSignal<string | undefined>(undefined)
	const [loading, setLoading] = createSignal(false)

	return {
		selectedFileSize,
		setSelectedFileSize,
		selectedFilePreviewBytes,
		setSelectedFilePreviewBytes,
		selectedFileContent,
		setSelectedFileContent,
		selectedFileLoading,
		setSelectedFileLoading,
		error,
		setError,
		loading,
		setLoading,
	}
}
