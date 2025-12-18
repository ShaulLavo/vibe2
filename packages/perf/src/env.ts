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

const envSchema = z.object({
	PERF_TRACKING_ENABLED: z.stringbool().optional(),
	VITE_PERF_TRACKING: z.stringbool().optional(),
})

let envData: z.infer<typeof envSchema>
try {
	envData = envSchema.parse({
		...getImportMetaEnv(),
		...getProcessEnv(),
	})
} catch (error) {
	throw new Error(z.prettifyError(error as z.ZodError))
}

export const perfEnv = {
	perfTrackingEnabled:
		envData.PERF_TRACKING_ENABLED ?? envData.VITE_PERF_TRACKING ?? false,
}

export type PerfEnv = typeof perfEnv
