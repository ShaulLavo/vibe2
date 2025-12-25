import type {
	EditorSyntaxHighlight,
	HighlightOffset,
	TextEditorDocument,
} from '@repo/code-editor'
import { Editor } from '@repo/code-editor'
import { getEditCharDelta, getEditLineDelta } from '@repo/utils/highlightShift'

import {
	Accessor,
	Match,
	Switch,
	batch,
	createMemo,
	createResource,
	createSignal,
} from 'solid-js'
import { useFocusManager } from '~/focus/focusManager'
import { BinaryFileViewer } from '../../components/BinaryFileViewer'
import { useFs } from '../../fs/context/FsContext'
import { logger } from '../../logger'
import { sendIncrementalTreeEdit } from '../../treeSitter/incrementalEdits'
import { getTreeSitterWorker } from '../../treeSitter/workerClient'
import { useTabs } from '../hooks/useTabs'
import { getShiftableWhitespaceEditKind } from '../utils/shiftableEdits'
import { Tabs } from './Tabs'
import { unwrap } from 'solid-js/store'

const FONT_OPTIONS = [
	{
		label: 'JetBrains Mono',
		value: '"JetBrains Mono Variable", monospace',
	},
	{
		label: 'Geist Mono',
		value: '"Geist Mono", monospace',
	},
]
const DEFAULT_FONT_SIZE = 14
const DEFAULT_FONT_FAMILY = FONT_OPTIONS[0]?.value ?? 'monospace'
const MAX_EDITOR_TABS = 1000

type SelectedFilePanelProps = {
	isFileSelected: Accessor<boolean>
	currentPath?: string
}

