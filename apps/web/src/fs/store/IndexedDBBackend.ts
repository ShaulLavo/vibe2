import type { FilePath } from '@repo/fs'
import type { FileState } from './types'
import type { PersistenceBackend } from './FileStateStore'

const DB_NAME = 'file-state-store'
const DB_VERSION = 1
const STORE_NAME = 'files'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)

		request.onerror = () => reject(request.error)
		request.onsuccess = () => resolve(request.result)

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'path' })
			}
		}
	})

	return dbPromise
}

export function createIndexedDBBackend(): PersistenceBackend {
	return {
		async load(path: FilePath): Promise<Partial<FileState> | null> {
			try {
				const db = await openDB()
				return new Promise((resolve, reject) => {
					const tx = db.transaction(STORE_NAME, 'readonly')
					const store = tx.objectStore(STORE_NAME)
					const request = store.get(path)

					request.onerror = () => reject(request.error)
					request.onsuccess = () => {
						const result = request.result
						if (!result) {
							resolve(null)
							return
						}
						// Remove path from result (it's in the key)
						const { path: _path, ...state } = result
						resolve(state)
					}
				})
			} catch {
				return null
			}
		},

		async save(path: FilePath, state: FileState): Promise<void> {
			try {
				const db = await openDB()
				return new Promise((resolve, reject) => {
					const tx = db.transaction(STORE_NAME, 'readwrite')
					const store = tx.objectStore(STORE_NAME)

					// Only persist serializable data
					const toSave = {
						path,
						pieceTable: state.pieceTable,
						stats: state.stats,
						syntax: state.syntax,
						scrollPosition: state.scrollPosition,
						visibleContent: state.visibleContent,
						viewMode: state.viewMode,
						previewBytes: state.previewBytes,
						lineStarts: state.lineStarts,
						lastAccessed: state.lastAccessed,
					}

					const request = store.put(toSave)
					request.onerror = () => reject(request.error)
					request.onsuccess = () => resolve()
				})
			} catch {
				// Ignore persistence errors
			}
		},

		async remove(path: FilePath): Promise<void> {
			try {
				const db = await openDB()
				return new Promise((resolve, reject) => {
					const tx = db.transaction(STORE_NAME, 'readwrite')
					const store = tx.objectStore(STORE_NAME)
					const request = store.delete(path)

					request.onerror = () => reject(request.error)
					request.onsuccess = () => resolve()
				})
			} catch {
				// Ignore persistence errors
			}
		},

		async clear(): Promise<void> {
			try {
				const db = await openDB()
				return new Promise((resolve, reject) => {
					const tx = db.transaction(STORE_NAME, 'readwrite')
					const store = tx.objectStore(STORE_NAME)
					const request = store.clear()

					request.onerror = () => reject(request.error)
					request.onsuccess = () => resolve()
				})
			} catch {
				// Ignore persistence errors
			}
		},
	}
}
