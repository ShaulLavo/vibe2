import type { VisibleContentSnapshot } from '@repo/code-editor'
import type { ViewMode } from '../types/ViewMode'
import type { ScrollPosition, CursorPosition, SelectionRange } from '../store/types'
import type { FilePath } from '@repo/fs'

export type LocalStorageFileState = {
	cursor: CursorPosition | null
	selections: SelectionRange[] | null
	scroll: ScrollPosition | null
	visible: VisibleContentSnapshot | null
	viewMode: ViewMode | null
	isDirty: boolean
	savedAt: number
}

export type LocalStorageCacheOptions = {
	prefix?: string
	debounceMs?: number
	maxEntries?: number
	maxSizeBytes?: number
}

const DEFAULT_PREFIX = 'vibe:f:'
const DEFAULT_DEBOUNCE_MS = 100
const DEFAULT_MAX_ENTRIES = 200
const DEFAULT_MAX_SIZE_BYTES = 4 * 1024 * 1024

export type LocalStorageCache = {
	get: (path: FilePath) => Partial<LocalStorageFileState> | null
	set: (path: FilePath, state: Partial<LocalStorageFileState>) => void
	clear: (path: FilePath) => void
	clearAll: () => void
	flush: () => void
	getStats: () => { entries: number; approximateSize: number }
}

export const createLocalStorageCache = (
	options: LocalStorageCacheOptions = {}
): LocalStorageCache => {
	const prefix = options.prefix ?? DEFAULT_PREFIX
	const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
	const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
	const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES

	const memory = new Map<FilePath, LocalStorageFileState>()
	const entrySizes = new Map<FilePath, number>()
	let totalSize = 0
	const accessOrder = new Map<FilePath, true>()
	const pendingWrites = new Set<FilePath>()
	let flushTimeout: ReturnType<typeof setTimeout> | null = null

	const getStorageKey = (path: FilePath): string => prefix + path

	const touchAccess = (path: FilePath): void => {
		accessOrder.delete(path)
		accessOrder.set(path, true)
	}

	const getLRUPath = (): FilePath | undefined => {
		const first = accessOrder.keys().next()
		return first.done ? undefined : first.value
	}

	const removeEntry = (path: FilePath): void => {
		const size = entrySizes.get(path) ?? 0
		totalSize -= size
		entrySizes.delete(path)
		memory.delete(path)
		accessOrder.delete(path)

		try {
			localStorage.removeItem(getStorageKey(path))
		} catch {
			// Ignore
		}
	}

	const evictIfNeeded = (): void => {
		while (memory.size > maxEntries) {
			const oldest = getLRUPath()
			if (!oldest) break
			removeEntry(oldest)
		}

		while (totalSize > maxSizeBytes) {
			const oldest = getLRUPath()
			if (!oldest) break
			removeEntry(oldest)
		}
	}

	const flushToStorage = (): void => {
		for (const path of pendingWrites) {
			const state = memory.get(path)
			const key = getStorageKey(path)

			try {
				if (state) {
					localStorage.setItem(key, JSON.stringify(state))
				} else {
					localStorage.removeItem(key)
				}
			} catch (e) {
				if (e instanceof Error && e.name === 'QuotaExceededError') {
					evictIfNeeded()
					try {
						if (state) {
							localStorage.setItem(key, JSON.stringify(state))
						}
					} catch {
						// Give up
					}
				}
			}
		}
		pendingWrites.clear()
		flushTimeout = null
	}

	const scheduleFlush = (): void => {
		if (flushTimeout) return
		flushTimeout = setTimeout(flushToStorage, debounceMs)
	}

	const loadFromStorage = (): void => {
		try {
			const len = localStorage.length
			for (let i = 0; i < len; i++) {
				const key = localStorage.key(i)
				if (!key || !key.startsWith(prefix)) continue

				try {
					const raw = localStorage.getItem(key)
					if (!raw) continue

					const parsed = JSON.parse(raw) as LocalStorageFileState
					const path = key.slice(prefix.length) as FilePath

					memory.set(path, parsed)
					accessOrder.set(path, true)

					const size = raw.length * 2
					entrySizes.set(path, size)
					totalSize += size
				} catch {
					// Skip corrupted
				}
			}
		} catch {
			// localStorage unavailable
		}
	}

	loadFromStorage()

	const get = (path: FilePath): Partial<LocalStorageFileState> | null => {
		const state = memory.get(path)
		if (state) {
			touchAccess(path)
		}
		return state ?? null
	}

	const set = (path: FilePath, update: Partial<LocalStorageFileState>): void => {
		const existing = memory.get(path)

		const newState: LocalStorageFileState = {
			cursor: update.cursor !== undefined ? update.cursor : (existing?.cursor ?? null),
			selections: update.selections !== undefined ? update.selections : (existing?.selections ?? null),
			scroll: update.scroll !== undefined ? update.scroll : (existing?.scroll ?? null),
			visible: update.visible !== undefined ? update.visible : (existing?.visible ?? null),
			viewMode: update.viewMode !== undefined ? update.viewMode : (existing?.viewMode ?? null),
			isDirty: update.isDirty !== undefined ? update.isDirty : (existing?.isDirty ?? false),
			savedAt: Date.now(),
		}

		const oldSize = entrySizes.get(path) ?? 0
		const newSize = JSON.stringify(newState).length * 2
		totalSize = totalSize - oldSize + newSize
		entrySizes.set(path, newSize)

		memory.set(path, newState)
		touchAccess(path)
		pendingWrites.add(path)
		evictIfNeeded()
		scheduleFlush()
	}

	const clear = (path: FilePath): void => {
		removeEntry(path)
		pendingWrites.delete(path)
	}

	const clearAll = (): void => {
		memory.clear()
		accessOrder.clear()
		entrySizes.clear()
		totalSize = 0
		pendingWrites.clear()

		if (flushTimeout) {
			clearTimeout(flushTimeout)
			flushTimeout = null
		}

		try {
			const keysToRemove: string[] = []
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i)
				if (key && key.startsWith(prefix)) {
					keysToRemove.push(key)
				}
			}
			for (const key of keysToRemove) {
				localStorage.removeItem(key)
			}
		} catch {
			// Ignore
		}
	}

	const flush = (): void => {
		if (flushTimeout) {
			clearTimeout(flushTimeout)
			flushTimeout = null
		}
		flushToStorage()
	}

	const getStats = (): { entries: number; approximateSize: number } => {
		return {
			entries: memory.size,
			approximateSize: totalSize,
		}
	}

	return { get, set, clear, clearAll, flush, getStats }
}
