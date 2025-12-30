/**
 * Global trace for cross-component performance measurement.
 * Use startGlobalTrace('keystroke') at input, endGlobalTrace('keystroke') when render completes.
 */

import { loggers } from '@repo/logger'

type TraceData = {
	start: number
	meta?: string
	marks?: Array<{ t: number; label: string }>
	stats?: Map<string, { total: number; count: number }>
}

const globalTraces = new Map<string, TraceData>()
const traceLog = loggers.codeEditor.withTag('trace')
const MAX_TRACE_MARKS = 40
const MAX_TRACE_STAT_LINES = 8

export const startGlobalTrace = (name: string, meta?: string): void => {
	globalTraces.set(name, { start: performance.now(), meta })
}

export const markGlobalTrace = (name: string, label: string): void => {
	const trace = globalTraces.get(name)
	if (!trace) return
	const marks = (trace.marks ??= [])
	if (marks.length >= MAX_TRACE_MARKS) return
	marks.push({ t: performance.now(), label })
}

export const endGlobalTrace = (name: string, label = 'total'): number => {
	const trace = globalTraces.get(name)
	if (trace) {
		const end = performance.now()
		const duration = end - trace.start
		const metaStr = trace.meta ? ` [${trace.meta}]` : ''
		traceLog.debug(`⏱ ${name}:${label}${metaStr} ${duration.toFixed(1)}ms`)

		const stats = trace.stats
		if (stats && stats.size > 0) {
			const rows = Array.from(stats.entries())
				.map(([statLabel, entry]) => ({
					label: statLabel,
					total: entry.total,
					count: entry.count,
				}))
				.sort((a, b) => b.total - a.total)
				.slice(0, MAX_TRACE_STAT_LINES)

			for (const row of rows) {
				traceLog.debug(
					`⏱ ${name}:stat${metaStr} ${row.label} ${row.total.toFixed(1)}ms (${row.count}x)`
				)
			}
		}

		const marks = trace.marks
		if (marks && marks.length > 0) {
			const deltas: Array<{ label: string; dt: number }> = []
			let prev = trace.start
			for (const mark of marks) {
				deltas.push({ label: mark.label, dt: mark.t - prev })
				prev = mark.t
			}
			deltas.push({ label: 'end', dt: end - prev })

			deltas.sort((a, b) => b.dt - a.dt)
			const top = deltas.slice(0, MAX_TRACE_STAT_LINES)
			for (const row of top) {
				traceLog.debug(
					`⏱ ${name}:mark${metaStr} ${row.label} ${row.dt.toFixed(1)}ms`
				)
			}
		}

		globalTraces.delete(name)
		return duration
	}
	return 0
}

export const hasGlobalTrace = (name: string): boolean => {
	return globalTraces.has(name)
}

export const addGlobalTraceStat = (
	name: string,
	label: string,
	durationMs: number,
	count = 1
): void => {
	const trace = globalTraces.get(name)
	if (!trace) return
	const stats = (trace.stats ??= new Map())
	const existing = stats.get(label)
	if (existing) {
		existing.total += durationMs
		existing.count += count
		return
	}
	stats.set(label, { total: durationMs, count })
}
