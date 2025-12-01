import {
	buildFsTree,
	createFs,
	getRootDirectory,
	type FsContext as VfsContext,
	type FsTreeNode,
	FsDirTreeNode
} from '@repo/fs'
import { trackOperation } from '~/perf'
import type { FsSource } from '../types'
import { OPFS_ROOT_NAME } from '../config/constants'
import { collectFileHandles } from './fileHandles'

const fsCache: Partial<Record<FsSource, VfsContext>> = {}
const initPromises: Partial<Record<FsSource, Promise<void>>> = {}

export const fileHandleCache = new Map<string, FileSystemFileHandle>()

export function invalidateFs(source: FsSource) {
	delete fsCache[source]
	delete initPromises[source]
}

export async function ensureFs(source: FsSource): Promise<VfsContext> {
	if (fsCache[source]) return fsCache[source]!

	if (!initPromises[source]) {
		initPromises[source] = (async () => {
			const rootHandle = await getRootDirectory(source, OPFS_ROOT_NAME)
			fsCache[source] = createFs(rootHandle)
		})()
	}

	await initPromises[source]
	return fsCache[source]!
}

export function primeFsCache(
	source: FsSource,
	rootHandle: FileSystemDirectoryHandle
) {
	fsCache[source] = createFs(rootHandle)
	initPromises[source] = Promise.resolve()
}

export async function buildTree(source: FsSource): Promise<FsDirTreeNode> {
	return trackOperation(
		'fs:buildTree',
		async ({ timeAsync, timeSync }) => {
			const ctx = await timeAsync('ensure-fs', () => ensureFs(source))
			const root = await timeAsync('build-fs-tree', () =>
				buildFsTree(ctx, { path: '', name: OPFS_ROOT_NAME }, { withHandles: true })
			)

			timeSync('collect-file-handles', () => {
				fileHandleCache.clear()
				collectFileHandles(root)
			})

			return root
		},
		{ metadata: { source } }
	)
}

export {
	streamFileText,
	readFileText,
	safeReadFileText,
	createFileTextStream,
	getFileSize,
	readFilePreviewBytes
} from './streaming'
