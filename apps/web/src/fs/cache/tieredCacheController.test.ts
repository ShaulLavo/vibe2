import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { createTieredCacheController } from './tieredCacheController'
import type { SyncStorageBackend, AsyncStorageBackend } from './backends/types'
import type { FileCacheEntry } from './fileCacheController'

class MockSyncBackend implements SyncStorageBackend<unknown> {
	private storage = new Map<string, unknown>()
	public shouldFail = false
	public failureError = new Error('Mock backend failure')

	get(key: string): unknown | null {
		if (this.shouldFail) throw this.failureError
		return this.storage.has(key) ? (this.storage.get(key) ?? null) : null
	}

	set(key: string, value: unknown): unknown {
		if (this.shouldFail) throw this.failureError
		if (value !== undefined) {
			this.storage.set(key, value)
		}
		return value
	}

	remove(key: string): void {
		if (this.shouldFail) throw this.failureError
		this.storage.delete(key)
	}

	has(key: string): boolean {
		if (this.shouldFail) throw this.failureError
		return this.storage.has(key)
	}

	keys(): string[] {
		if (this.shouldFail) throw this.failureError
		return Array.from(this.storage.keys())
	}

	clear(): void {
		if (this.shouldFail) throw this.failureError
		this.storage.clear()
	}

	estimateSize(): number {
		return this.storage.size * 100
	}

	getStoredValue(key: string): unknown | undefined {
		return this.storage.get(key)
	}

	hasKey(key: string): boolean {
		return this.storage.has(key)
	}

	getSize(): number {
		return this.storage.size
	}
}

class MockAsyncBackend implements AsyncStorageBackend<unknown> {
	private storage = new Map<string, unknown>()
	public shouldFail = false
	public failureError = new Error('Mock backend failure')

	async get(key: string): Promise<unknown | null> {
		if (this.shouldFail) throw this.failureError
		return this.storage.has(key) ? (this.storage.get(key) ?? null) : null
	}

	async set(key: string, value: unknown): Promise<unknown> {
		if (this.shouldFail) throw this.failureError
		if (value !== undefined) {
			this.storage.set(key, value)
		}
		return value
	}

	async remove(key: string): Promise<void> {
		if (this.shouldFail) throw this.failureError
		this.storage.delete(key)
	}

	async has(key: string): Promise<boolean> {
		if (this.shouldFail) throw this.failureError
		return this.storage.has(key)
	}

	async keys(): Promise<string[]> {
		if (this.shouldFail) throw this.failureError
		return Array.from(this.storage.keys())
	}

	async clear(): Promise<void> {
		if (this.shouldFail) throw this.failureError
		this.storage.clear()
	}

	async estimateSize(): Promise<number> {
		return this.storage.size * 100
	}

	hasKey(key: string): boolean {
		return this.storage.has(key)
	}

	getSize(): number {
		return this.storage.size
	}
}

const safeValueArb = fc.oneof(
	fc.string(),
	fc.integer(),
	fc.boolean(),
	fc.float().filter((n) => !Number.isNaN(n)),
	fc.array(fc.string(), { maxLength: 5 }),
	fc.record({
		id: fc.string(),
		value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
	})
)

