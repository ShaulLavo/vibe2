import { z } from 'zod'

type EnvRecord = Record<string, string | undefined>

const getProcessEnv = (): EnvRecord => {
	if (typeof process === 'undefined') return {}
	return process.env as EnvRecord
}

const normalizeConcurrency = (value?: number) => {
	return Number.isFinite(value) && (value as number) > 0 ? (value as number) : 4
}

const normalizePack = (value?: string | null) => {
	const trimmed = value?.trim()
	return trimmed && trimmed.length > 0 ? trimmed : null
}
const envSchema = z.object({
	ICONS_ISOLATE: z.string().optional().transform(normalizePack),
	ICONS_FETCH_CONCURRENCY: z
		.string()
		.optional()
		.transform((value) => (value ? Number.parseInt(value, 10) : undefined))
		.transform(normalizeConcurrency),
})

const envData = envSchema.parse(getProcessEnv())

export const iconsEnv = {
	isolatePack: envData.ICONS_ISOLATE,
	fetchConcurrency: envData.ICONS_FETCH_CONCURRENCY,
}

export type IconsEnv = typeof iconsEnv
