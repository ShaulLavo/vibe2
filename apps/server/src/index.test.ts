import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { routes } from './routes'

// Create a test app with all routes
const app = new Elysia().use(routes)

describe('Server Routes', () => {
	describe('Fonts Routes', () => {
		it('should respond to GET /fonts', async () => {
			const response = await app.handle(new Request('http://localhost/fonts'))
			expect(response.status).toBe(200)
		})

		it('should respond to GET /fonts/:name', async () => {
			const response = await app.handle(
				new Request('http://localhost/fonts/TestFont')
			)
			// 404 is expected for non-existent font
			expect([200, 404]).toContain(response.status)
		})

		it('should respond to GET /fonts/:name/preview', async () => {
			const response = await app.handle(
				new Request('http://localhost/fonts/TestFont/preview')
			)
			expect([200, 404]).toContain(response.status)
		})
	})

	describe('Git Routes', () => {
		it('should respond to GET /git/proxy without url', async () => {
			const response = await app.handle(
				new Request('http://localhost/git/proxy')
			)
			expect(response.status).toBe(400)
		})
	})
})
