import type {
	EditorSyntaxHighlight,
	LineEntry,
	LineHighlightSegment
} from '../types'

const EXACT_SCOPE_CLASS: Record<string, string> = {
	comment: 'text-zinc-500',
	'comment.block': 'text-zinc-500',
	'comment.line': 'text-zinc-500',
	'keyword.control': 'text-emerald-300',
	'keyword.operator': 'text-emerald-300',
	'keyword.import': 'text-emerald-300',
	'type.builtin': 'text-sky-300',
	'type.parameter': 'text-sky-300',
	'variable.parameter': 'text-pink-300',
	'variable.builtin': 'text-orange-300',
	'punctuation.bracket': 'text-zinc-300'
}

const PREFIX_SCOPE_CLASS: Record<string, string> = {
	keyword: 'text-emerald-300',
	type: 'text-sky-300',
	function: 'text-rose-200',
	method: 'text-rose-200',
	property: 'text-purple-200',
	string: 'text-amber-200',
	number: 'text-indigo-200',
	operator: 'text-zinc-300',
	comment: 'text-zinc-500',
	constant: 'text-fuchsia-300',
	variable: 'text-zinc-200',
	punctuation: 'text-zinc-300',
	attribute: 'text-teal-200',
	namespace: 'text-cyan-200'
}

const getHighlightClassForScope = (scope: string): string | undefined => {
	if (!scope) return undefined
	if (EXACT_SCOPE_CLASS[scope]) {
		return EXACT_SCOPE_CLASS[scope]
	}
	const prefix = scope.split('.')[0] ?? ''
	return PREFIX_SCOPE_CLASS[prefix]
}

const clampToLine = (
	entry: LineEntry,
	absoluteStart: number,
	absoluteEnd: number
): [number, number] | null => {
	const lineStart = entry.start
	const visibleLength = entry.text.length
	const lineAbsoluteEnd = lineStart + entry.length
	const start = Math.max(absoluteStart, lineStart)
	const end = Math.min(absoluteEnd, lineAbsoluteEnd)
	const relativeStart = Math.max(0, Math.min(visibleLength, start - lineStart))
	const relativeEnd = Math.max(0, Math.min(visibleLength, end - lineStart))
	if (relativeStart >= relativeEnd) {
		return null
	}
	return [relativeStart, relativeEnd]
}

const advanceToLineIndex = (
	lineEntries: LineEntry[],
	currentIndex: number,
	position: number
) => {
	let index = Math.max(0, currentIndex)
	while (index < lineEntries.length) {
		const entry = lineEntries[index]
		const lineEnd = entry.start + entry.length
		if (position < lineEnd || index === lineEntries.length - 1) {
			return index
		}
		index++
	}
	return Math.max(0, lineEntries.length - 1)
}

export const toLineHighlightSegments = (
	lineEntries: LineEntry[],
	highlights: EditorSyntaxHighlight[] | undefined
): LineHighlightSegment[][] => {
	if (!highlights?.length || !lineEntries.length) {
		return []
	}

	const perLine: LineHighlightSegment[][] = new Array(lineEntries.length)
	let lineIndex = 0

	for (const highlight of highlights) {
		if (
			highlight.startIndex === undefined ||
			highlight.endIndex === undefined ||
			highlight.endIndex <= highlight.startIndex
		) {
			continue
		}

		const className = getHighlightClassForScope(highlight.scope)
		if (!className) continue

		let start = Math.max(0, highlight.startIndex)
		const end = Math.max(start, highlight.endIndex)
		lineIndex = advanceToLineIndex(lineEntries, lineIndex, start)

		let cursor = lineIndex
		while (cursor < lineEntries.length && start < end) {
			const entry = lineEntries[cursor]
			if (!entry) break
			const lineAbsoluteEnd = entry.start + entry.length
			if (start >= lineAbsoluteEnd) {
				cursor++
				continue
			}
			const clamped = clampToLine(entry, start, end)
			if (clamped) {
				const [relativeStart, relativeEnd] = clamped
				;(perLine[cursor] ??= []).push({
					start: relativeStart,
					end: relativeEnd,
					className,
					scope: highlight.scope
				})
			}
			if (end <= lineAbsoluteEnd) {
				break
			}
			start = lineAbsoluteEnd
			cursor++
		}

		lineIndex = cursor
	}

	for (const segments of perLine) {
		if (segments && segments.length > 1) {
			segments.sort((a, b) => a.start - b.start)
		}
	}

	return perLine
}
