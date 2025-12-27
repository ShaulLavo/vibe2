import { ThemeMode, useTheme } from '@repo/theme'
import { FiMonitor, FiMoon, FiSun } from '@repo/icons/fi'
import { Match, Switch, type JSX } from 'solid-js'

export type ModeToggleProps = {
	ref?: (el: HTMLButtonElement) => void
	onClick?: () => void
	class?: string
}

export const ModeToggle = (props: ModeToggleProps) => {
	const { mode, setMode, isDark } = useTheme()

	const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = () => {
		if (props.onClick) {
			props.onClick()
		} else {
			const modes: ThemeMode[] = ['light', 'dark', 'system']
			const nextMode = modes[(modes.indexOf(mode()) + 1) % modes.length]
			setMode(nextMode!)
		}
	}

	const showSystemIcon = () =>
		mode() === 'system' && (typeof window === 'undefined' || !window.matchMedia)

	return (
		<button
			ref={props.ref}
			onClick={handleClick}
			class={
				props.class ??
				'ml-auto flex items-center gap-1.5 rounded border border-border/30 bg-background px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-foreground transition hover:opacity-80'
			}
		>
			<Switch fallback={<FiSun class="h-3 w-3" />}>
				<Match when={showSystemIcon()}>
					<FiMonitor class="h-3 w-3" />
				</Match>
				<Match when={isDark()}>
					<FiMoon class="h-3 w-3" />
				</Match>
			</Switch>
			{mode()}
		</button>
	)
}
