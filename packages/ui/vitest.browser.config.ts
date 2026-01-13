import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import solidPlugin from 'vite-plugin-solid'
import path from 'path'

export default defineConfig({
	plugins: [solidPlugin()],
	resolve: {
		conditions: ['vdev'],
		alias: {
			'vitest-browser-solid': path.resolve(__dirname, '../vitest-browser-solid/src/index.ts'),
		},
	},
	optimizeDeps: {
		exclude: ['vitest-browser-solid'],
	},
	test: {
		include: ['src/**/*.browser.test.{ts,tsx}'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }],
		},
		server: {
			deps: {
				inline: ['solid-js', 'vitest-browser-solid'],
			},
		},
	},
})
