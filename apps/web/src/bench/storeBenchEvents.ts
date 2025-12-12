import type {
	BenchProgressPayload,
	BenchScenario,
	BenchScenarioResultsPayload,
} from './types'

const HISTORY_LIMIT = 512

export type StoreBenchEventBase =
	| { type: 'reset' }
	| { type: 'manifest'; payload: { scenarios: BenchScenario[] } }
	| { type: 'progress'; payload: BenchProgressPayload }
	| { type: 'scenario-complete'; payload: BenchScenarioResultsPayload }
	| { type: 'results'; payload: BenchScenarioResultsPayload[] }
	| { type: 'skipped'; reason?: string }
	| { type: 'error'; error: Error }

export type StoreBenchEvent = StoreBenchEventBase & { timestamp: number }

type Listener = (event: StoreBenchEvent) => void

const listeners = new Set<Listener>()
const history: StoreBenchEvent[] = []

const addToHistory = (event: StoreBenchEvent) => {
	if (event.type === 'reset') {
		history.length = 0
		history.push(event)
		return
	}

	history.push(event)
	if (history.length > HISTORY_LIMIT) {
		history.shift()
	}
}

export const emitStoreBenchEvent = (
	event: StoreBenchEventBase
): StoreBenchEvent => {
	const timedEvent: StoreBenchEvent = {
		...event,
		timestamp: Date.now(),
	}
	addToHistory(timedEvent)
	for (const listener of listeners) {
		try {
			listener(timedEvent)
		} catch {
			// Ignore listener errors to prevent one failure from breaking the event loop
		}
	}
	return timedEvent
}

export const subscribeStoreBenchEvents = (
	listener: Listener,
	options?: { replay?: boolean }
): (() => void) => {
	const replay = options?.replay ?? true
	// Register listener before replay to avoid missing events emitted during replay
	listeners.add(listener)
	if (replay) {
		// Replay from a snapshot to iterate over a stable copy
		const snapshot = history.slice()
		for (const event of snapshot) {
			try {
				listener(event)
			} catch {
				// Ignore listener errors during replay to prevent breaking the replay loop
			}
		}
	}
	return () => {
		listeners.delete(listener)
	}
}

export const getStoreBenchEventHistory = (): StoreBenchEvent[] => [...history]
