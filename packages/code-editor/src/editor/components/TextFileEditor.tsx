import { createMemo } from 'solid-js'
import { trackSync } from '@repo/perf'
import { loggers } from '@repo/logger'
import { getPieceTableText } from '@repo/utils'
import { computeBracketDepths, textToLineEntries } from '../utils'
import { toLineHighlightSegments } from '../utils/highlights'
import { CursorProvider } from '../cursor'
import { HistoryProvider } from '../history'
import { TextFileEditorInner } from './TextFileEditorInner'
import type {
	LineEntry,
	LineHighlightSegment,
	TextFileEditorProps
} from '../types'

const textFileEditorLogger = loggers.codeEditor.withTag('TextFileEditor')

export const TextFileEditor = (props: TextFileEditorProps) => {
	const pieceTableText = createMemo(() => {
		const snapshot = props.document.pieceTable()
		if (snapshot) {
			return getPieceTableText(snapshot)
		}
		return props.document.content()
	})

	const lineEntries = createMemo<LineEntry[]>(() => {
		if (!props.isFileSelected()) return []
		return textToLineEntries(pieceTableText())
	})

		const bracketDepths = createMemo(() => {
			if (!props.isFileSelected()) return undefined
		const text = pieceTableText()
		if (!text || text.length === 0) return undefined
		const stats = props.stats()
		const rules = stats?.language.rules
		const filePath = props.document.filePath()
		const metadata = {
			filePath,
			textLength: text.length
		}
			return trackSync(
				'code-editor:computeBracketDepths',
				() => {
					const result = computeBracketDepths(text, {
						angleBrackets: rules?.angleBrackets,
						stringRules: rules?.strings
					})
					return result
				},
				{
					metadata,
					persist: false,
				logger: textFileEditorLogger
			}
		)
		})

		const lineHighlights = createMemo<LineHighlightSegment[][]>(() => {
			if (!props.isFileSelected()) return []
			const entries = lineEntries()
			const captures = props.highlights?.()
			if (!captures?.length || !entries.length) return []
			return toLineHighlightSegments(entries, captures)
		})

		const getLineHighlights = (lineIndex: number) =>
			lineHighlights()[lineIndex]

		const documentLength = createMemo(() => pieceTableText().length)

	return (
		<CursorProvider
			filePath={() => props.document.filePath()}
			lineEntries={lineEntries}
			documentText={pieceTableText}
			documentLength={documentLength}
		>
			<HistoryProvider document={props.document}>
					<TextFileEditorInner
						{...props}
						bracketDepths={bracketDepths}
						getLineHighlights={getLineHighlights}
					/>
			</HistoryProvider>
		</CursorProvider>
	)
}
