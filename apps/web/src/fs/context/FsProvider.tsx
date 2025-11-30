import { batch, type JSX, onMount } from 'solid-js'
import { webLogger } from '~/logger'
import { formatBytes } from '~/utils/bytes'
import { parseFileBuffer } from '~/utils/parse'
import { createPieceTableSnapshot } from '~/utils/pieceTable'
import { analyzeFileBytes } from '~/utils/textHeuristics'
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
		setSelectedFileContent,
		setSelectedFileSize,
		setError,
		setLoading,
		setFileStats,
		clearParseResults,
		setPieceTable,
		clearPieceTables
	} = createFsState()

	let selectRequestId = 0
	const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 100 // 100 MB

	const restoreHandleCache = () => {
		if (!state.tree) return

		if (state.tree.kind === 'dir' && state.tree.handle) {
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
			const built = await buildTree(source)

			batch(() => {
				setTree(built)
				setActiveSource(source)
				setExpanded(expanded => ({
					...expanded,
					[built.path]: expanded[built.path] ?? true
				}))
				setError(undefined)
			})
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
		const start = performance.now()
		const logDuration = (status: string) => {
			webLogger.debug(
				`selectPath ${status} for ${path} in ${(performance.now() - start).toFixed(2)}ms`
			)
		}

		if (!state.tree) {
			logDuration('skipped:no-tree')
			return
		}
		if (state.selectedPath === path) {
			logDuration('skipped:already-selected')
			return
		}

		const node = findNode(state.tree, path)
		if (!node) {
			logDuration('skipped:not-found')
			return
		}

		if (node.kind === 'dir') {
			setSelectedPath(path)
			setSelectedFileSize(undefined)
			logDuration('selected-dir')
			return
		}

		const requestId = ++selectRequestId

		try {
			await batch(async () => {
				setSelectedPath(path)
				setError(undefined)

				const source = state.activeSource ?? DEFAULT_SOURCE
				const fileSize = await getFileSize(source, path)
				if (requestId !== selectRequestId) return

				setSelectedFileSize(fileSize)

				if (fileSize > MAX_FILE_SIZE_BYTES) {
					setSelectedFileContent(`File too large (${formatBytes(fileSize)})`)
					return
				}

				const previewBytes = await readFilePreviewBytes(source, path)
				if (requestId !== selectRequestId) return
				const detection = analyzeFileBytes(path, previewBytes)
				const shouldParseStructurally = detection.isText

				const text = await readFileText(source, path)
				if (requestId !== selectRequestId) return
				setSelectedFileContent(text)
				if (shouldParseStructurally) {
					setPieceTable(path, createPieceTableSnapshot(text))
					setFileStats(
						path,
						parseFileBuffer(text, {
							path
						})
					)
				}
			})
		} catch (error) {
			if (requestId !== selectRequestId) return
			handleReadError(error)
		} finally {
			logDuration('complete')
		}
	}

	const { createDir, createFile, deleteNode } = createFsMutations({
		refresh,
		setExpanded,
		setSelectedPath,
		setSelectedFileContent,
		setSelectedFileSize,
		setError,
		getState: () => state,
		getActiveSource: () => state.activeSource
	})

	const setSource = (source: FsSource) => refresh(source)

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
			deleteNode
		}
	]

	return <FsContext.Provider value={value}>{props.children}</FsContext.Provider>
}
