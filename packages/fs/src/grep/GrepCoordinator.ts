/**
 * Grep Coordinator
 *
 * Main thread orchestrator that:
 * 1. Streams files to workers as they're discovered (no upfront enumeration)
 * 2. Dispatches file tasks to worker pool in parallel
 * 3. Aggregates and streams results back
 *
 * Key optimization: Files are dispatched to workers immediately as they're
 * found during directory traversal, rather than waiting for full enumeration.
 */

import { wrap, type Remote } from 'comlink'
import type { FsContext } from '../vfs/types'
import type {
	GrepOptions,
	GrepMatch,
	GrepFileTask,
	GrepFileResult,
	GrepProgressCallback,
} from './types'
import type { GrepWorkerApi } from './grepWorker'
import { DEFAULT_CHUNK_SIZE } from './chunkReader'
import { logger } from '@repo/logger'

const log = logger.withTag('fs:grep')

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_WORKER_COUNT = Math.min(
	typeof navigator !== 'undefined' ? navigator.hardwareConcurrency - 1 : 4,
	6
)
const textEncoder = new TextEncoder()
const MAX_CONCURRENT_TASKS = 50 // Max tasks in flight at once

// ============================================================================
// Coordinator
// ============================================================================

export class GrepCoordinator {
	readonly #fs: FsContext
	#workerPool: { worker: Worker; proxy: Remote<GrepWorkerApi> }[] = []
	#terminated = false

	constructor(fs: FsContext) {
		this.#fs = fs
	}

	/**
	 * Search for a pattern across files.
	 * Files are dispatched to workers as they're discovered during traversal.
	 *
	 * @param options - Search configuration
	 * @param onProgress - Optional progress callback
	 * @returns Array of all matches found
	 */
	async grep(
		options: GrepOptions,
		onProgress?: GrepProgressCallback
	): Promise<GrepMatch[]> {
		if (this.#terminated) {
			throw new Error('GrepCoordinator has been terminated')
		}

		const workerCount = options.workerCount ?? DEFAULT_WORKER_COUNT
		await this.#ensureWorkerPool(workerCount)

		const patternBytes = textEncoder.encode(options.pattern)
		const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
		const excludePatterns = options.excludePatterns ?? []
		const searchPaths = options.paths ?? ['']

		const allMatches: GrepMatch[] = []
		let filesFound = 0
		let filesScanned = 0
		let reachedLimit = false
		let nextWorkerIndex = 0

		// Semaphore for limiting concurrent tasks
		let activeTasks = 0
		const taskQueue: (() => void)[] = []

		const acquireSlot = (): Promise<void> => {
			if (activeTasks < MAX_CONCURRENT_TASKS) {
				activeTasks++
				return Promise.resolve()
			}
			return new Promise((resolve) => {
				taskQueue.push(() => {
					activeTasks++
					resolve()
				})
			})
		}

		const releaseSlot = (): void => {
			activeTasks--
			const next = taskQueue.shift()
			if (next) next()
		}

		// Track all pending tasks for final await
		const pendingTasks: Promise<void>[] = []

		// Process a single file (non-blocking dispatch)
		const processFile = async (path: string): Promise<void> => {
			if (reachedLimit) return

			await acquireSlot()

			try {
				const handle = await this.#fs.getFileHandleForRelative(path, false)
				const task: GrepFileTask = {
					fileHandle: handle,
					path,
					patternBytes,
					chunkSize,
				}

				// Round-robin worker selection
				const workerIndex = nextWorkerIndex
				nextWorkerIndex = (nextWorkerIndex + 1) % this.#workerPool.length
				const worker = this.#workerPool[workerIndex]!.proxy

				const result = await worker.grepFile(task)

				if (!result.error) {
					allMatches.push(...result.matches)
				}

				filesScanned++
				onProgress?.({
					filesScanned,
					filesTotal: filesFound,
					matchesFound: allMatches.length,
					currentFile: result.path,
				})

				if (options.maxResults !== undefined && allMatches.length >= options.maxResults) {
					reachedLimit = true
				}
			} catch {
				filesScanned++
			} finally {
				releaseSlot()
			}
		}

		// Walk directories and dispatch files immediately
		for (const searchPath of searchPaths) {
			if (reachedLimit) break

			const rootDir = this.#fs.dir(searchPath)

			try {
				for await (const entry of rootDir.walk({
					includeFiles: true,
					includeDirs: true,
					filter: (entry) => {
						if (!options.includeHidden && entry.name.startsWith('.')) {
							return false
						}
						if (this.#matchesExcludePattern(entry.name, excludePatterns)) {
							return false
						}
						return true
					},
				})) {
					if (reachedLimit) break

					if (entry.kind === 'file') {
						filesFound++
						// Fire and forget - don't await here!
						const task = processFile(entry.path)
						pendingTasks.push(task)
					}
				}
			} catch (error) {
				log.warn('Failed to enumerate path', { searchPath, error })
			}
		}

		// Wait for all tasks to complete
		await Promise.all(pendingTasks)

		// Final progress update
		onProgress?.({
			filesScanned,
			filesTotal: filesFound,
			matchesFound: allMatches.length,
			currentFile: '',
		})

		if (options.maxResults !== undefined) {
			return allMatches.slice(0, options.maxResults)
		}

		return allMatches
	}

