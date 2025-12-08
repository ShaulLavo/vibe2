import localforage from 'localforage'
import {
	createFs,
	createStore,
	getRootDirectory,
	createSyncStore
} from '@repo/fs'

type Store = {
	setItem(key: string, value: unknown): Promise<unknown>
	getItem<T>(key: string): Promise<T | null>
	removeItem(key: string): Promise<void>
	clear(): Promise<void>
	flush?(): Promise<void>
}

type StoreAdapter = {
	name: string
	create(): Promise<Store>
	enabled: boolean
}

type Scenario = {
	name: string
	items: number
	valueBytes: number
	order: 'sequential' | 'random'
}

type ScenarioResult = {
	store: string
	items: number
	valueBytes: number
	writeMs: number
	readMs: number
	removeMs: number
	totalMs: number
}

const BENCH_ROOT = 'vfs-store-bench-worker-v3'
const STORE_FILE = 'store.json'
const SYNC_STORE_NAME = 'sync-store'

const scenarios: Scenario[] = [
	{ name: 'sequential', items: 500, valueBytes: 1024, order: 'sequential' },
	{ name: 'random-access', items: 500, valueBytes: 1024, order: 'random' },
	{ name: 'large-values', items: 200, valueBytes: 65536, order: 'random' }
]

const supportsOpfs = () =>
	typeof navigator !== 'undefined' &&
	!!navigator.storage &&
	typeof navigator.storage.getDirectory === 'function'

const supportsIndexedDb = () =>
	typeof indexedDB !== 'undefined' &&
	(typeof localforage.supports !== 'function' ||
		localforage.supports(localforage.INDEXEDDB))

const pad = (bytes: number) => 'x'.repeat(bytes)

const makeValue = (bytes: number, index: number) =>
	`${index.toString().padStart(6, '0')}:${pad(bytes)}`

const shuffle = (input: number[]) => {
	for (let i = input.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const a = input[i]!
		const b = input[j]!
		input[i] = b
		input[j] = a
	}
	return input
}

const measure = async (action: () => Promise<void>): Promise<number> => {
	const start = performance.now()
	await action()
	return performance.now() - start
}

const localforageIndexedDbAdapter: StoreAdapter = {
	name: 'localforage (IndexedDB)',
	enabled: supportsIndexedDb(),
	async create() {
		const lf = localforage.createInstance({
			name: 'bench-store-worker',
			driver: localforage.INDEXEDDB
		})
		await lf.setDriver(localforage.INDEXEDDB)
		await lf.ready()
		await lf.clear()
		return {
			setItem: (key, value) => lf.setItem(key, value),
			getItem: key => lf.getItem(key),
			removeItem: key => lf.removeItem(key),
			clear: () => lf.clear()
		}
	}
}

const vfsOpfsAdapter: StoreAdapter = {
	name: 'vfs store (OPFS async)',
	enabled: supportsOpfs(),
	async create() {
		const root = await getRootDirectory('opfs', BENCH_ROOT)
		const fs = createFs(root)
		const store = createStore(fs, { filePath: STORE_FILE })
		await store.clear()
		return store
	}
}

const syncOpfsAdapter: StoreAdapter = {
	name: 'vfs store (OPFS sync)',
	enabled:
		supportsOpfs() &&
		typeof (FileSystemFileHandle.prototype as any).createSyncAccessHandle ===
			'function',
	async create() {
		const store = await createSyncStore(SYNC_STORE_NAME)
		await store.clear()
		return store
	}
}

const adapters = [localforageIndexedDbAdapter, vfsOpfsAdapter, syncOpfsAdapter]

const runScenario = async (
	adapter: StoreAdapter,
	scenario: Scenario
): Promise<ScenarioResult> => {
	const store = await adapter.create()
	const keys = Array.from(
		{ length: scenario.items },
		(_, i) => `key-${i.toString().padStart(6, '0')}`
	)
	const values = keys.map((_, i) => makeValue(scenario.valueBytes, i))

	const writeOrder =
		scenario.order === 'random'
			? shuffle([...keys.keys()].map(i => i))
			: [...keys.keys()]

	const readOrder =
		scenario.order === 'random'
			? shuffle([...keys.keys()].map(i => i))
			: [...keys.keys()]

	const removeOrder =
		scenario.order === 'random'
			? shuffle([...keys.keys()].map(i => i))
			: [...keys.keys()]

	const writeMs = await measure(async () => {
		for (const index of writeOrder) {
			await store.setItem(keys[index]!, values[index]!)
		}
		await store.flush?.()
	})

	const readMs = await measure(async () => {
		let missing = 0
		for (const index of readOrder) {
			const value = await store.getItem<string>(keys[index]!)
			if (value == null) missing++
		}
		if (missing > 0) {
			console.warn(
				`[store bench worker][${adapter.name}] missing ${missing} items in ${scenario.name}`
			)
		}
	})

	const removeMs = await measure(async () => {
		for (const index of removeOrder) {
			await store.removeItem(keys[index]!)
		}
		await store.flush?.()
	})

	await store.clear()

	const totalMs = writeMs + readMs + removeMs

	return {
		store: adapter.name,
		items: scenario.items,
		valueBytes: scenario.valueBytes,
		writeMs,
		readMs,
		removeMs,
		totalMs
	}
}

self.addEventListener('message', async event => {
	if (event.data?.type !== 'run') return

	try {
		const runnableAdapters = adapters.filter(adapter => adapter.enabled)
		const payload: { scenario: Scenario; results: ScenarioResult[] }[] = []

		for (const scenario of scenarios) {
			const results: ScenarioResult[] = []
			for (const adapter of runnableAdapters) {
				results.push(await runScenario(adapter, scenario))
			}
			payload.push({ scenario, results })
		}

		;(self as DedicatedWorkerGlobalScope).postMessage({
			type: 'results',
			payload
		})
	} catch (error) {
		;(self as DedicatedWorkerGlobalScope).postMessage({
			type: 'error',
			error: error instanceof Error ? error.message : String(error)
		})
	}
})
