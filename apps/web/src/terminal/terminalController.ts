// import { FitAddon } from '@xterm/addon-fit'
import {
	Terminal as Ghostty,
	init,
	FitAddon,
	type CanvasRenderer,
} from 'ghostty-web'
import { LocalEchoController } from './localEcho'
import { handleCommand, type CommandContext } from './commands'
import type { TerminalPrompt } from './prompt'
import type { ThemePalette } from '@repo/theme'

export type TerminalController = Awaited<
	ReturnType<typeof createTerminalController>
>

type TerminalControllerOptions = {
	getPrompt: () => TerminalPrompt
	commandContext: Omit<CommandContext, 'localEcho' | 'term'>
	theme: ThemePalette
	/** Whether to focus the terminal on mount. Default: true */
	focusOnMount?: boolean
}

export const createTerminalController = async (
	container: HTMLDivElement,
	options: TerminalControllerOptions
) => {
	let disposed = false
	let initialFitRaf: number | null = null

	try {
		await init()
	} catch (error) {
		console.error('Failed to initialize terminal', error)
		throw new Error('terminal initialization failed', { cause: error })
	}
	const term = new Ghostty({
		convertEol: true,
		cursorBlink: true,
		fontSize: 14,
		fontFamily: 'JetBrains Mono Variable, monospace',
		theme: {
			background: options.theme.terminal.background,
			foreground: options.theme.terminal.foreground,
			black: options.theme.terminal.black,
			red: options.theme.terminal.red,
			green: options.theme.terminal.green,
			yellow: options.theme.terminal.yellow,
			blue: options.theme.terminal.blue,
			magenta: options.theme.terminal.magenta,
			cyan: options.theme.terminal.cyan,
			white: options.theme.terminal.white,
			cursor: options.theme.terminal.cursor,
			brightBlack: options.theme.terminal.brightBlack,
			brightRed: options.theme.terminal.brightRed,
			brightGreen: options.theme.terminal.brightGreen,
			brightYellow: options.theme.terminal.brightYellow,
			brightBlue: options.theme.terminal.brightBlue,
			brightMagenta: options.theme.terminal.brightMagenta,
			brightCyan: options.theme.terminal.brightCyan,
			brightWhite: options.theme.terminal.brightWhite,
		},
	})

	const fitAddon = new FitAddon()
	const echoAddon = new LocalEchoController()

	term.loadAddon(fitAddon)
	term.loadAddon(echoAddon)

	const remeasureRendererFont = () => {
		const renderer = term.renderer as CanvasRenderer | undefined
		renderer?.remeasureFont()
	}

	const startPromptLoop = async () => {
		while (!disposed) {
			const { label, continuation } = options.getPrompt()
			try {
				const input = await echoAddon.read(label, continuation)
				await handleCommand(input, {
					localEcho: echoAddon,
					term,
					...options.commandContext,
				})
			} catch {
				break
			}
		}
	}

	const fit = () => {
		if (!disposed) fitAddon.fit()
	}
	const handleResize = () => {
		remeasureRendererFont()
		fit()
	}

	const viewport = typeof window !== 'undefined' ? window.visualViewport : null
	const handleViewportResize = () => handleResize()

	term.open(container)
	remeasureRendererFont()
	{
		const observeResize = fitAddon.observeResize
		observeResize.call(fitAddon)

		initialFitRaf = requestAnimationFrame(() => {
			fit()
			// 2nd pass to catch late layout/font metric settling
			initialFitRaf = requestAnimationFrame(() => {
				fit()
				initialFitRaf = null
			})
		})
	}
	if (options.focusOnMount !== false) {
		term.focus()
	}

	echoAddon.println('Welcome to vibe shell')
	echoAddon.println('Type `help` to see available commands.')
	window.addEventListener('resize', handleResize)
	viewport?.addEventListener('resize', handleViewportResize)
	void startPromptLoop()

	return {
		fit,
		dispose: () => {
			disposed = true
			if (initialFitRaf !== null) {
				cancelAnimationFrame(initialFitRaf)
				initialFitRaf = null
			}
			window.removeEventListener('resize', handleResize)
			viewport?.removeEventListener('resize', handleViewportResize)
			echoAddon.abortRead('terminal disposed')
			echoAddon.dispose()
			term.dispose()
		},
	}
}
