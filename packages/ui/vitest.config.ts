import { defineConfig } from 'vitest/config'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
	plugins: [solidPlugin()],
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.{ts,tsx}'],
		exclude: ['**/*.browser.test.{ts,tsx}', '**/node_modules/**'],
		server: {
			deps: {
				inline: ['solid-js'],
			},
		},
	},
})
