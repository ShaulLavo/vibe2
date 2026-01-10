import { CursorMode, Editor } from '@repo/code-editor'
import { Accessor, Match, Switch, createResource } from 'solid-js'
import { useFocusManager } from '~/focus/focusManager'
import { useFs } from '../../fs/context/FsContext'

import { getTreeSitterWorker } from '../../treeSitter/workerClient'

import { Tabs } from './Tabs'
import { SettingsTab } from '../../settings/components/SettingsTab'
import { useEditorDecorations } from '../hooks/useEditorDecorations'
import { useEditorDocument } from '../hooks/useEditorDocument'
import { useSelectedFileTabs } from '../hooks/useSelectedFileTabs'
import { useSettingsViewState } from '../hooks/useSettingsViewState'

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
			fileCache,
		},
	] = useFs()
	const focus = useFocusManager()

	const settingsView = useSettingsViewState({
		selectedPath: () => state.selectedPath,
	})

	const [treeSitterWorker] = createResource(async () => getTreeSitterWorker())

	const { tabsState, handleTabSelect, handleTabClose, tabLabel } =
		useSelectedFileTabs({
			currentPath: () => state.lastKnownFilePath,
			selectedPath: () => state.selectedPath,
			selectPath,
			setOpenTabs: fileCache.setOpenTabs,
			shouldShowJSONView: settingsView.shouldShowJSONView,
			maxTabs: MAX_EDITOR_TABS,
		})

	const { editorDocument, documentVersion } = useEditorDocument({
		filePath: () => state.lastKnownFilePath,
		content: () => state.selectedFileContent,
		pieceTable: () => state.selectedFilePieceTable,
		updatePieceTable: updateSelectedFilePieceTable,
		isFileSelected: () => props.isFileSelected(),
		isSelectedFileLoading: () => state.selectedFileLoading,
		isLoading: () => state.loading,
		stats: () => state.selectedFileStats,
		applyHighlightOffset: applySelectedFileHighlightOffset,
		updateHighlights: updateSelectedFileHighlights,
		updateFolds: updateSelectedFileFolds,
		updateBrackets: updateSelectedFileBrackets,
		updateErrors: updateSelectedFileErrors,
	})

	const { editorHighlights, editorHighlightOffset, editorErrors } =
		useEditorDecorations({
			highlights: () => state.selectedFileHighlights,
			highlightOffsets: () => state.selectedFileHighlightOffset,
			errors: () => state.selectedFileErrors,
			isFileSelected: () => props.isFileSelected(),
			filePath: () => state.lastKnownFilePath,
		})

	return (
		<div class="flex h-full flex-col font-mono overflow-hidden">
			<Tabs
				values={tabsState()}
				activeValue={state.lastKnownFilePath}
				onSelect={handleTabSelect}
				onClose={handleTabClose}
				getLabel={tabLabel}
				dirtyPaths={state.dirtyPaths}
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
							cursorMode={() => CursorMode.Terminal}
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
					<Match
						when={
							settingsView.shouldShowSettings() &&
							!settingsView.shouldShowJSONView()
						}
					>
						<SettingsTab
							initialCategory={settingsView.currentCategory()}
							currentCategory={settingsView.currentCategory()}
							onCategoryChange={settingsView.handleCategoryChange}
						/>
					</Match>

					<Match when={!props.isFileSelected()}>
						<p class="mt-2 text-sm text-zinc-500">
							{/* Select a file to view its contents. Click folders to toggle
						visibility. Click folders to toggle
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
