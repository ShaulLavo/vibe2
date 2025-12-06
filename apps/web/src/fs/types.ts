import type { FsDirTreeNode, FsTreeNode } from '@repo/fs'
import type { ParseResult, PieceTableSnapshot } from '@repo/utils'
import type { DeferredDirMetadata } from './prefetch/treePrefetchWorkerTypes'

export type FsSource = 'memory' | 'local' | 'opfs'

export type FsState = {
	tree?: FsDirTreeNode
	expanded: Record<string, boolean>
	selectedPath?: string
	activeSource: FsSource
	selectedFileLoading: boolean
	selectedFileContent: string
	selectedFilePreviewBytes?: Uint8Array
	selectedFileSize?: number
	error?: string
	loading: boolean
	backgroundPrefetching: boolean
	backgroundIndexedFileCount: number
	lastPrefetchedPath?: string
	prefetchError?: string
	prefetchProcessedCount: number
	prefetchLastDurationMs: number
	prefetchAverageDurationMs: number
	fileStats: Record<string, ParseResult | undefined>
	selectedFileStats?: ParseResult
	pieceTables: Record<string, PieceTableSnapshot | undefined>
	selectedFilePieceTable?: PieceTableSnapshot
	selectedNode?: FsTreeNode | undefined
	lastKnownFileNode?: FsTreeNode | undefined
	lastKnownFilePath?: string
	deferredMetadata: Record<string, DeferredDirMetadata>
}
