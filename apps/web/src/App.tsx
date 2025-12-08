import { releaseProxy, wrap, type Remote } from 'comlink'
import { type Component, onCleanup, onMount } from 'solid-js'
import Main from './Main'
import { Providers } from './Providers'
import { pingServerRoutes } from '~/serverRoutesProbe'
import type { TreeSitterWorkerApi } from './workers/treeSitterWorkerTypes'

type TreeSitterWorkerHandle = {
	worker: Worker
	proxy: Remote<TreeSitterWorkerApi>
}

const supportsWorkers =
	typeof window !== 'undefined' && typeof Worker !== 'undefined'

const createTreeSitterWorker = () =>
	new Worker(new URL('./workers/treeSitter.worker.ts', import.meta.url), {
		type: 'module'
	})

let treeSitterWorkerHandle: TreeSitterWorkerHandle | null = null
let treeSitterWorkerInitPromise: Promise<void> | null = null

const getTreeSitterWorkerHandle = (): TreeSitterWorkerHandle | null => {
	if (!supportsWorkers) return null
	if (!treeSitterWorkerHandle) {
		const worker = createTreeSitterWorker()
		const proxy = wrap<TreeSitterWorkerApi>(worker)
		treeSitterWorkerHandle = { worker, proxy }
	}
	return treeSitterWorkerHandle
}

const ensureTreeSitterWorkerReady = async () => {
	const handle = getTreeSitterWorkerHandle()
	if (!handle) return null

	if (!treeSitterWorkerInitPromise) {
		treeSitterWorkerInitPromise = handle.proxy.init().catch(error => {
			treeSitterWorkerInitPromise = null
			throw error
		})
	}

	await treeSitterWorkerInitPromise
	return handle
}

const disposeTreeSitterWorker = async () => {
	if (!treeSitterWorkerHandle) return
	try {
		await treeSitterWorkerHandle.proxy.dispose()
	} catch {
		// ignore dispose errors
	}
	;(treeSitterWorkerHandle.proxy as unknown as Record<symbol, () => void>)[
		releaseProxy
	]?.()
	treeSitterWorkerHandle.worker.terminate()
	treeSitterWorkerHandle = null
	treeSitterWorkerInitPromise = null
}

const runTreeSitterDemo = async () => {
	try {
		const handle = await ensureTreeSitterWorkerReady()
		if (!handle) {
			console.warn('[Tree-sitter worker demo] Web Workers unavailable')
			return
		}
		const tree = await handle.proxy.parse('const answer = 40 + 2')
		if (!tree) {
			console.warn('[Tree-sitter worker demo] parse returned null')
			return
		}

		console.info('[Tree-sitter worker demo]', tree)
	} catch (error) {
		console.error('[Tree-sitter worker demo] failed', error)
	}
}

const runStoreBenchInDev = async () => {
	if (!import.meta.env.DEV) return
	try {
		const { runStoreBenchmarks } = await import('./bench/vfsStoreBench')
		await runStoreBenchmarks()
	} catch (error) {
		console.error('[VfsStore bench] failed to start', error)
	}
}

const App: Component = () => {
	onMount(() => {
		void pingServerRoutes()
		void runTreeSitterDemo()
		void runStoreBenchInDev()
	})
	onCleanup(() => {
		void disposeTreeSitterWorker()
	})
	return (
		<Providers>
			<Main />
		</Providers>
	)
}

export default App
