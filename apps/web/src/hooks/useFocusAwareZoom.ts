import { useFocusManager, type FocusArea } from '../focus/focusManager'
import { createFontZoomStore, type FontModule } from './createFontZoomStore'

export type FocusAwareZoomActions = {
	zoomFocused: (direction: 'in' | 'out') => void
	resetFocusedZoom: () => void
	getCurrentModule: () => FontModule
}

const mapFocusAreaToModule = (area: FocusArea): FontModule => {
	switch (area) {
		case 'editor':
			return 'editor'
		case 'terminal':
			return 'terminal'
		case 'fileTree':
		case 'global':
		default:
			return 'ui'
	}
}

export const useFocusAwareZoom = (): FocusAwareZoomActions => {
	const focusManager = useFocusManager()
	const fontZoomStore = createFontZoomStore()

	const getCurrentModule = (): FontModule => {
		const activeArea = focusManager.activeArea()
		return mapFocusAreaToModule(activeArea)
	}

	const zoomFocused = (direction: 'in' | 'out') => {
		const module = getCurrentModule()
		if (direction === 'in') {
			fontZoomStore.actions.zoomIn(module)
		} else {
			fontZoomStore.actions.zoomOut(module)
		}
	}

	const resetFocusedZoom = () => {
		const module = getCurrentModule()
		fontZoomStore.actions.resetZoom(module)
	}

	return {
		zoomFocused,
		resetFocusedZoom,
		getCurrentModule,
	}
}
