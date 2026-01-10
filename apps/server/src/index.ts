import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { env } from './env'
import { serverLogger } from './logger'
import { getExtractedFont, getNerdFontLinks } from './fonts'

const isAllowedGitHost = (host: string) => {
	if (env.gitProxyAllowedHosts.length === 0) return false
	return env.gitProxyAllowedHosts.some(
		(allowed) => host === allowed || host.endsWith(`.${allowed}`)
	)
}

const buildGitProxyHeaders = (source: Headers) => {
	const headers = new Headers()
	const allowed = ['accept', 'content-type', 'git-protocol', 'authorization']
	for (const name of allowed) {
		const value = source.get(name)
		if (value) headers.set(name, value)
	}
	return headers
}

const buildGitProxyResponse = (upstream: Response) => {
	const headers = new Headers()
	const allowed = ['content-type', 'content-encoding', 'cache-control']
	for (const name of allowed) {
		const value = upstream.headers.get(name)
		if (value) headers.set(name, value)
	}
	return new Response(upstream.body, {
		status: upstream.status,
		headers,
	})
}

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
	.all('/git/proxy', async ({ request, set }) => {
		const requestUrl = new URL(request.url)
		const urlParam = requestUrl.searchParams.get('url')
		const rawSearch = requestUrl.search
		const proxiedUrl =
			urlParam ??
			(rawSearch && rawSearch.startsWith('?') && !rawSearch.startsWith('?url=')
				? decodeURIComponent(rawSearch.slice(1))
				: undefined)
		if (!proxiedUrl) {
			set.status = 400
			return 'Missing url query param'
		}

		let target: URL
		try {
			target = new URL(proxiedUrl)
		} catch {
			set.status = 400
			return 'Invalid url'
		}

		if (!isAllowedGitHost(target.host)) {
			set.status = 403
			return 'Host not allowed'
		}

		const method = request.method.toUpperCase()
		const allowedMethods = ['GET', 'POST', 'HEAD']
		if (!allowedMethods.includes(method)) {
			set.status = 405
			return 'Method not allowed'
		}

		console.log(
			'[git-proxy] request',
			JSON.stringify({ method, url: target.toString() }, null, 2)
		)

		const upstream = await fetch(target.toString(), {
			method,
			headers: buildGitProxyHeaders(request.headers),
			body:
				method === 'GET' || method === 'HEAD'
					? undefined
					: request.body ?? undefined,
		})
		console.log(
			'[git-proxy] response',
			JSON.stringify(
				{ status: upstream.status, url: target.toString() },
				null,
				2
			)
		)

		return buildGitProxyResponse(upstream)
	})

serverLogger.ready(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

export type App = typeof app
