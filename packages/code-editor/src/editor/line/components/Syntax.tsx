import { For } from 'solid-js'
import type { LineBracketDepthMap, LineHighlightSegment } from '../../types'
import { useTextRuns } from '../hooks/useTextRuns'
import { Token } from './Token'

type SyntaxProps = {
	text: string
	bracketDepths?: LineBracketDepthMap
	highlightSegments?: LineHighlightSegment[]
	columnStart?: number
	columnEnd?: number
}

/**
 * Renders a line of text with syntax highlighting and bracket coloring.
 * Text is grouped into styled "runs" for efficient DOM rendering.
 */
export const Syntax = (props: SyntaxProps) => {
	const runs = useTextRuns({
		text: () => props.text,
		bracketDepths: () => props.bracketDepths,
		highlightSegments: () => props.highlightSegments,
		columnStart: () => props.columnStart,
		columnEnd: () => props.columnEnd,
	})

	return <For each={runs()}>{(run) => <Token run={run} />}</For>
}
