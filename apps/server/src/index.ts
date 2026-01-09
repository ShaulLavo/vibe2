import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { env } from './env'
import { serverLogger } from './logger'
import { getExtractedFont, getNerdFontLinks } from './fonts'

const app = new Elysia()
	.use(
		cors({
			origin: env.webOrigin,
		})
	)
	.get('/', () => 'Hi Elysia')
	.get('/id/:id', ({ params: { id } }) => id)
	.post('/mirror', ({ body }) => body, {
		body: t.Object({
			id: t.Number(),
			name: t.String(),
		}),
	})
	.listen(env.serverPort)
	.get('/fonts', async () => {
		const links = await getNerdFontLinks()
		return links
	})
	.get('/fonts/:name', async ({ params: { name }, set }) => {
		const font = await getExtractedFont(name)
		if (!font) {
			set.status = 404
			return 'Font not found'
		}
		return new Response(font, {
			headers: {
				'Content-Type': 'font/ttf',
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		})
	})

serverLogger.ready(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

export type App = typeof app
