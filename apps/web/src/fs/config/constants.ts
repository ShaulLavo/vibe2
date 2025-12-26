import type { FsSource } from '../types'

export const OPFS_ROOT_NAME = 'root' as const
const isTest =
	import.meta.env?.VITEST ||
	import.meta.env?.MODE === 'test' ||
	(globalThis as any).vTest

export const DEFAULT_SOURCE: FsSource = isTest ? 'memory' : 'local'

/**
 * Segments that should be excluded from prefetching and grep searches.
 * These are typically large directories that slow down operations.
 */
export const IGNORED_SEGMENTS = new Set([
	'node_modules',
	'.git',
	'.hg',
	'.svn',
	'.vite',
	'dist',
	'build',
	'.cache',
])
