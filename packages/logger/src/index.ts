import {
	createConsola,
	type ConsolaInstance,
	type ConsolaOptions
} from 'consola'

const consola = createConsola({
	// `fancy` is a node-only flag that isn't exposed in the browser .d.ts, so cast.
	fancy: true
} as Partial<ConsolaOptions> & { fancy: boolean })

const DEFAULT_LEVEL = 4

if (typeof consola.level === 'number') {
	consola.level = DEFAULT_LEVEL
}

export type LoggerScope = 'server' | 'web' | 'desktop' | 'app' | (string & {})

const DEFAULT_SCOPE: LoggerScope = 'app'
const instances = new Map<string, ConsolaInstance>()
const FORWARDED_METHODS = new Set([
	'trace',
	'debug',
	'info',
	'log',
	'success',
	'warn',
	'error',
	'fatal',
	'ready',
	'start',
	'box'
])

export type LogForwarderEntry = {
	tag: string
	level: string
	args: unknown[]
}

type LogForwarder = (entry: LogForwarderEntry) => void

let logForwarder: LogForwarder | undefined

const createForwardingProxy = (
	instance: ConsolaInstance,
	tag: string
): ConsolaInstance => {
	return new Proxy(instance, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver)
			if (
				typeof prop === 'string' &&
				typeof value === 'function' &&
				FORWARDED_METHODS.has(prop)
			) {
				return (...args: unknown[]) => {
					if (logForwarder) {
						try {
							logForwarder({ tag, level: prop, args })
						} catch {
							// Swallow forwarding issues to avoid breaking logs
						}
					}

					return value.apply(target, args)
				}
			}

			return typeof value === 'function' ? value.bind(target) : value
		}
	})
}

export const setLogForwarder = (forwarder?: LogForwarder) => {
	logForwarder = forwarder
}

const getLoggerInstance = (tag: string): ConsolaInstance => {
	const existing = instances.get(tag)
	if (existing) return existing

	const raw = consola.withTag(tag)
	const proxied = createForwardingProxy(raw, tag)
	instances.set(tag, proxied)
	return proxied
}

const buildTag = (scopes: readonly LoggerScope[]): string => {
	const normalized = scopes
		.map(scope => scope?.trim())
		.filter((scope): scope is string => Boolean(scope && scope.length))

	return (normalized.length ? normalized : [DEFAULT_SCOPE]).join(':')
}

export const createLogger = (...scopes: LoggerScope[]): ConsolaInstance => {
	const tag = buildTag(scopes)

	return getLoggerInstance(tag)
}

export const createLoggerFactory = (
	...baseScopes: LoggerScope[]
): ((...scopes: LoggerScope[]) => ConsolaInstance) => {
	return (...scopes: LoggerScope[]) => createLogger(...baseScopes, ...scopes)
}

export const logger = createLogger()
export type Logger = ConsolaInstance
