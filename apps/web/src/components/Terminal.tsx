import { createResizeObserver } from '@solid-primitives/resize-observer'
import { onCleanup, onMount, type Component } from 'solid-js'
import { createTerminalController } from '../terminal/terminalController'
import { useFocusManager } from '~/focus/focusManager'

export const Terminal: Component = () => {
	let containerRef: HTMLDivElement = null!
	const focus = useFocusManager()

	onMount(() => {
		let disposed = false
		let controller: Awaited<
			ReturnType<typeof createTerminalController>
		> | null = null
		const unregisterFocus = focus.registerArea('terminal', () => containerRef)

		const setup = async () => {
			const instance = await createTerminalController(containerRef)
			if (disposed) {
				instance.dispose()
				return
			}
			controller = instance

			createResizeObserver(
				() => containerRef,
				() => instance.fit()
			)
		}

		void setup()

		onCleanup(() => {
			disposed = true
			controller?.dispose()
			unregisterFocus()
		})
	})

	return (
		<div
			class="terminal-container relative h-full min-h-0 px-2"
			ref={el => (containerRef = el)}
		/>
	)
}
