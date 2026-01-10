import { Elysia, t } from 'elysia'
import { getExtractedFont, getNerdFontLinks, getPreviewSubset } from '../fonts'

export const fontsRoutes = new Elysia({ prefix: '/fonts' })
	.get('/', async () => {
		const links = await getNerdFontLinks()
		return links
	})
	.get(
		'/:name/preview',
		async ({ params: { name }, query, set }) => {
			const text = query.text || 'The quick brown fox jumps 0123'
			const subset = await getPreviewSubset(name, text)

			if (!subset) {
				set.status = 404
				return 'Font not found'
			}

			return new Response(new Uint8Array(subset), {
				headers: {
					'Content-Type': 'font/woff2',
					'Cache-Control': 'public, max-age=86400', // 24h cache
				},
			})
		},
		{
			query: t.Object({
				text: t.Optional(t.String()),
			}),
		}
	)
	.get('/:name', async ({ params: { name }, set }) => {
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
