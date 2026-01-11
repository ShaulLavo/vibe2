import { type ParentComponent, onMount, onCleanup } from 'solid-js'
import { useKeymap } from '../keymap/KeymapContext'
import { registerFontZoomShortcuts } from '../hooks/useFontZoomShortcuts'

export const FontZoomProvider: ParentComponent = (props) => {
	const keymapController = useKeymap()

	onMount(() => {
		const cleanup = registerFontZoomShortcuts(keymapController)
		
		onCleanup(() => {
			cleanup()
		})
	})

	return <>{props.children}</>
}
