import { JSX } from 'solid-js'

export const SQUIGGLY_COLORS = {
	error: '#ef4444',
	warning: '#eab308',
	info: '#3b82f6',
	spelling: '#3b82f6'
} as const

export type SquigglyLevel = keyof typeof SQUIGGLY_COLORS

export type SquigglyLineProps = {
	level?: SquigglyLevel
	children: JSX.Element
}

export const SquigglyLine = (props: SquigglyLineProps) => {
	return (
		<span
			style={{
				'text-decoration-line': 'underline',
				'text-decoration-style': 'wavy',
				'text-decoration-color': SQUIGGLY_COLORS[props.level ?? 'error'],
				'text-decoration-thickness': '1px'
			}}
		>
			{props.children}
		</span>
	)
}
