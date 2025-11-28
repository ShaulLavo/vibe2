import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import devtools from 'solid-devtools/vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
	const envDir = path.resolve(__dirname, '..', '..')
	const env = loadEnv(mode, envDir, '')
	const webPort = Number(env.VITE_WEB_PORT ?? env.PORT) || 3000
	return {
		envDir,
		plugins: [tailwindcss(), devtools(), solidPlugin()],
		server: {
			port: webPort
		},
		build: {
			target: 'esnext'
		}
	}
})
