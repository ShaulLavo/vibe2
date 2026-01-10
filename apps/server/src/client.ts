import { treaty } from '@elysiajs/eden'
import type { App } from './index'
import { env } from './env'

/**
 * Create a type-safe Eden Treaty client for the Elysia server
 * @param baseUrl - Optional custom base URL (defaults to server port from env)
 */
export const createClient = (baseUrl?: string) =>
	treaty<App>(baseUrl ?? `http://localhost:${env.serverPort}`)

export type Client = ReturnType<typeof createClient>

// Default client instance
export const client = createClient()