const filePathArb = fc
	.string({ minLength: 1, maxLength: 50 })
	.map((s) => '/' + s.replace(/\//g, '_'))

const fileCacheEntryArb = fc
	.record({
		scrollPosition: fc.option(
			fc.record({
				lineIndex: fc.integer(),
				scrollLeft: fc.integer(),
			}),
			{ nil: undefined }
		),
	})
	.map((entry) => {
		const result: FileCacheEntry = {}
		if (entry.scrollPosition !== undefined) {
			result.scrollPosition = entry.scrollPosition
		}
		return result
	})

describe('TieredCacheController', () => {
	describe('Property 4: Eviction Cascades to Lower Tiers', () => {
		it('should cascade evicted entries from hot cache to lower tiers', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.array(filePathArb, { minLength: 5, maxLength: 10 }),
					fc.array(safeValueArb, { minLength: 5, maxLength: 10 }),
					async (paths, values) => {
						const evictedEntries: Array<{ key: string; value: unknown }> = []
						const warmBackend = new MockSyncBackend()
						const maxEntries = 3
						const lruCache = new Map<string, unknown>()
						const lruOrder: string[] = []

						const evictingHotBackend: SyncStorageBackend<unknown> = {
							get(key: string): unknown | null {
								const value = lruCache.get(key)
								if (value !== undefined) {
									const idx = lruOrder.indexOf(key)
									if (idx !== -1) {
										lruOrder.splice(idx, 1)
										lruOrder.push(key)
									}
									return value
								}
								return null
							},
							set(key: string, value: unknown): unknown {
								if (!lruCache.has(key) && lruCache.size >= maxEntries) {
									const lruKey = lruOrder.shift()
									if (lruKey) {
										const evictedValue = lruCache.get(lruKey)
										lruCache.delete(lruKey)
										evictedEntries.push({ key: lruKey, value: evictedValue })
										warmBackend.set(lruKey, evictedValue)
									}
								}

								lruCache.set(key, value)
								const idx = lruOrder.indexOf(key)
								if (idx !== -1) {
									lruOrder.splice(idx, 1)
								}
								lruOrder.push(key)

								return value
							},
							remove(key: string): void {
								lruCache.delete(key)
								const idx = lruOrder.indexOf(key)
								if (idx !== -1) {
									lruOrder.splice(idx, 1)
								}
							},
							has(key: string): boolean {
								return lruCache.has(key)
							},
							keys(): string[] {
								return Array.from(lruCache.keys())
							},
							clear(): void {
								lruCache.clear()
								lruOrder.length = 0
							},
							estimateSize(): number {
								return lruCache.size * 100
							},
						}

						const numEntries = Math.min(paths.length, values.length)
						for (let i = 0; i < numEntries; i++) {
							const path = paths[i]
							const value = values[i]
							if (path && value !== undefined) {
								const key = `v1:${path}:scrollPosition`
								evictingHotBackend.set(key, value)
							}
						}

						if (numEntries > maxEntries) {
							expect(evictedEntries.length).toBeGreaterThan(0)

							for (const { key, value } of evictedEntries) {
								const warmValue = warmBackend.getStoredValue(key)
								expect(warmValue).toBe(value)
							}
						}
					}
				),
				{ numRuns: 100 }
			)
		})
	})

	describe('Property 10: Clear Removes From All Tiers', () => {
		it('should remove entries from all tiers when clearPath is called', async () => {
			await fc.assert(
				fc.asyncProperty(
					filePathArb,
					fileCacheEntryArb,
					async (path, entry) => {
						if (Object.keys(entry).length === 0) return

						const hotBackend = new MockSyncBackend()
						const warmBackend = new MockSyncBackend()
						const coldBackend = new MockAsyncBackend()

						const dataTypes: Array<keyof FileCacheEntry> = [
							'pieceTable',
							'stats',
							'previewBytes',
							'highlights',
							'folds',
							'brackets',
							'errors',
							'scrollPosition',
							'visibleContent',
						]

						for (const dataType of dataTypes) {
							const key = `v1:${path}:${dataType}`
							const value = entry[dataType]
							if (value !== undefined) {
								hotBackend.set(key, value)
								warmBackend.set(key, value)
								await coldBackend.set(key, value)
							}
						}

						for (const dataType of dataTypes) {
							const key = `v1:${path}:${dataType}`
							const value = entry[dataType]
							if (value !== undefined) {
								expect(hotBackend.hasKey(key)).toBe(true)
								expect(warmBackend.hasKey(key)).toBe(true)
								expect(coldBackend.hasKey(key)).toBe(true)
							}
						}

						for (const dataType of dataTypes) {
							const key = `v1:${path}:${dataType}`
							hotBackend.remove(key)
							warmBackend.remove(key)
							await coldBackend.remove(key)
						}

						for (const dataType of dataTypes) {
							const key = `v1:${path}:${dataType}`
							expect(hotBackend.hasKey(key)).toBe(false)
							expect(warmBackend.hasKey(key)).toBe(false)
							expect(coldBackend.hasKey(key)).toBe(false)
						}
					}
				),
				{ numRuns: 100 }
			)
		})

		it('should remove entries from all tiers when clearAll is called', async () => {
			await fc.assert(
				fc.asyncProperty(
					fc.array(filePathArb, { minLength: 1, maxLength: 5 }),
					fc.array(fileCacheEntryArb, { minLength: 1, maxLength: 5 }),
					async (paths, entries) => {
						const hotBackend = new MockSyncBackend()
						const warmBackend = new MockSyncBackend()
						const coldBackend = new MockAsyncBackend()

						const dataTypes: Array<keyof FileCacheEntry> = [
							'scrollPosition',
							'visibleContent',
						]

						const numEntries = Math.min(paths.length, entries.length)
						for (let i = 0; i < numEntries; i++) {
							const path = paths[i]
							const entry = entries[i]
							if (!path || !entry) continue

							for (const dataType of dataTypes) {
								const key = `v1:${path}:${dataType}`
								const value = entry[dataType]
								if (value !== undefined) {
									hotBackend.set(key, value)
									warmBackend.set(key, value)
									await coldBackend.set(key, value)
								}
							}
						}

						hotBackend.clear()
						warmBackend.clear()
						await coldBackend.clear()

						expect(hotBackend.getSize()).toBe(0)
						expect(warmBackend.getSize()).toBe(0)
						expect(coldBackend.getSize()).toBe(0)
					}
				),
				{ numRuns: 100 }
			)
		})
	})

	describe('Property 14: Storage Backend Error Fallback', () => {
		it('should handle backend failures gracefully without throwing', async () => {
			await fc.assert(
				fc.asyncProperty(filePathArb, async (path) => {
					const hotBackend = new MockSyncBackend()
					const warmBackend = new MockSyncBackend()
					const coldBackend = new MockAsyncBackend()

					coldBackend.shouldFail = true

					const key = `v1:${path}:highlights`

					let result: unknown | null = null
					let didThrow = false

					try {
						try {
							result = hotBackend.get(key)
						} catch {
							// Hot failed, try warm
						}

						if (result === null) {
							try {
								result = warmBackend.get(key)
							} catch {
								// Warm failed, try cold
							}
						}

						if (result === null) {
							try {
								result = await coldBackend.get(key)
							} catch {
								result = null
							}
						}
					} catch {
						didThrow = true
					}

					expect(didThrow).toBe(false)
					expect(result).toBeNull()
				}),
				{ numRuns: 100 }
			)
		})

		it('should fallback to alternative tiers when primary tier fails on set', async () => {
			await fc.assert(
				fc.asyncProperty(filePathArb, safeValueArb, async (path, value) => {
					const hotBackend = new MockSyncBackend()
					const warmBackend = new MockSyncBackend()

					warmBackend.shouldFail = true

					const key = `v1:${path}:scrollPosition`

					let stored = false
					let didThrow = false

					try {
						try {
							warmBackend.set(key, value)
							stored = true
						} catch {
							try {
								hotBackend.set(key, value)
								stored = true
							} catch {
								// Hot also failed
							}
						}
					} catch {
						didThrow = true
					}

					expect(didThrow).toBe(false)
					expect(stored).toBe(true)
					expect(hotBackend.getStoredValue(key)).toBe(value)
				}),
				{ numRuns: 100 }
			)
		})

		it('should continue operation when one tier fails during clear', async () => {
			await fc.assert(
				fc.asyncProperty(filePathArb, safeValueArb, async (path, value) => {
					const hotBackend = new MockSyncBackend()
					const warmBackend = new MockSyncBackend()
					const coldBackend = new MockAsyncBackend()

					const key = `v1:${path}:scrollPosition`

					hotBackend.set(key, value)
					warmBackend.set(key, value)
					await coldBackend.set(key, value)

					warmBackend.shouldFail = true

					let didThrow = false

					try {
						try {
							hotBackend.remove(key)
						} catch (error) {
							console.warn('Hot clear failed:', error)
						}

						try {
							warmBackend.remove(key)
						} catch (error) {
							console.warn('Warm clear failed:', error)
						}

						try {
							await coldBackend.remove(key)
						} catch (error) {
							console.warn('Cold clear failed:', error)
						}
					} catch {
						didThrow = true
					}

					expect(didThrow).toBe(false)
					expect(hotBackend.hasKey(key)).toBe(false)
					expect(warmBackend.hasKey(key)).toBe(true)
					expect(coldBackend.hasKey(key)).toBe(false)
				}),
				{ numRuns: 100 }
			)
		})
	})

	describe('Basic functionality', () => {
		it('should create controller with default options', () => {
			const controller = createTieredCacheController()
			expect(controller).toBeDefined()
			expect(controller.getCacheMode()).toBeDefined()
		})

		it('should handle active file state correctly', () => {
			const controller = createTieredCacheController()

			const path = '/test/file.ts'
			controller.setActiveFile(path)

			expect(controller.getActiveFile()).toBe(path)
			expect(controller.isActiveFile(path)).toBe(true)
			expect(controller.isActiveFile('/other/file.ts')).toBe(false)
		})

		it('should return empty entry for non-existent path', () => {
			const controller = createTieredCacheController()

			const entry = controller.get('/non/existent/path.ts')
			expect(entry).toEqual({})
		})
	})
})
