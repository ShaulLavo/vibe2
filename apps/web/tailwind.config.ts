import type { Config } from 'tailwindcss'

export default {
	content: [
		'./index.html',
		'./src/**/*.{js,ts,jsx,tsx}',
		'../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
		'../../packages/code-editor/src/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			fontSize: {
				'ui': 'var(--ui-font-size, var(--base-font-size))',
				'ui-xs': 'calc(var(--ui-font-size, var(--base-font-size)) * var(--font-scale-xs))',
				'ui-sm': 'calc(var(--ui-font-size, var(--base-font-size)) * var(--font-scale-sm))',
				'ui-lg': 'calc(var(--ui-font-size, var(--base-font-size)) * var(--font-scale-lg))',
				'ui-xl': 'calc(var(--ui-font-size, var(--base-font-size)) * var(--font-scale-xl))',
				'editor': 'var(--editor-font-size, var(--base-font-size))',
				'editor-xs': 'calc(var(--editor-font-size, var(--base-font-size)) * var(--font-scale-xs))',
			},
		},
	},
} satisfies Config
