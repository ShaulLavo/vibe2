/**
 * Global trace for cross-component performance measurement.
 * Use startGlobalTrace('keystroke') at input, endGlobalTrace('keystroke') when render completes.
 */

import { loggers } from '@repo/logger'

type TraceData = {
	start: number
}

const globalTraces = new Map<string, TraceData>()
const traceLog = loggers.codeEditor.withTag('trace')

export const startGlobalTrace = (name: string): void => {
	globalTraces.set(name, { start: performance.now() })
}

export const markGlobalTrace = (name: string, label: string): void => {
	void name
	void label
}

export const endGlobalTrace = (name: string, label = 'total'): number => {
	const trace = globalTraces.get(name)
	if (trace) {
		const duration = performance.now() - trace.start
		traceLog.debug(`⏱ ${name}:${label} ${duration.toFixed(1)}ms`)
		globalTraces.delete(name)
		return duration
	}
	return 0
}

export const hasGlobalTrace = (name: string): boolean => {
	return globalTraces.has(name)
}
