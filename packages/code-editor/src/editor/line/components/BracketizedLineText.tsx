import { createMemo, type Accessor, type JSX } from 'solid-js'
import type { BracketDepthMap, LineHighlightSegment } from '../../types'

const BRACKET_COLOR_CLASSES = [
	'text-emerald-300',
	'text-sky-300',
	'text-indigo-300',
	'text-rose-300',
	'text-amber-300',
	'text-lime-300'
] as const

const getBracketClass = (depth: number) => {
	const normalized = Math.max(depth - 1, 0)
	return BRACKET_COLOR_CLASSES[normalized % BRACKET_COLOR_CLASSES.length]!
}

type BracketizedLineTextProps = {
	text: string
	lineStart: number
	bracketDepths: Accessor<BracketDepthMap | undefined>
	highlightSegments?: LineHighlightSegment[]
}

export const BracketizedLineText = (props: BracketizedLineTextProps) => {
	const renderBracketizedSlice = (
		start: number,
		end: number,
		depthMap: BracketDepthMap | undefined
	): string | (string | JSX.Element)[] | JSX.Element => {
		if (start >= end) return ''
		const text = props.text
		if (!depthMap || text.length === 0) {
			return text.slice(start, end)
		}

		const bracketSegments: (string | JSX.Element)[] = []
		let cursor = start

		for (let i = start; i < end; i++) {
			const absoluteIndex = props.lineStart + i
			const depth = depthMap[absoluteIndex]
			if (!depth) continue

			if (cursor < i) {
				bracketSegments.push(text.slice(cursor, i))
			}

			const className = getBracketClass(depth)
			bracketSegments.push(
				<span
					class={className}
					data-depth={depth}
					data-bracket-index={absoluteIndex}
				>
					{text[i]}
				</span>
			)
			cursor = i + 1
		}

		if (!bracketSegments.length) {
			return text.slice(start, end)
		}

		if (cursor < end) {
			bracketSegments.push(text.slice(cursor, end))
		}

		return bracketSegments
	}

	const renderSlice = (
		start: number,
		end: number,
		depthMap: BracketDepthMap | undefined,
		highlightClass?: string,
		scope?: string
	) => {
		if (start >= end) return ''
		const content = renderBracketizedSlice(start, end, depthMap)
		if (!highlightClass) {
			return content
		}

		return (
			<span class={highlightClass} data-highlight-scope={scope}>
				{content}
			</span>
		)
	}

	const segments = createMemo(() => {
		const text = props.text
		const depthMap = props.bracketDepths()
		if (text.length === 0) {
			return ''
		}

		const highlightSegments = props.highlightSegments
		if (!highlightSegments || highlightSegments.length === 0) {
			return renderSlice(0, text.length, depthMap)
		}

		const normalized = highlightSegments
			.map(segment => {
				const start = Math.max(0, Math.min(text.length, segment.start))
				const end = Math.max(start, Math.min(text.length, segment.end))
				return {
					start,
					end,
					className: segment.className,
					scope: segment.scope
				}
			})
			.filter(segment => segment.end > segment.start)
			.sort((a, b) => a.start - b.start)

		if (!normalized.length) {
			return renderSlice(0, text.length, depthMap)
		}

		const output: (string | JSX.Element)[] = []
		let cursor = 0

		for (const segment of normalized) {
			const clampedStart = Math.max(cursor, segment.start)
			if (cursor < clampedStart) {
				const before = renderSlice(cursor, clampedStart, depthMap)
				if (before !== '') {
					output.push(before)
				}
			}
			const token = renderSlice(
				clampedStart,
				segment.end,
				depthMap,
				segment.className,
				segment.scope
			)
			if (token !== '') {
				output.push(token)
			}
			cursor = Math.max(cursor, segment.end)
		}

		if (cursor < text.length) {
			const tail = renderSlice(cursor, text.length, depthMap)
			if (tail !== '') {
				output.push(tail)
			}
		}

		return output
	})

	return <>{segments()}</>
}
