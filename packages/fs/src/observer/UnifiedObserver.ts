/**
 * UnifiedObserver
 *
 * Unified file system observer that abstracts over native FileSystemObserver
 * and polling fallback, with explicit capability reporting.
 *
 * Key improvement: Consumers know the expected latency and can make
 * informed decisions about data freshness.
 */

import type { FilePath } from '../types'
import {
	FileSystemObserverPolyfill,
	hasNativeObserver,
	type FileSystemChangeRecord,
	type FileSystemObserverCallback,
} from '../FileSystemObserver'

/**
 * Observer capabilities - what the observer can do and how fast.
 */
export interface ObserverCapabilities {
	/** Whether native FileSystemObserver API is being used */
	readonly type: 'native' | 'polling'
	/** Expected latency in milliseconds (50ms native, 500ms polling) */
	readonly latencyMs: number
	/** Whether recursive observation is supported */
	readonly supportsRecursive: boolean
	/** Poll interval for polling mode (only set if type is 'polling') */
	readonly pollIntervalMs?: number
}

/**
 * Change record with FilePath for easy integration.
 */
export interface UnifiedChangeRecord {
	/** The original change record */
	readonly raw: FileSystemChangeRecord
	/** FilePath derived from relativePathComponents */
	readonly path: FilePath
	/** Type of change */
	readonly type: FileSystemChangeRecord['type']
	/** Timestamp when change was detected */
	readonly detectedAt: number
}

/**
 * Callback for change events.
 */
export type UnifiedObserverCallback = (
	changes: UnifiedChangeRecord[],
	observer: UnifiedObserver
) => void

/**
 * Options for UnifiedObserver.
 */
export interface UnifiedObserverOptions {
	/** Poll interval in ms for polling fallback (default: 500) */
	pollIntervalMs?: number
	/** Whether to observe recursively (default: true) */
	recursive?: boolean
}

/**
 * Unified file system observer.
 */
export class UnifiedObserver {
	private observer: FileSystemObserverPolyfill
	private callback: UnifiedObserverCallback
	private observedHandles = new Set<FileSystemDirectoryHandle>()
	private readonly options: Required<UnifiedObserverOptions>

	readonly capabilities: ObserverCapabilities

	constructor(callback: UnifiedObserverCallback, options: UnifiedObserverOptions = {}) {
		this.callback = callback
		this.options = {
			pollIntervalMs: options.pollIntervalMs ?? 500,
			recursive: options.recursive ?? true,
		}

		// Determine capabilities
		const isNative = hasNativeObserver()
		this.capabilities = {
			type: isNative ? 'native' : 'polling',
			latencyMs: isNative ? 50 : this.options.pollIntervalMs,
			supportsRecursive: isNative,
			pollIntervalMs: isNative ? undefined : this.options.pollIntervalMs,
		}

		// Create underlying observer
		const internalCallback: FileSystemObserverCallback = (records) => {
			const now = Date.now()
			const unifiedRecords = records.map((record) =>
				this.toUnifiedRecord(record, now)
			)
			this.callback(unifiedRecords, this)
		}

		this.observer = new FileSystemObserverPolyfill(
			internalCallback,
			this.options.pollIntervalMs
		)
	}

	/**
	 * Start observing a directory.
	 */
	async observe(handle: FileSystemDirectoryHandle): Promise<void> {
		await this.observer.observe(handle, { recursive: this.options.recursive })
		this.observedHandles.add(handle)
	}

	/**
	 * Stop observing a directory.
	 */
	unobserve(handle: FileSystemDirectoryHandle): void {
		this.observer.unobserve(handle)
		this.observedHandles.delete(handle)
	}

	/**
	 * Stop observing all directories.
	 */
	disconnect(): void {
		this.observer.disconnect()
		this.observedHandles.clear()
	}

	/**
	 * Force an immediate check for changes.
	 * Useful when you need fresher data than the observer latency allows.
	 *
	 * Note: For native observer, this may return empty as changes are push-based.
	 * For polling, this forces an immediate poll cycle.
	 */
	async checkNow(handle: FileSystemDirectoryHandle): Promise<UnifiedChangeRecord[]> {
		// For polling mode, we can force a check
		// For native mode, changes are push-based so we can't force
		if (this.capabilities.type === 'polling') {
			// Trigger the observer's internal check mechanism
			// This is a bit of a hack - we disconnect and reconnect to force a snapshot
			this.observer.unobserve(handle)
			await this.observer.observe(handle, { recursive: this.options.recursive })
		}

		// No way to get immediate changes - caller should wait for callback
		return []
	}

	/**
	 * Check if a handle is being observed.
	 */
	isObserving(handle: FileSystemDirectoryHandle): boolean {
		return this.observedHandles.has(handle)
	}

	/**
	 * Get all observed handles.
	 */
	getObservedHandles(): FileSystemDirectoryHandle[] {
		return Array.from(this.observedHandles)
	}

	/**
	 * Get info about current observation state.
	 */
	getStatus(): {
		capabilities: ObserverCapabilities
		observedCount: number
		isObserving: boolean
	} {
		return {
			capabilities: this.capabilities,
			observedCount: this.observedHandles.size,
			isObserving: this.observedHandles.size > 0,
		}
	}

	private toUnifiedRecord(
		record: FileSystemChangeRecord,
		detectedAt: number
	): UnifiedChangeRecord {
		// Build path from relative components
		const pathString = record.relativePathComponents.join('/')
		// Import at runtime to avoid circular dependency
		const { createFilePath } = require('../types')
		const path = createFilePath(pathString) as FilePath

		return {
			raw: record,
			path,
			type: record.type,
			detectedAt,
		}
	}
}

/**
 * Create a unified observer.
 */
export function createUnifiedObserver(
	callback: UnifiedObserverCallback,
	options?: UnifiedObserverOptions
): UnifiedObserver {
	return new UnifiedObserver(callback, options)
}

/**
 * Check if native observer is available.
 */
export { hasNativeObserver }
