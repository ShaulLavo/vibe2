import { makeEventListener } from '@solid-primitives/event-listener'
import { onCleanup, onMount } from 'solid-js'
import type { KeymapController } from '../keymap/KeymapContext'
import { useFocusAwareZoom } from './useFocusAwareZoom'

/**
 * Registers font zoom keyboard shortcuts and mouse/touchpad support
 *
 * Shortcuts:
 * - Cmd/Ctrl+Plus: Zoom in focused module
 * - Cmd/Ctrl+Minus: Zoom out focused module
 * - Ctrl+Wheel: Zoom focused module via mouse/touchpad
 */
export function registerFontZoomShortcuts(controller: KeymapController) {
	const focusAwareZoom = useFocusAwareZoom()

	// Register keybindings for zoom shortcuts
	const zoomInMetaBinding = controller.registerKeybinding({
		shortcut: 'meta+=',
		id: 'font-zoom.zoom-in-meta',
		options: {
			preventDefault: true,
		},
	})

	const zoomInCtrlBinding = controller.registerKeybinding({
		shortcut: 'ctrl+=',
		id: 'font-zoom.zoom-in-ctrl',
		options: {
			preventDefault: true,
		},
	})

	const zoomOutMetaBinding = controller.registerKeybinding({
		shortcut: 'meta+-',
		id: 'font-zoom.zoom-out-meta',
		options: {
			preventDefault: true,
		},
	})

	const zoomOutCtrlBinding = controller.registerKeybinding({
		shortcut: 'ctrl+-',
		id: 'font-zoom.zoom-out-ctrl',
		options: {
			preventDefault: true,
		},
	})

	// Register commands
	const zoomInCommand = controller.registerCommand({
		id: 'font-zoom.zoom-in',
		run: () => {
			focusAwareZoom.zoomFocused('in')
		},
	})

	const zoomOutCommand = controller.registerCommand({
		id: 'font-zoom.zoom-out',
		run: () => {
			focusAwareZoom.zoomFocused('out')
		},
	})

	// Bind commands to keybindings in global scope
	const zoomInMetaCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'font-zoom.zoom-in-meta',
		commandId: 'font-zoom.zoom-in',
	})

	const zoomInCtrlCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'font-zoom.zoom-in-ctrl',
		commandId: 'font-zoom.zoom-in',
	})

	const zoomOutMetaCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'font-zoom.zoom-out-meta',
		commandId: 'font-zoom.zoom-out',
	})

	const zoomOutCtrlCommandBinding = controller.bindCommand({
		scope: 'global',
		bindingId: 'font-zoom.zoom-out-ctrl',
		commandId: 'font-zoom.zoom-out',
	})

	// Global wheel event listener for Ctrl+scroll/wheel
	let wheelCleanup: (() => void) | undefined

	onMount(() => {
		if (typeof window !== 'undefined') {
			wheelCleanup = makeEventListener(window, 'wheel', (e) => {
				if (e.ctrlKey) {
					e.preventDefault()
					const direction = e.deltaY < 0 ? 'in' : 'out'
					focusAwareZoom.zoomFocused(direction)
				}
			}, { passive: false })
		}
	})

	// Return cleanup function
	const cleanup = () => {
		// Dispose command bindings
		zoomInMetaCommandBinding()
		zoomInCtrlCommandBinding()
		zoomOutMetaCommandBinding()
		zoomOutCtrlCommandBinding()

		// Dispose commands
		zoomInCommand()
		zoomOutCommand()

		// Dispose keybindings
		zoomInMetaBinding.dispose()
		zoomInCtrlBinding.dispose()
		zoomOutMetaBinding.dispose()
		zoomOutCtrlBinding.dispose()

		// Dispose wheel listener
		if (wheelCleanup) {
			wheelCleanup()
		}
	}

	onCleanup(cleanup)

	return cleanup
}
