import { Match, Switch } from 'solid-js'
import { getBracketDepthTextClass } from '../../theme/bracketColors'
import type { TextRun } from '../utils/textRuns'

type TokenProps = {
	run: TextRun
}

export const Token = (props: TokenProps) => {
	const hasDepth = () => props.run.depth !== undefined && props.run.depth > 0
	const hasHighlight = () => Boolean(props.run.highlightClass)

	return (
		<Switch fallback={props.run.text}>
			<Match when={hasDepth() && !hasHighlight()}>
				<span
					class={getBracketDepthTextClass(props.run.depth!)}
					data-depth={props.run.depth}
				>
					{props.run.text}
				</span>
			</Match>

			<Match when={!hasDepth() && hasHighlight()}>
				<span
					class={props.run.highlightClass}
					data-highlight-scope={props.run.highlightScope}
				>
					{props.run.text}
				</span>
			</Match>

			<Match when={hasDepth() && hasHighlight()}>
				<span
					class={props.run.highlightClass}
					data-highlight-scope={props.run.highlightScope}
				>
					<span
						class={getBracketDepthTextClass(props.run.depth!)}
						data-depth={props.run.depth}
					>
						{props.run.text}
					</span>
				</span>
			</Match>
		</Switch>
	)
}
