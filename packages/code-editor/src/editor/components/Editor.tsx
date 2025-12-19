import type { EditorProps } from '../types'
import { CursorProvider } from '../cursor'
import { HistoryProvider } from '../history'
import { TextEditorView } from './TextEditorView'

export const Editor = (props: EditorProps) => {
	return (
		<CursorProvider
			filePath={props.document.filePath}
			isFileSelected={props.isFileSelected}
			content={props.document.content}
			pieceTable={props.document.pieceTable}
		>
			<HistoryProvider document={props.document}>
				<TextEditorView {...props} />
			</HistoryProvider>
		</CursorProvider>
	)
}
