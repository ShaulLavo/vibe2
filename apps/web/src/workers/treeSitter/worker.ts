import { expose } from 'comlink'
import type { TreeSitterWorkerApi } from './types'
import {
	subscribeMinimapReady,
	unsubscribeMinimapReady,
	clearMinimapSubscribers,
	clearAstCache,
} from './cache'
import { ensureParser, disposeParser } from './parser'
import {
	processTree,
	parseBufferAndCache,
	reparseWithEdit,
	reparseWithEditBatch,
} from './parse'
import {
	generateMinimapSummary,
	generateMinimapSummaryFromText,
} from './minimap'
import { logger } from '../../logger'

const log = logger.withTag('treeSitter')

const api: TreeSitterWorkerApi = {
	async init() {
		await ensureParser()
	},
	async parse(source) {
		// This old parse method assumes TSX or default language which is not ideal anymore
		// But it's usually not used?
		// We'll default to typescript if called without context, or just fail.
		const res = await ensureParser('typescript')
		if (!res) return undefined
		const { parser } = res
		const tree = parser.parse(source)
		if (!tree) return undefined
		const result = await processTree(tree, 'typescript')
		tree.delete()
		return result
	},
	async parseBuffer(payload) {
		return parseBufferAndCache(payload.path, payload.buffer)
	},
	async applyEdit(payload) {
		return reparseWithEdit(payload.path, payload)
	},
	async applyEditBatch(payload) {
		return reparseWithEditBatch(payload.path, payload.edits)
	},
	subscribeMinimapReady(callback) {
		return subscribeMinimapReady(callback)
	},
	unsubscribeMinimapReady(id) {
		unsubscribeMinimapReady(id)
	},
	async getMinimapSummary(payload) {
		return generateMinimapSummary(
			payload.path,
			payload.version,
			payload.maxChars ?? 160
		)
	},
	async getMinimapSummaryFromText(payload) {
		return generateMinimapSummaryFromText(
			payload.text,
			payload.version,
			payload.maxChars ?? 160
		)
	},
	async dispose() {
		disposeParser()
		clearMinimapSubscribers()
		clearAstCache()
	},
}

expose(api)

// Handle MessagePort connections from minimap worker
self.addEventListener('message', (event: MessageEvent) => {
	if (
		event.data?.type === 'connect-port' &&
		event.data.port instanceof MessagePort
	) {
		log.info('Received port connection from minimap worker')
		// Explicit MessagePort transfers make origin checks unnecessary in this same-origin worker context.
		// Expose the API on the port for direct worker-to-worker communication
		expose(api, event.data.port)
	}
})
