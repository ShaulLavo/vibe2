import { batch, type JSX, onMount } from 'solid-js'
import {
	createMinimalBinaryParseResult,
	detectBinaryFromPreview,
	parseFileBuffer
} from '~/utils/parse'
import { trackOperation } from '~/perf'
import { createPieceTableSnapshot } from '~/utils/pieceTable'
import { DEFAULT_SOURCE } from '../config/constants'
import { createFsMutations } from '../fsMutations'
import { collectFileHandles } from '../runtime/fileHandles'
import { buildTree, fileHandleCache, primeFsCache } from '../runtime/fsRuntime'
import {
	getFileSize,
	readFilePreviewBytes,
	readFileText
} from '../runtime/streaming'
import { findNode } from '../runtime/tree'
import { createFsState } from '../state/fsState'
import type { FsSource } from '../types'
import { FsContext, type FsContextValue } from './FsContext'

export function FsProvider(props: { children: JSX.Element }) {
	const {
		state,
		hydration,
		setTree,
		setExpanded,
		setSelectedPath,
		setActiveSource,
		setSelectedFileSize,
		setSelectedFilePreviewBytes,
		setSelectedFileContent,
		setError,
		setLoading,
		setFileStats,
		clearParseResults,
		setPieceTable,
		clearPieceTables
	} = createFsState()

	let selectRequestId = 0
	const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 100 // 100 MB

	const isValidHandle = (
		handle: unknown
	): handle is FileSystemDirectoryHandle => {
		if (!handle || typeof handle !== 'object') return false
		// Memory handles lose their methods after IndexedDB serialization
		const h = handle as { entries?: unknown; [Symbol.asyncIterator]?: unknown }
		return (
			typeof h.entries === 'function' ||
			typeof h[Symbol.asyncIterator] === 'function'
		)
	}

	const restoreHandleCache = () => {
		if (!state.tree) return

		if (state.tree.kind === 'dir' && isValidHandle(state.tree.handle)) {
			primeFsCache(state.activeSource ?? DEFAULT_SOURCE, state.tree.handle)
		}

		fileHandleCache.clear()
		collectFileHandles(state.tree)
	}

	const refresh = async (
		source: FsSource = state.activeSource ?? DEFAULT_SOURCE
	) => {
		setLoading(true)
		clearParseResults()
		clearPieceTables()

		try {
			await trackOperation(
				'fs:refresh',
				async ({ timeAsync, timeSync }) => {
					const built = await timeAsync('build-tree', () => buildTree(source))

					timeSync('apply-state', () => {
						batch(() => {
							setTree(built)
							setActiveSource(source)
							setExpanded(expanded => ({
								...expanded,
								[built.path]: expanded[built.path] ?? true
							}))
							setError(undefined)
						})
					})
				},
				{ metadata: { source } }
			)
		} catch (error) {
			setError(
				error instanceof Error ? error.message : 'Failed to load filesystem'
			)
		} finally {
			setLoading(false)
		}
	}

	const toggleDir = (path: string) => {
		batch(() => {
			setExpanded(path, prev => !prev)
			setSelectedPath(path)
		})
	}

	const handleReadError = (error: unknown) => {
		if (error instanceof DOMException && error.name === 'AbortError') return

		setError(error instanceof Error ? error.message : 'Failed to read file')
	}

	const selectPath = async (path: string) => {
		const tree = state.tree
		if (!tree) return
		if (state.selectedPath === path) return

		const node = findNode(tree, path)
		if (!node) return

		if (node.kind === 'dir') {
			setSelectedPath(path)
			setSelectedFileSize(undefined)
			return
		}

		const requestId = ++selectRequestId

		await trackOperation(
			'fs:selectPath',
			async ({ timeSync, timeAsync }) => {
				const source = state.activeSource ?? DEFAULT_SOURCE

				const fileSize = await timeAsync('get-file-size', () =>
					getFileSize(source, path)
				)
				if (requestId !== selectRequestId) return

				let selectedFileContentValue = ''
				let pieceTableSnapshot:
					| ReturnType<typeof createPieceTableSnapshot>
					| undefined
				let fileStatsResult:
					| ReturnType<typeof parseFileBuffer>
					| ReturnType<typeof createMinimalBinaryParseResult>
					| undefined

				let previewBytes: Uint8Array | undefined

				if (fileSize > MAX_FILE_SIZE_BYTES) {
					// Skip processing for large files
				} else {
					previewBytes = await timeAsync('read-preview-bytes', () =>
						readFilePreviewBytes(source, path)
					)
					if (requestId !== selectRequestId) return

					const detection = detectBinaryFromPreview(path, previewBytes)
					const isBinary = !detection.isText

					if (isBinary) {
						fileStatsResult = timeSync('binary-file-metadata', () =>
							createMinimalBinaryParseResult('', detection)
						)
					} else {
						const text = await timeAsync('read-file-text', () =>
							readFileText(source, path)
						)
						if (requestId !== selectRequestId) return

						selectedFileContentValue = text

						fileStatsResult = timeSync('parse-file-buffer', () =>
							parseFileBuffer(text, {
								path,
								previewBytes,
								textHeuristic: detection
							})
						)

						if (fileStatsResult.contentKind === 'text') {
							const existingSnapshot = (
								state.pieceTables as Record<
									string,
									ReturnType<typeof createPieceTableSnapshot> | undefined
								>
							)[path]

							pieceTableSnapshot =
								existingSnapshot ??
								timeSync('create-piece-table', () =>
									createPieceTableSnapshot(text)
								)
						}
					}
				}

				timeSync('apply-selection-state', ({ timeSync }) => {
					batch(() => {
						timeSync('set-selected-path', () => setSelectedPath(path))
						timeSync('clear-error', () => setError(undefined))
						timeSync('set-selected-file-size', () =>
							setSelectedFileSize(fileSize)
						)
						timeSync('set-selected-file-preview-bytes', () =>
							setSelectedFilePreviewBytes(previewBytes)
						)
						timeSync('set-selected-file-content', () =>
							setSelectedFileContent(selectedFileContentValue)
						)
						if (pieceTableSnapshot) {
							timeSync('set-piece-table', () =>
								setPieceTable(path, pieceTableSnapshot)
							)
						}
						if (fileStatsResult) {
							timeSync('set-file-stats', () =>
								setFileStats(path, fileStatsResult)
							)
						}
					})
				})
			},
			{
				metadata: { path, source: state.activeSource ?? DEFAULT_SOURCE }
			}
		).catch(error => {
			if (requestId !== selectRequestId) return
			handleReadError(error)
		})
	}

	const { createDir, createFile, deleteNode } = createFsMutations({
		refresh,
		setExpanded,
		setSelectedPath,
		setSelectedFileSize,
		setError,
		getState: () => state,
		getActiveSource: () => state.activeSource
	})

	const setSource = (source: FsSource) => refresh(source)

	const updateSelectedFilePieceTable: FsContextValue[1]['updateSelectedFilePieceTable'] =
		updater => {
			const path = state.lastKnownFilePath
			if (!path) return

			const current = state.selectedFilePieceTable
			const next = updater(current)
			if (!next) return

			setPieceTable(path, next)
		}

	onMount(() => {
		void hydration.then(() => {
			restoreHandleCache()
			return refresh(state.activeSource ?? DEFAULT_SOURCE)
		})
	})

	const value: FsContextValue = [
		state,
		{
			refresh,
			setSource,
			toggleDir,
			selectPath,
			createDir,
			createFile,
			deleteNode,
			updateSelectedFilePieceTable
		}
	]

	return <FsContext.Provider value={value}>{props.children}</FsContext.Provider>
}
