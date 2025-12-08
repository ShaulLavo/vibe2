/**
 * Sync OPFS storage using createSyncAccessHandle.
 * No user-space cache - every op hits disk directly.
 * Must run in a Web Worker (sync handles not available on main thread).
 */

import { logger } from '@repo/logger'

declare global {
	interface FileSystemFileHandle {
		createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>
	}
	interface FileSystemSyncAccessHandle {
		read(buffer: ArrayBufferView, options?: { at?: number }): number
		write(buffer: ArrayBufferView, options?: { at?: number }): number
		truncate(size: number): void
		flush(): void
		getSize(): number
		close(): void
	}
}
const log = logger.withTag('fs:workerStorage')

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const encodeKey = (key: string): string => {
	const bytes = textEncoder.encode(key)
	let hex = ''
	for (let i = 0; i < bytes.length; i++) {
		hex += bytes[i]!.toString(16).padStart(2, '0')
	}
	return hex
}

const decodeKey = (hex: string): string => {
	const bytes = new Uint8Array(hex.length / 2)
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
	}
	return textDecoder.decode(bytes)
}

export interface WorkerStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
	clear(): void
	key(index: number): string | null
	keys(): string[]
	readonly length: number
	close(): void
}

async function createWorkerStorage(): Promise<WorkerStorage> {
	const handles = new Map<string, FileSystemSyncAccessHandle>()

	const closeHandle = (filename: string): void => {
		const handle = handles.get(filename)
		if (handle) {
			handle.close()
			handles.delete(filename)
		}
	}

	const storage: WorkerStorage = {
		getItem(key: string): string | null {
			const filename = encodeKey(key)

			const handle = handles.get(filename)
			if (!handle) return null

			const size = handle.getSize()
			if (size === 0) return null

			const buffer = new Uint8Array(size)
			handle.read(buffer, { at: 0 })
			try {
				return JSON.parse(textDecoder.decode(buffer))
			} catch {
				return null
			}
		},

		setItem(key: string, value: string): void {
			const filename = encodeKey(key)
			const handle = handles.get(filename)
			if (!handle) {
				throw new Error('Handle not pre-opened. Use async setItemAsync.')
			}

			const data = textEncoder.encode(JSON.stringify(value))
			handle.truncate(0)
			handle.write(data, { at: 0 })
			handle.flush()
		},

		removeItem(key: string): void {
			const filename = encodeKey(key)
			closeHandle(filename)
		},

		clear(): void {
			for (const [filename] of handles) {
				closeHandle(filename)
			}
		},

		key(index: number): string | null {
			const keys = Array.from(handles.keys())
			if (index >= keys.length) return null
			try {
				return decodeKey(keys[index]!)
			} catch {
				return null
			}
		},

		keys(): string[] {
			const result: string[] = []
			for (const filename of handles.keys()) {
				try {
					result.push(decodeKey(filename))
				} catch {}
			}
			return result
		},

		get length(): number {
			return handles.size
		},

		close(): void {
			for (const handle of handles.values()) {
				handle.close()
			}
			handles.clear()
		}
	}

	self.addEventListener('unload', () => {
		storage.close()
	})

	return storage
}

/**
 * Async-friendly sync storage for benchmarks.
 * Each op opens handle, does sync I/O, closes handle.
 * Pure disk speed, no caching.
 */
export async function createSyncStore(storeName: string = 'sync-store') {
	const root = await navigator.storage.getDirectory()
	const fileHandle = await root.getFileHandle(`${storeName}.json`, {
		create: true
	})
	const handle = await fileHandle.createSyncAccessHandle()

	let data: Record<string, unknown> = {}
	let dirty = false

	const load = () => {
		const size = handle.getSize()
		if (size === 0) {
			data = {}
			return
		}
		const buffer = new Uint8Array(size)
		handle.read(buffer, { at: 0 })
		try {
			data = JSON.parse(textDecoder.decode(buffer))
		} catch {
			data = {}
		}
	}

	const flush = () => {
		if (!dirty) return
		const encoded = textEncoder.encode(JSON.stringify(data))
		handle.truncate(0)
		handle.write(encoded, { at: 0 })
		handle.flush()
		dirty = false
	}

	load()

	return {
		async getItem<T>(key: string): Promise<T | null> {
			const value = data[key]
			return value === undefined ? null : (value as T)
		},

		async setItem<T>(key: string, value: T): Promise<T> {
			data[key] = value
			dirty = true
			return value
		},

		async removeItem(key: string): Promise<void> {
			if (!(key in data)) return
			delete data[key]
			dirty = true
		},

		async clear(): Promise<void> {
			data = {}
			dirty = true
		},

		async keys(): Promise<string[]> {
			return Object.keys(data)
		},

		async flush(): Promise<void> {
			flush()
		},

		async close(): Promise<void> {
			flush()
			try {
				handle.close()
			} catch (error) {
				log.error('Error closing handle', error)
			}
		}
	}
}

export { createWorkerStorage }
