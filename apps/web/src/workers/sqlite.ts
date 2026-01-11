import * as Comlink from 'comlink'
import sqlite3InitModule, {
	type Database,
	type Sqlite3Static,
} from 'sqlite-wasm'
import {
	createClient,
	type Sqlite3Client,
	type Config,
	type InArgs,
} from 'sqlite-wasm/client'
import wasmUrl from 'sqlite-wasm/sqlite3.wasm?url'
import proxyUrl from 'sqlite-wasm/sqlite3-opfs-async-proxy.js?url'
import * as searchImpl from './search-impl'
import type { FileMetadata, SearchResult } from '../search/types'

let sqlite3: Sqlite3Static | null = null
let client: Sqlite3Client | null = null
let db: Database | null = null
let initPromise: Promise<{ version: string; opfsEnabled: boolean }> | null =
	null
let clientCofig: Config = { url: 'file:/vibe.sqlite3' }

const getClient = (): Sqlite3Client => {
	if (!client) {
		throw new Error('SQLite not initialized. Call init() first.')
	}
	return client
}

const performInit = async (): Promise<{
	version: string
	opfsEnabled: boolean
}> => {
	if (!sqlite3) {
		sqlite3 = await sqlite3InitModule({
			print: () => {},
			printErr: () => {},
			locateFile: (file: string) => {
				if (file.endsWith('.wasm')) return wasmUrl
				return file
			},
			opfsProxyUrl: proxyUrl,
		})
	}

	const opfsEnabled = 'opfs' in sqlite3
	clientCofig = {
		url: opfsEnabled ? 'file:/vibe.sqlite3' : ':memory:',
	}
	;[client, db] = createClient(clientCofig, sqlite3)

	await searchImpl.ensureSchema(client)

	return { version: sqlite3.version.libVersion, opfsEnabled }
}

const init = async (): Promise<{ version: string; opfsEnabled: boolean }> => {
	if (client && sqlite3) {
		return {
			version: sqlite3.version.libVersion,
			opfsEnabled: 'opfs' in sqlite3,
		}
	}
	if (!initPromise) {
		initPromise = performInit()
	}
	return initPromise
}

const exec = async (sql: string): Promise<void> => {
	await getClient().execute(sql)
}

const run = async <T = Record<string, unknown>>(
	sql: string,
	params?: InArgs
): Promise<{ columns: string[]; rows: T[] }> => {
	const result = await getClient().execute({
		sql,
		args: params,
	})

	const rows = result.rows.map((row) => {
		const obj: Record<string, unknown> = {}
		for (const col of result.columns) {
			const index = result.columns.indexOf(col)
			obj[col] = row[index]
		}
		return obj as T
	})

	return {
		columns: result.columns,
		rows,
	}
}

const batchInsertFiles = async (files: FileMetadata[]): Promise<void> => {
	return searchImpl.batchInsertFiles(getClient(), files)
}

const searchFiles = async (query: string): Promise<SearchResult[]> => {
	return searchImpl.searchFiles(getClient(), query)
}

const removeFromIndex = async (
	path: string,
	options?: { recursive?: boolean }
): Promise<number> => {
	return searchImpl.removeFromIndex(getClient(), path, options)
}

const renameInIndex = async (
	oldPath: string,
	newPath: string,
	options?: { recursive?: boolean }
): Promise<number> => {
	return searchImpl.renameInIndex(getClient(), oldPath, newPath, options)
}

const reset = async (): Promise<void> => {
	if (db) {
		try {
			db.close()
		} catch {
			// Ignore close errors
		}
		db = null
		client = null
	}

	try {
		const root = await navigator.storage.getDirectory()
		await root.removeEntry('vibe.sqlite3')
	} catch {
		// OPFS file might not exist
	}

	initPromise = null
	await performInit()
}

const workerApi = {
	init,
	exec,
	run,
	reset,
	batchInsertFiles,
	searchFiles,
	removeFromIndex,
	renameInIndex,
}

export type SqliteWorkerApi = typeof workerApi
export type { FileMetadata, SearchResult }

Comlink.expose(workerApi)
