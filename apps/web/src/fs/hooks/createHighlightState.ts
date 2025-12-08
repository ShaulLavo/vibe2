import { createStore, reconcile } from 'solid-js/store'
import type { TreeSitterCapture } from '../../workers/treeSitterWorkerTypes'

export const createHighlightState = () => {
	const [fileHighlights, setHighlightsStore] = createStore<
		Record<string, TreeSitterCapture[] | undefined>
	>({})

	const setHighlights = (path: string, highlights?: TreeSitterCapture[]) => {
		if (!path) return
		if (!highlights?.length) {
			setHighlightsStore(path, undefined)
			return
		}

		setHighlightsStore(path, highlights)
	}

	const clearHighlights = () => {
		setHighlightsStore(reconcile({}))
	}

	return {
		fileHighlights,
		setHighlights,
		clearHighlights
	}
}
