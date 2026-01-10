import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { env } from './env'
import { serverLogger } from './logger'
import { routes } from './routes'

const app = new Elysia()
	.use(
		cors({
			origin: env.webOrigin,
			methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
			allowedHeaders: ['authorization', 'content-type', 'git-protocol'],
			exposeHeaders: ['content-type', 'content-encoding', 'cache-control'],
			credentials: false,
			preflight: true,
		})
	)
	.use(routes)
	.listen(env.serverPort)

serverLogger.ready(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

export { app }
export type App = typeof app
