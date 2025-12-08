import localforage from 'localforage'
import { createFs, createStore, getRootDirectory } from '@repo/fs'

type StoreAdapter = {
	name: string
	create(): Promise<Store>
	enabled: boolean
}

type Store = {
	setItem(key: string, value: unknown): Promise<unknown>
	getItem<T>(key: string): Promise<T | null>
	removeItem(key: string): Promise<void>
	clear(): Promise<void>
	flush?(): Promise<void>
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

const BENCH_ROOT = 'vfs-store-bench-v8'
const STORE_FILE = 'store.json'

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
			name: 'bench-store',
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

const adapters = [localforageIndexedDbAdapter, vfsOpfsAdapter]

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
		// Ensure batched stores flush to disk before measuring
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
				`[store bench][${adapter.name}] missing ${missing} items in ${scenario.name}`
			)
		}
	})

	const removeMs = await measure(async () => {
		for (const index of removeOrder) {
			await store.removeItem(keys[index]!)
		}
		// Ensure batched stores flush to disk before measuring
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

const formatNumber = (value: number, digits = 2) =>
	Number(value.toFixed(digits))

const logScenarioResults = (scenario: Scenario, results: ScenarioResult[]) => {
	const rows = results.map(result => ({
		store: result.store,
		items: result.items,
		valueBytes: result.valueBytes,
		writeMs: formatNumber(result.writeMs),
		readMs: formatNumber(result.readMs),
		removeMs: formatNumber(result.removeMs),
		totalMs: formatNumber(result.totalMs)
	}))

	const winner = rows.reduce((best, current) =>
		current.totalMs < best.totalMs ? current : best
	)

	console.groupCollapsed(
		`[store bench] ${scenario.name} — items=${scenario.items} valueBytes=${scenario.valueBytes}`
	)
	console.table(rows)
	console.info(
		`👑 Winner: ${winner.store} (${winner.totalMs.toFixed(2)} ms total)`
	)
	console.groupEnd()
}

const runStoreBenchmarksInWorker = async () => {
	if (typeof Worker === 'undefined') return false

	try {
		const worker = new Worker(
			new URL('./vfsStoreBench.worker.ts', import.meta.url),
			{ type: 'module' }
		)

		const scenarioResults = await new Promise<
			{ scenario: Scenario; results: ScenarioResult[] }[]
		>((resolve, reject) => {
			worker.onmessage = event => {
				if (event.data?.type === 'results') {
					resolve(event.data.payload)
					worker.terminate()
					return
				}
				if (event.data?.type === 'error') {
					reject(new Error(event.data.error))
					worker.terminate()
					return
				}
			}
			worker.onerror = error => {
				reject(error.error ?? error.message ?? error)
				worker.terminate()
			}

			worker.postMessage({ type: 'run' })
		})

		for (const { scenario, results } of scenarioResults) {
			logScenarioResults(scenario, results)
		}

		return true
	} catch (error) {
		console.warn('[store bench] worker failed, falling back', error)
		return false
	}
}

export const runStoreBenchmarks = async () => {
	const usedWorker = await runStoreBenchmarksInWorker()
	if (usedWorker) return

	const runnableAdapters = adapters.filter(adapter => adapter.enabled)

	if (runnableAdapters.length === 0) {
		console.info(
			'[store bench] skipped: no available adapters (OPFS/localforage)'
		)
		return
	}

	try {
		for (const scenario of scenarios) {
			const results: ScenarioResult[] = []
			for (const adapter of runnableAdapters) {
				results.push(await runScenario(adapter, scenario))
			}
			logScenarioResults(scenario, results)
		}
	} catch (error) {
		console.error('[store bench] failed', error)
	}
}
