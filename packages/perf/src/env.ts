import { z } from 'zod'

type EnvRecord = Record<string, string | undefined>

const getProcessEnv = (): EnvRecord => {
	if (typeof globalThis === 'undefined') return {}
	const maybeProcess = (globalThis as { process?: { env?: EnvRecord } }).process
	return maybeProcess?.env ?? {}
}

const getImportMetaEnv = (): EnvRecord => {
	try {
		return import.meta.env ?? {}
	} catch {
		return {}
	}
}

const booleanString = z.stringbool().optional()

const envSchema = z.object({
	PERF_TRACKING_ENABLED: booleanString,
	VITE_PERF_TRACKING: booleanString
})

const envData = envSchema.parse({
	...getImportMetaEnv(),
	...getProcessEnv()
})

export const perfEnv = {
	perfTrackingEnabled:
		envData.PERF_TRACKING_ENABLED ?? envData.VITE_PERF_TRACKING ?? false
}

export type PerfEnv = typeof perfEnv