	/**
	 * Search for pattern and yield results as they're found.
	 * Use for streaming results to UI.
	 */
	async *grepStream(
		options: GrepOptions
	): AsyncGenerator<GrepFileResult, void, unknown> {
		if (this.#terminated) {
			throw new Error('GrepCoordinator has been terminated')
		}

		const workerCount = options.workerCount ?? DEFAULT_WORKER_COUNT
		await this.#ensureWorkerPool(workerCount)

		const patternBytes = textEncoder.encode(options.pattern)
		const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
		const excludePatterns = options.excludePatterns ?? []
		const searchPaths = options.paths ?? ['']

		for (const searchPath of searchPaths) {
			const rootDir = this.#fs.dir(searchPath)

			try {
				for await (const entry of rootDir.walk({
					includeFiles: true,
					includeDirs: true,
					filter: (entry) => {
						if (!options.includeHidden && entry.name.startsWith('.')) {
							return false
						}
						if (this.#matchesExcludePattern(entry.name, excludePatterns)) {
							return false
						}
						return true
					},
				})) {
					if (entry.kind === 'file') {
						try {
							const handle = await this.#fs.getFileHandleForRelative(entry.path, false)
							const task: GrepFileTask = {
								fileHandle: handle,
								path: entry.path,
								patternBytes,
								chunkSize,
							}

							const worker = this.#workerPool[0]!.proxy
							const result = await worker.grepFile(task)

							if (!result.error && result.matches.length > 0) {
								yield result
							}
						} catch {
							// Skip files we can't access
						}
					}
				}
			} catch (error) {
				log.warn('Failed to enumerate path', { searchPath, error })
			}
		}
	}

	/**
	 * Check if a path segment matches any exclude pattern.
	 * Supports simple glob patterns like "*.test.ts" or exact matches like "node_modules".
	 */
	#matchesExcludePattern(name: string, patterns: string[]): boolean {
		for (const pattern of patterns) {
			if (name === pattern) {
				return true
			}
			if (pattern.startsWith('*.')) {
				const ext = pattern.slice(1)
				if (name.endsWith(ext)) {
					return true
				}
			}
			if (pattern.endsWith('*') && !pattern.startsWith('*')) {
				const prefix = pattern.slice(0, -1)
				if (name.startsWith(prefix)) {
					return true
				}
			}
		}
		return false
	}

	/**
	 * Initialize worker pool with specified count.
	 */
	async #ensureWorkerPool(count: number): Promise<void> {
		const needed = count - this.#workerPool.length

		for (let i = 0; i < needed; i++) {
			const worker = new Worker(new URL('./grepWorker.ts', import.meta.url), {
				type: 'module',
			})
			const proxy = wrap<GrepWorkerApi>(worker)
			this.#workerPool.push({ worker, proxy })
		}
	}

	/**
	 * Terminate all workers and cleanup resources.
	 */
	terminate(): void {
		this.#terminated = true
		for (const { worker } of this.#workerPool) {
			worker.terminate()
		}
		this.#workerPool = []
	}

	/**
	 * Get current worker pool size.
	 */
	get workerCount(): number {
		return this.#workerPool.length
	}
}
