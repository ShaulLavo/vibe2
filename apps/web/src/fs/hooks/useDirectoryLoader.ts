import { batch } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import { findNode } from '../runtime/tree'
import { buildTree } from '../runtime/fsRuntime'
import type { FsState } from '../types'
import { DEFAULT_SOURCE } from '../config/constants'
import type { FsDirTreeNode } from '@repo/fs'
import { normalizeDirNodeMetadata } from '../utils/treeNodes'
import type { TreePrefetchClient } from '../prefetch/treePrefetchClient'

type UseDirectoryLoaderOptions = {
	state: FsState
	setExpanded: SetStoreFunction<Record<string, boolean>>
	setSelectedPath: (path: string | undefined) => void
	setError: (message: string | undefined) => void
	setDirNode: (path: string, node: FsDirTreeNode) => void
	runPrefetchTask: (
		task: Promise<void> | undefined,
		fallbackMessage: string
	) => void
	treePrefetchClient: TreePrefetchClient
}

type EnsureDirLoadResult = Promise<void> | undefined

export const useDirectoryLoader = ({
	state,
	setExpanded,
	setSelectedPath,
	setError,
	setDirNode,
	runPrefetchTask,
	treePrefetchClient,
}: UseDirectoryLoaderOptions) => {
	const subtreeLoads = new Map<string, Promise<void>>()

	const buildEnsurePaths = () => {
		const paths = new Set<string>()
		const selectedNode = state.selectedNode
		if (selectedNode?.kind === 'file') {
			paths.add(selectedNode.path)
		}
		const lastFilePath = state.lastKnownFilePath
		if (lastFilePath) {
			paths.add(lastFilePath)
		}
		return Array.from(paths)
	}

	const ensureDirLoaded = (path: string): EnsureDirLoadResult => {
		if (!state.tree) return
		const existing = findNode(state.tree, path)
		if (!existing || existing.kind !== 'dir') return
		if (existing.isLoaded !== false) return
		const inflight = subtreeLoads.get(path)
		if (inflight) return inflight

		const expandedSnapshot = { ...state.expanded, [path]: true }
		const ensurePaths = buildEnsurePaths()
		const load = (async () => {
			try {
				const source = state.activeSource ?? DEFAULT_SOURCE
				const subtree = await buildTree(source, {
					rootPath: path,
					expandedPaths: expandedSnapshot,
					ensurePaths,
					operationName: 'fs:buildSubtree',
				})
				const latest = state.tree ? findNode(state.tree, path) : undefined
				if (!latest || latest.kind !== 'dir') return
				const normalized = normalizeDirNodeMetadata(
					subtree,
					latest.parentPath,
					latest.depth
				)
				setDirNode(path, normalized)
				runPrefetchTask(
					treePrefetchClient.ingestSubtree(normalized),
					'Failed to sync prefetch worker'
				)
			} catch (error) {
				setError(
					error instanceof Error
						? error.message
						: 'Failed to load directory contents'
				)
			} finally {
				subtreeLoads.delete(path)
			}
		})()

		subtreeLoads.set(path, load)
		return load
	}

	const toggleDir = (path: string) => {
		const next = !state.expanded[path]
		batch(() => {
			setExpanded(path, next)
			setSelectedPath(path)
		})
		if (next) {
			void ensureDirLoaded(path)
		}
	}

	/**
	 * Force reload a directory from disk, regardless of its current loaded state.
	 * Used by FileSystemObserver to refresh directories when changes are detected.
	 */
	const reloadDirectory = async (path: string): Promise<void> => {
		if (!state.tree) return

		// For root path, reload from root
		const targetPath = path || ''
		const existing = findNode(state.tree, targetPath)
		if (!existing || existing.kind !== 'dir') return

		// Cancel any inflight load for this path
		subtreeLoads.delete(targetPath)

		const expandedSnapshot = { ...state.expanded }
		const ensurePaths = buildEnsurePaths()

		try {
			const source = state.activeSource ?? DEFAULT_SOURCE
			const subtree = await buildTree(source, {
				rootPath: targetPath,
				expandedPaths: expandedSnapshot,
				ensurePaths,
				operationName: 'fs:reloadDirectory',
			})

			const latest = state.tree ? findNode(state.tree, targetPath) : undefined
			if (!latest || latest.kind !== 'dir') return

			const normalized = normalizeDirNodeMetadata(
				subtree,
				latest.parentPath,
				latest.depth
			)
			setDirNode(targetPath, normalized)
			runPrefetchTask(
				treePrefetchClient.ingestSubtree(normalized),
				'Failed to sync prefetch worker after reload'
			)
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: 'Failed to reload directory contents'
			)
		}
	}

	return {
		buildEnsurePaths,
		ensureDirLoaded,
		toggleDir,
		reloadDirectory,
	}
}
