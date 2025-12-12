import { cyan, dim, green, magenta, yellow } from 'ansis'

const promptUser = 'guest'
const promptHost = 'vibe'
const promptPath = '~'

const formatTime = (timestamp: Date): string => {
	const hours = timestamp.getHours().toString().padStart(2, '0')
	const minutes = timestamp.getMinutes().toString().padStart(2, '0')
	const seconds = timestamp.getSeconds().toString().padStart(2, '0')
	return `${hours}:${minutes}:${seconds}`
}

export interface TerminalPrompt {
	label: string
	continuation: string
}

export const createPrompt = (): TerminalPrompt => {
	const now = formatTime(new Date())
	const timestamp = dim(`[${now}]`)
	const identity = `${cyan(promptUser)}${dim('@')}${magenta(promptHost)}`
	const location = `${dim(':')}${yellow(promptPath)}`
	const symbol = green('$')

	return {
		label: `${timestamp} ${identity}${location} ${symbol} `,
		continuation: dim('... ')
	}
}
