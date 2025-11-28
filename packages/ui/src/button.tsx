import { splitProps } from 'solid-js'
import type { JSX, ParentComponent } from 'solid-js'

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button: ParentComponent<ButtonProps> = props => {
	const [local, rest] = splitProps(props, ['children', 'class', 'type'])
	const baseClasses =
		'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-indigo-500/50 transition duration-150 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60'
	const mergedClass = local.class ? `${baseClasses} ${local.class}` : baseClasses

	return (
		<button
			type={local.type ?? 'button'}
			class={mergedClass}
			{...rest}
		>
			{local.children}
		</button>
	)
}
