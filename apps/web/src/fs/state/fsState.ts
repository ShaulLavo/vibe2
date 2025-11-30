/* eslint-disable solid/reactivity */
import type { FsDirTreeNode, FsTreeNode } from '@repo/fs'
import { makePersisted } from '@solid-primitives/storage'
import localforage from 'localforage'
import { createMemo, createSignal } from 'solid-js'
import { createStore, unwrap } from 'solid-js/store'
import type { ParseResult } from '~/utils/parse'
import type { PieceTableSnapshot } from '~/utils/pieceTable'
import { DEFAULT_SOURCE } from '../config/constants'
import type { FsState } from '../types'
import { findNode } from '../runtime/tree'

export const createFsState = () => {
	const [tree, setTree, isTreeReady] = makePersisted(
		createStore<FsDirTreeNode>(undefined!),
		{
			name: 'fs-tree',
			storage: localforage,
			serialize: value => unwrap(value) as unknown as string,
			deserialize: value => value as unknown as FsDirTreeNode
		}
	)

	const [expanded, setExpanded] = makePersisted(
		createStore<Record<string, boolean>>({}),
		{
			name: 'fs-expanded'
		}
	)

	const [selectedPath, setSelectedPath] = makePersisted(
		createSignal<string | undefined>(undefined),
		{
			name: 'fs-selected-path'
		}
	)
	const [activeSource, setActiveSource] = makePersisted(
		createSignal(DEFAULT_SOURCE),
		{
			name: 'fs-active-source'
		}
	)
	// TODO persist selectedFileContent but make it performant (non blocking?)
	const [selectedFileContent, setSelectedFileContent] = createSignal<string>('')
	const [selectedFileSize, setSelectedFileSize] = createSignal<
		number | undefined
	>(undefined)
	const [error, setError] = createSignal<string | undefined>(undefined)
	const [loading, setLoading] = createSignal(false)
	const [fileStats, setParseResults] = createStore<
		Record<string, ParseResult | undefined>
	>({})
	const [pieceTables, setPieceTables] = createStore<
		Record<string, PieceTableSnapshot | undefined>
	>({})
	const selectedNode = createMemo<FsTreeNode | undefined>(() =>
		tree ? findNode(tree, selectedPath()) : undefined
	)
	const lastKnownFileNode = createMemo<FsTreeNode | undefined>(prev => {
		const node = selectedNode()
		if (node?.kind === 'file') {
			return node
		}
		return prev
	})
	const lastKnownFilePath = () => lastKnownFileNode()?.path
	const hydration = Promise.allSettled([isTreeReady]).then(() => undefined)

	const setFileStats = (path: string, result?: ParseResult) => {
		if (!path) return
		setParseResults(path, result)
	}

	const clearParseResults = () => {
		setParseResults({})
	}

	const setPieceTable = (path: string, snapshot?: PieceTableSnapshot) => {
		if (!path) return
		setPieceTables(path, snapshot)
	}

	const clearPieceTables = () => {
		setPieceTables({})
	}

	const state = {
		tree,
		expanded,
		fileStats,
		pieceTables,
		get selectedPath() {
			return selectedPath()
		},
		get activeSource() {
			return activeSource()
		},
		get selectedFileContent() {
			return selectedFileContent()
		},
		get selectedFileSize() {
			return selectedFileSize()
		},
		get error() {
			return error()
		},
		get loading() {
			return loading()
		},
		get selectedFileStats() {
			const path = selectedPath()
			return path ? fileStats[path] : undefined
		},
		get selectedFilePieceTable() {
			const path = selectedPath()
			return path ? pieceTables[path] : undefined
		},
		get selectedNode() {
			return selectedNode()
		},
		get lastKnownFileNode() {
			return lastKnownFileNode()
		},
		get lastKnownFilePath() {
			return lastKnownFilePath()
		}
	} as FsState

	return {
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
	}
}
