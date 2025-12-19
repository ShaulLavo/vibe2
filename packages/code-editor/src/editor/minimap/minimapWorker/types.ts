import type { MinimapTokenSummary } from '../tokenSummary'
import type { MinimapLayout } from '../workerTypes'

export type { MinimapTokenSummary, MinimapLayout }

/**
 * Minimal Tree-sitter worker interface for minimap communication
 */
export type TreeSitterMinimapApi = {
	subscribeMinimapReady(callback: (payload: { path: string }) => void): number
	unsubscribeMinimapReady(id: number): void
	getMinimapSummary(payload: {
		path: string
		version: number
		maxChars?: number
	}): Promise<MinimapTokenSummary | undefined>
}
