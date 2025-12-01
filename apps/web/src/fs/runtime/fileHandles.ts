import type { FsTreeNode } from '@repo/fs'
import { trackMicro } from '~/perf'
import { fileHandleCache } from './fsRuntime'

const FILE_HANDLES_TIMING_THRESHOLD = 1 // ms

export function collectFileHandles(node: FsTreeNode) {
	if (node.kind === 'file' && node.handle) {
		fileHandleCache.set(node.path, node.handle)
	}

	if (node.kind === 'dir') {
		for (const child of node.children) {
			collectFileHandles(child)
		}
	}
}

/**
 * Tracked version of collectFileHandles that logs slow traversals
 */
export function collectFileHandlesTracked(node: FsTreeNode) {
	return trackMicro(
		'tree:collectFileHandles',
		() => collectFileHandles(node),
		{ threshold: FILE_HANDLES_TIMING_THRESHOLD }
	)
}