export const SelectedFilePanel = (props: SelectedFilePanelProps) => {
	const log = logger.withTag('editor')
	const assert = (
		condition: boolean,
		message: string,
		details?: Record<string, unknown>
	) => {
		if (condition) return true
		log.warn(message, details)
		return false
	}
	const [
		state,
		{
			selectPath,
			updateSelectedFilePieceTable,
			updateSelectedFileHighlights,
			applySelectedFileHighlightOffset,
			updateSelectedFileFolds,
			updateSelectedFileBrackets,
			updateSelectedFileErrors,
			updateSelectedFileScrollPosition,
			updateSelectedFileVisibleContent,
			saveFile,
		},
	] = useFs()
	const focus = useFocusManager()

	const isBinary = () => state.selectedFileStats?.contentKind === 'binary'

	const [documentVersion, setDocumentVersion] = createSignal(0)
	const [treeSitterWorker] = createResource(async () => getTreeSitterWorker())

	const tabs = useTabs(() => state.lastKnownFilePath, {
		maxTabs: MAX_EDITOR_TABS,
	})

	const handleTabSelect = (path: string) => {
		if (!path || path === state.selectedPath) return
		void selectPath(path)
	}

	const tabLabel = (path: string) => path.split('/').pop() || path

	const isEditable = () =>
		props.isFileSelected() && !state.selectedFileLoading && !state.loading

	const editorDocument: TextEditorDocument = {
		filePath: () => state.lastKnownFilePath,
		content: () => state.selectedFileContent,
		pieceTable: () => state.selectedFilePieceTable,
		updatePieceTable: updateSelectedFilePieceTable,
		isEditable,
		applyIncrementalEdit: (edit) => {
			if (isBinary()) return
			const path = state.lastKnownFilePath
			const parsePromise = sendIncrementalTreeEdit(path, edit)
			if (!parsePromise) return

			const charDelta = getEditCharDelta(edit)
			const lineDelta = getEditLineDelta(edit)

			// Apply offset immediately for ALL edits (O(1) operation)
			applySelectedFileHighlightOffset({
				charDelta,
				lineDelta,
				fromCharIndex: edit.startIndex,
				fromLineRow: edit.startPosition.row,
			})

			// Whitespace-only inserts/deletes are shiftable, so offset is accurate.
			// Skip tree-sitter updates to avoid extra reactive churn.
			const shiftableKind = getShiftableWhitespaceEditKind(edit)
			if (shiftableKind) {
				assert(
					shiftableKind === 'insert'
						? edit.deletedText.length === 0
						: edit.insertedText.length === 0,
					'Shiftable edit should be pure insert/delete',
					{
						path,
						kind: shiftableKind,
						startIndex: edit.startIndex,
						oldEndIndex: edit.oldEndIndex,
						newEndIndex: edit.newEndIndex,
						insertedLength: edit.insertedText.length,
						deletedLength: edit.deletedText.length,
					}
				)
				log.debug('Skipping tree-sitter update for shiftable edit', {
					path,
					kind: shiftableKind,
					startIndex: edit.startIndex,
					oldEndIndex: edit.oldEndIndex,
					newEndIndex: edit.newEndIndex,
					insertedLength: edit.insertedText.length,
					deletedLength: edit.deletedText.length,
					charDelta,
					lineDelta,
				})
				return
			}

			void parsePromise.then((result) => {
				if (result && path === state.lastKnownFilePath) {
					batch(() => {
						updateSelectedFileHighlights(result.captures)
						updateSelectedFileFolds(result.folds)
						updateSelectedFileBrackets(result.brackets)
						updateSelectedFileErrors(result.errors)
						// Increment version to trigger minimap re-render
						setDocumentVersion((v) => v + 1)
					})
				}
			})
		},
	}

	// TreeSitterCapture already has { startIndex, endIndex, scope } which matches EditorSyntaxHighlight
	// No .map() needed - just pass through directly!
	const editorHighlights = createMemo<EditorSyntaxHighlight[] | undefined>(
		() => {
			const captures = state.selectedFileHighlights
			if (!captures || captures.length === 0) {
				return undefined
			}
			// IMPORTANT: Unwrap the proxy to ensure downstream sorting is fast
			return unwrap(captures)
		}
	)

	// Convert internal offset to editor HighlightOffset type
	const editorHighlightOffset = createMemo<HighlightOffset | undefined>(() => {
		const offset = state.selectedFileHighlightOffset
		if (!offset) return undefined
		return {
			charDelta: offset.charDelta,
			lineDelta: offset.lineDelta,
			fromCharIndex: offset.fromCharIndex,
			fromLineRow: offset.fromLineRow,
		}
	})

	const editorErrors = createMemo(() => state.selectedFileErrors)

	return (
		<div class="flex h-full flex-col font-mono overflow-hidden">
			<Tabs
				values={tabs()}
				activeValue={state.lastKnownFilePath}
				onSelect={handleTabSelect}
				getLabel={tabLabel}
			/>

			<div
				class="relative flex-1 overflow-hidden"
				style={{ 'view-transition-name': 'editor-content' }}
			>
				<Switch
					fallback={
						<Editor
							document={editorDocument}
							isFileSelected={props.isFileSelected}
							stats={() => state.selectedFileStats}
							fontSize={() => DEFAULT_FONT_SIZE}
							fontFamily={() => DEFAULT_FONT_FAMILY}
							cursorMode={() => 'regular'}
							registerEditorArea={(resolver) =>
								focus.registerArea('editor', resolver)
							}
							activeScopes={focus.activeScopes}
							previewBytes={() => state.selectedFilePreviewBytes}
							highlights={editorHighlights}
							highlightOffset={editorHighlightOffset}
							folds={() => state.selectedFileFolds}
							brackets={() => state.selectedFileBrackets}
							errors={editorErrors}
							treeSitterWorker={treeSitterWorker() ?? undefined}
							documentVersion={documentVersion}
							onSave={() => void saveFile()}
							initialScrollPosition={() => state.selectedFileScrollPosition}
							onScrollPositionChange={updateSelectedFileScrollPosition}
							initialVisibleContent={() => state.selectedFileVisibleContent}
							onCaptureVisibleContent={updateSelectedFileVisibleContent}
						/>
					}
				>
					<Match when={!props.isFileSelected()}>
						<p class="mt-2 text-sm text-zinc-500">
							{/* Select a file to view its contents. Click folders to toggle
						visibility. */}
						</p>
					</Match>

					{/* <Match when={isBinary()}>
						<BinaryFileViewer
							data={() => state.selectedFilePreviewBytes}
							stats={() => state.selectedFileStats}
							fileSize={() => state.selectedFileSize}
							fontSize={() => DEFAULT_FONT_SIZE}
							fontFamily={() => DEFAULT_FONT_FAMILY}
						/>
					</Match> */}
				</Switch>
			</div>
		</div>
	)
}
