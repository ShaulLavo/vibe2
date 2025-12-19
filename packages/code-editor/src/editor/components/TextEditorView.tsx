import {
	Show,
	createEffect,
	createSignal,
	onCleanup,
	untrack,
} from 'solid-js'
import { DEFAULT_TAB_SIZE } from '../consts'
import { useCursor } from '../cursor'
import { Lexer, type LineState } from '@repo/lexer'
import { getPieceTableText, type PieceTableSnapshot } from '@repo/utils'
import {
	createCursorScrollSync,
	createMouseSelection,
	createTextEditorInput,
	createTextEditorLayout,
	createLineHighlights,
	useFoldedStarts,
	useStartBenchmark,
	useVisibleBracketDepths,
} from '../hooks'
import { EditorViewport } from './EditorViewport'
import type { DocumentIncrementalEdit, EditorProps } from '../types'

export const TextEditorView = (props: EditorProps) => {
	const cursor = useCursor()
	const lexer = Lexer.create()
	let lexerStatesPath: string | undefined
	let lastLexedPieceTable: PieceTableSnapshot | undefined

	const tabSize = () => props.tabSize?.() ?? DEFAULT_TAB_SIZE
	const [scrollElement, setScrollElement] = createSignal<HTMLDivElement | null>(
		null
	)

	useStartBenchmark({ scrollElement })

	let inputElement: HTMLTextAreaElement | null = null
	const setInputElement = (element: HTMLTextAreaElement) => {
		inputElement = element
	}

	const isEditable = () => props.document.isEditable()

	const lexerStates = (): LineState[] | undefined => {
		const selected = props.isFileSelected()
		const path = props.document.filePath()
		const pieceTable = cursor.lines.pieceTable()
		cursor.lines.lineStarts()

		const hasPath = Boolean(path)
		const isReady = selected && hasPath && isEditable()

		if (isReady === false) {
			const hasCachedPath = Boolean(lexerStatesPath)
			const hasCachedStates = lexer.getAllLineStates().length > 0
			const hasCachedPieceTable = Boolean(lastLexedPieceTable)
			const shouldReset =
				hasCachedPath || hasCachedStates || hasCachedPieceTable

			if (shouldReset) {
				lexerStatesPath = undefined
				lastLexedPieceTable = undefined
				lexer.setLineStates([])
			}
			return undefined
		}

		const hasPathChanged = lexerStatesPath !== path
		const hasLineStates = lexer.getAllLineStates().length > 0
		const isPieceTableInSync = pieceTable === lastLexedPieceTable
		const shouldRecomputeAll =
			hasPathChanged || hasLineStates === false || isPieceTableInSync === false

		if (shouldRecomputeAll) {
			lexerStatesPath = path
			const content = pieceTable
				? getPieceTableText(pieceTable)
				: untrack(() => props.document.content())
			const nextStates = lexer.computeAllStates(content)
			lastLexedPieceTable = pieceTable
			return nextStates
		}

		return lexer.getAllLineStates()
	}

	const applyLexerEdit = (edit: DocumentIncrementalEdit) => {
		const lineCount = cursor.lines.lineStarts().length
		if (lineCount <= 0) return

		if (lexer.getAllLineStates().length === 0) {
			const pieceTable = cursor.lines.pieceTable()
			const content = pieceTable
				? getPieceTableText(pieceTable)
				: props.document.content()
			lexer.computeAllStates(content)
			lastLexedPieceTable = pieceTable
			return
		}

		lexer.updateStatesFromEdit(
			edit.startPosition.row,
			(lineIndex) => cursor.lines.getLineText(lineIndex),
			lineCount
		)
		lastLexedPieceTable = cursor.lines.pieceTable()
	}

	const handleIncrementalEdit = (edit: DocumentIncrementalEdit) => {
		applyLexerEdit(edit)
		props.document.applyIncrementalEdit?.(edit)
	}

	const { foldedStarts, toggleFold } = useFoldedStarts({
		filePath: () => props.document.filePath(),
		folds: () => props.folds?.(),
		scrollElement,
	})

	const layout = createTextEditorLayout({
		fontSize: () => props.fontSize(),
		fontFamily: () => props.fontFamily(),
		isFileSelected: () => props.isFileSelected(),
		tabSize,
		scrollElement,
		folds: () => props.folds?.(),
		foldedStarts,
	})

	const cursorScroll = createCursorScrollSync({
		scrollElement,
		lineHeight: layout.lineHeight,
		charWidth: layout.charWidth,
		getColumnOffset: layout.getColumnOffset,
	})

	const scrollCursorIntoView = () => {
		const pos = cursor.state.position
		cursorScroll.scrollToCursor(pos.line, pos.column)
	}

	const input = createTextEditorInput({
		visibleLineRange: layout.visibleLineRange,
		updatePieceTable: (updater) => props.document.updatePieceTable(updater),
		isFileSelected: () => props.isFileSelected(),
		isEditable,
		getInputElement: () => inputElement,
		scrollCursorIntoView,
		activeScopes: () => props.activeScopes?.() ?? ['editor', 'global'],
		onIncrementalEdit: handleIncrementalEdit,
	})

	const mouseSelection = createMouseSelection({
		scrollElement,
		charWidth: layout.charWidth,
		tabSize,
		lineHeight: layout.lineHeight,
	})

	const handleLineMouseDown = (
		event: MouseEvent,
		lineIndex: number,
		column: number
	) => {
		mouseSelection.handleMouseDown(event, lineIndex, column)
		if (isEditable()) input.focusInput()
	}

	createEffect(() => {
		const element = scrollElement()
		if (!element) return

		const unregister = props.registerEditorArea?.(() => element)
		if (typeof unregister === 'function') {
			onCleanup(unregister)
		}
	})

	const bracketDepths = useVisibleBracketDepths({
		lexer,
		lexerStates,
		virtualItems: layout.virtualItems,
		displayToLine: layout.displayToLine,
		getLineStart: (lineIndex) => cursor.lines.getLineStart(lineIndex),
		getLineText: (lineIndex) => cursor.lines.getLineText(lineIndex),
	})

	const { getLineHighlights } = createLineHighlights({
		lexer,
		highlights: () => props.highlights?.(),
		errors: () => props.errors?.(),
		lexerStates,
	})

	return (
		<Show
			when={layout.hasLineEntries()}
			fallback={
				<p class="mt-4 text-sm text-zinc-500">
					Line information is not available for this file yet.
				</p>
			}
		>
			<EditorViewport
				setScrollElement={setScrollElement}
				setInputElement={setInputElement}
				layout={layout}
				input={input}
				isEditable={isEditable}
				fontSize={props.fontSize}
				fontFamily={props.fontFamily}
				cursorMode={props.cursorMode}
				tabSize={tabSize}
				bracketDepths={bracketDepths}
				getLineHighlights={getLineHighlights}
				folds={props.folds}
				foldedStarts={foldedStarts}
				onToggleFold={toggleFold}
				onLineMouseDown={(event, lineIndex, column) =>
					handleLineMouseDown(event, lineIndex, column)
				}
			/>
		</Show>
	)
}
