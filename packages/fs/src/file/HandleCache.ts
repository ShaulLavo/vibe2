/**
 * Simple LRU cache for directory handles.
 * Uses a Map (which maintains insertion order) and moves accessed items to the end.
 *
 * VFS owns handle caching - this is I/O infrastructure that avoids repeated
 * directory traversal. Document layer owns everything else (content, highlights, etc).
 */
export class HandleCache {
	readonly #maxSize: number
	readonly #cache = new Map<string, FileSystemDirectoryHandle>()

	constructor(maxSize: number) {
		this.#maxSize = maxSize
	}

	get(key: string): FileSystemDirectoryHandle | undefined {
		const value = this.#cache.get(key)
		if (value !== undefined) {
			this.#cache.delete(key)
			this.#cache.set(key, value)
		}
		return value
	}

	set(key: string, value: FileSystemDirectoryHandle): void {
		if (this.#cache.size >= this.#maxSize) {
			const oldest = this.#cache.keys().next().value
			if (oldest !== undefined) {
				this.#cache.delete(oldest)
			}
		}
		this.#cache.set(key, value)
	}

	invalidatePrefix(prefix: string): void {
		const toDelete: string[] = []
		for (const key of this.#cache.keys()) {
			if (key === prefix || key.startsWith(prefix + '/')) {
				toDelete.push(key)
			}
		}
		for (const key of toDelete) {
			this.#cache.delete(key)
		}
	}

	clear(): void {
		this.#cache.clear()
	}

	get size(): number {
		return this.#cache.size
	}
}
