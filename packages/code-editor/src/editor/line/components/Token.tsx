import { Match, Switch } from 'solid-js'
import { getBracketDepthTextClass } from '../../theme/bracketColors'
import type { TextRun } from '../utils/textRuns'

export const Token = (props: TextRun) => {
	const hasDepth = () => props.depth !== undefined && props.depth > 0
	const hasHighlight = () => Boolean(props.highlightClass)

	return (
		<Switch fallback={props.text}>
			<Match when={hasDepth() && !hasHighlight()}>
				<span
					class={getBracketDepthTextClass(props.depth!)}
					data-depth={props.depth}
				>
					{props.text}
				</span>
			</Match>

			<Match when={!hasDepth() && hasHighlight()}>
				<span
					class={props.highlightClass}
					data-highlight-scope={props.highlightScope}
				>
					{props.text}
				</span>
			</Match>

			<Match when={hasDepth() && hasHighlight()}>
				<span
					class={props.highlightClass}
					data-highlight-scope={props.highlightScope}
				>
					<span
						class={getBracketDepthTextClass(props.depth!)}
						data-depth={props.depth}
					>
						{props.text}
					</span>
				</span>
			</Match>
		</Switch>
	)
}
