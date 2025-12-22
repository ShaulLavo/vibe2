import { createStore, reconcile } from 'solid-js/store'
import type { ScrollPosition } from '../cache/fileCacheController'

export const createScrollPositionState = () => {
	const [scrollPositions, setScrollPositionsStore] = createStore<
		Record<string, ScrollPosition | undefined>
	>({})

	const setScrollPosition = (path: string, position?: ScrollPosition) => {
		if (!path) return
		if (!position) {
			setScrollPositionsStore(path, undefined)
			return
		}

		setScrollPositionsStore(path, position)
	}

	const clearScrollPositions = () => {
		setScrollPositionsStore(reconcile({}))
	}

	return {
		scrollPositions,
		setScrollPosition,
		clearScrollPositions,
	}
}
