import { createResizeObserver } from '@solid-primitives/resize-observer'
import { makePersisted } from '@solid-primitives/storage'
import {
	createEffect,
	createSignal,
	on,
	onCleanup,
	onMount,
	type Component,
} from 'solid-js'
import { useFocusManager } from '~/focus/focusManager'
import { useFs } from '~/fs/context/FsContext'
import { dualStorage } from '@repo/utils/DualStorage'
import { createPrompt } from '../terminal/prompt'
import {
	createTerminalController,
	TerminalController,
} from '../terminal/terminalController'
import { useTheme } from '@repo/theme'
import { ensureFs } from '~/fs/runtime/fsRuntime'

export const Terminal: Component = () => {
	let containerRef: HTMLDivElement = null!
	const focus = useFocusManager()
	const [state, actions] = useFs()
	const { theme, trackedTheme } = useTheme()
	const storage = typeof window === 'undefined' ? undefined : dualStorage
	const [cwd, setCwd] = makePersisted(
		// eslint-disable-next-line solid/reactivity
		createSignal(''),
		{
			name: 'terminal-cwd',
			storage,
		}
	)

	const normalizeCwd = (path: string) => {
		if (!path || path === '/') return ''
		return path.replace(/^[/\\]+/, '')
	}

	onMount(() => {
		const unregisterFocus = focus.registerArea('terminal', () => containerRef)
		let controller: TerminalController | null = null

		createResizeObserver(
			() => containerRef,
			() => controller?.fit()
		)

		const setup = async (focusOnMount: boolean) => {
			if (controller) {
				controller.dispose()
				controller = null
			}

			controller = await createTerminalController(containerRef, {
				getPrompt: () => createPrompt(cwd(), state.activeSource),
				commandContext: {
					shell: {
						state,
						actions,
						getCwd: () => cwd(),
						setCwd: (path) => setCwd(() => normalizeCwd(path)),
						getVfsContext: async () => {
							const source = state.activeSource ?? 'memory'
							return ensureFs(source)
						},
					},
				},
				theme: theme,
				focusOnMount,
			})
			controller.fit()
			const dir = await actions.ensureDirPathLoaded(cwd())
			if (!dir) {
				setCwd(() => '')
			}
		}

		void setup(true).catch((error) => {
			console.error('Failed to initialize terminal controller', error)
		})

		createEffect(
			on(
				trackedTheme,
				() => {
					if (!controller) return
					controller.setTheme(theme)
				},
				{ defer: true }
			)
		)

		onCleanup(() => {
			controller?.dispose()
			unregisterFocus()
		})
	})

	return (
		<div
			class="terminal-container relative h-full min-h-0 px-2"
			ref={containerRef}
		/>
	)
}
