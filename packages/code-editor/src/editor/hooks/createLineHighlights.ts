import { createMemo, createSignal, untrack, type Accessor } from 'solid-js'

import { loggers } from '@repo/logger'

import {
	mergeLineSegments,
	mapRangeToOldOffsets,
	toLineHighlightSegmentsForLine,
	toLineHighlightSegments,
} from '../utils/highlights'
import type {
	EditorError,
	EditorSyntaxHighlight,
	HighlightOffsets,
	LineEntry,
	LineHighlightSegment,
} from '../types'

type ErrorHighlight = { startIndex: number; endIndex: number; scope: string }

type CachedLineHighlights = {
	length: number
	text: string
	segments: LineHighlightSegment[]
	appliedShift: number
}

type PrecomputedLineHighlights = {
	segments: LineHighlightSegment[][]
	indexByLineId: Map<number, number>
}

export type CreateLineHighlightsOptions = {
	highlights?: Accessor<EditorSyntaxHighlight[] | undefined>
	errors?: Accessor<EditorError[] | undefined>
	/** Offset for optimistic updates - applied lazily per-line */
	highlightOffset?: Accessor<HighlightOffsets | undefined>

	lineCount: Accessor<number>
	getLineStart: (index: number) => number
	getLineLength: (index: number) => number
	getLineTextLength: (index: number) => number
}

export const createLineHighlights = (options: CreateLineHighlightsOptions) => {
	const log = loggers.codeEditor.withTag('trace')
	const EMPTY_HIGHLIGHTS: EditorSyntaxHighlight[] = []
	const EMPTY_ERRORS: ErrorHighlight[] = []
	const EMPTY_OFFSETS: HighlightOffsets = []
	const EMPTY_SEGMENTS: LineHighlightSegment[] = []
	const [highlightsRevision, setHighlightsRevision] = createSignal(0)
	const [isPrecomputedReady, setIsPrecomputedReady] = createSignal(false)
	const [retainPrecomputedSegments, setRetainPrecomputedSegments] =
		createSignal(true)

	const sortedHighlights = createMemo(
		(prev: EditorSyntaxHighlight[] | undefined) => {
			const highlights = options.highlights?.()
			if (!highlights?.length) return EMPTY_HIGHLIGHTS

			// If length matches previous, assume same (optimization for perf)
			// A safer check would be shallow comparison, but highlights tend to be immutable
			if (
				prev &&
				prev.length === highlights.length &&
				prev !== EMPTY_HIGHLIGHTS
			) {
				// Check first and last to catch simple shifts/changes
				// Full comparison is O(N) which we want to avoid if possible,
				// but sorting is O(N log N) so O(N) check is cheaper.
				let changed = false
				for (let i = 0; i < highlights.length; i += 100) {
					if (highlights[i] !== prev[i]) {
						changed = true
						break
					}
				}
				if (!changed) return prev
			}

			return highlights.slice().sort((a, b) => a.startIndex - b.startIndex)
		}
	)

	const sortedErrorHighlights = createMemo<ErrorHighlight[]>(() => {
		const errors = options.errors?.()
		if (!errors?.length) return EMPTY_ERRORS

		return errors
			.map((error) => ({
				startIndex: error.startIndex,
				endIndex: error.endIndex,
				scope: error.isMissing ? 'missing' : 'error',
			}))
			.sort((a, b) => a.startIndex - b.startIndex)
	})

	let spatialIndex: Map<number, EditorSyntaxHighlight[]> = new Map()
	let largeHighlights: EditorSyntaxHighlight[] = []
	const SPATIAL_CHUNK_SIZE = 512
	const candidateScratch: EditorSyntaxHighlight[] = []
	let spatialIndexReady = false

	function buildSpatialIndex(highlights: EditorSyntaxHighlight[]) {
		spatialIndex.clear()
		largeHighlights = []

		for (const highlight of highlights) {
			if (
				highlight.startIndex === undefined ||
				highlight.endIndex === undefined ||
				highlight.endIndex <= highlight.startIndex
			) {
				continue
			}

			// If a highlight spans many chunks, treat it as "large" to avoid bloating the index
			// For example, a multi-line comment or string that spans > 10 chunks
			if (highlight.endIndex - highlight.startIndex > SPATIAL_CHUNK_SIZE * 10) {
				largeHighlights.push(highlight)
				continue
			}

			const startChunk = Math.floor(highlight.startIndex / SPATIAL_CHUNK_SIZE)
			const endChunk = Math.floor((highlight.endIndex - 1) / SPATIAL_CHUNK_SIZE)

			for (let i = startChunk; i <= endChunk; i++) {
				let bucket = spatialIndex.get(i)
				if (!bucket) {
					bucket = []
					spatialIndex.set(i, bucket)
				}
				bucket.push(highlight)
			}
		}
	}

	const precomputedSegments = createMemo<PrecomputedLineHighlights | undefined>(
		() => {
			if (!retainPrecomputedSegments()) return undefined

			const count = options.lineCount()
			if (count === 0) {
				setIsPrecomputedReady(false)
				return undefined
			}

			const highlights = sortedHighlights()
			const errors = sortedErrorHighlights()
			const hasHighlights = highlights.length > 0
			const hasErrors = errors.length > 0
			if (!hasHighlights && !hasErrors) {
				setIsPrecomputedReady(false)
				return undefined
			}

			setIsPrecomputedReady(false)
			if (hasHighlights && !spatialIndexReady) {
				const start = performance.now()
				buildSpatialIndex(highlights)
				spatialIndexReady = true
				log.debug(
					`buildSpatialIndex: ${highlights.length} highlights in ${(performance.now() - start).toFixed(2)}ms`
				)
			}

			const start = performance.now()
			log.debug(`precomputedSegments: running full computation for ${count} lines`)

			const highlightSegments = hasHighlights
				? toLineHighlightSegments(
						count,
						options.getLineStart,
						options.getLineLength,
						options.getLineTextLength,
						highlights
					)
				: []
			const errorSegments = hasErrors
				? toLineHighlightSegments(
						count,
						options.getLineStart,
						options.getLineLength,
						options.getLineTextLength,
						errors
					)
				: []

			const indexByLineId = new Map<number, number>()

			// Note: We don't have lineIds here anymore easily?
			// precomputedSegments returned indexByLineId to help mapping?
			// The usage in getLineHighlights used indexByLineId to map cache key (lineId) to index.
			// But getLineHighlights receives `entry`. `entry` knows its index!
			// So indexByLineId might not be needed?
			// Let's check getLineHighlights usage.

			let result: PrecomputedLineHighlights
			if (!hasErrors) {
				result = { segments: highlightSegments, indexByLineId }
			} else if (!hasHighlights) {
				result = { segments: errorSegments, indexByLineId }
			} else {
				const merged: LineHighlightSegment[][] = new Array(count)
				for (let i = 0; i < count; i += 1) {
					const mergedLine = mergeLineSegments(
						highlightSegments[i],
						errorSegments[i]
					)
					if (mergedLine.length > 0) merged[i] = mergedLine
				}
				result = { segments: merged, indexByLineId }
			}

			const durationMs = performance.now() - start
			setIsPrecomputedReady(true)
			log.debug(
				`precomputedSegments: ${count} lines in ${durationMs.toFixed(1)}ms`
			)
			return result
		}
	)

	let precomputedCache = new Map<number, LineHighlightSegment[]>()
	let lastPrecomputed: PrecomputedLineHighlights | undefined
	let lastOffsetsRef: HighlightOffsets | undefined
	let validatedOffsetsRef: HighlightOffsets = EMPTY_OFFSETS
	let dirtyHighlightCache = new Map<number, CachedLineHighlights>()

	const getValidatedOffsets = (): HighlightOffsets => {
		const offsets = options.highlightOffset
			? (untrack(options.highlightOffset) ?? EMPTY_OFFSETS)
			: EMPTY_OFFSETS

		if (offsets === lastOffsetsRef) {
			return validatedOffsetsRef
		}

		lastOffsetsRef = offsets
		if (offsets.length === 0) {
			validatedOffsetsRef = EMPTY_OFFSETS
			// Don't clear cache aggressively. Let per-line logic validate.
			// dirtyHighlightCache.clear()
			// precomputedCache.clear()
			return validatedOffsetsRef
		}

		// Don't clear cache aggressively.
		// dirtyHighlightCache.clear()
		validatedOffsetsRef = offsets
		return validatedOffsetsRef
	}

	const toShiftOffsets = (
		offsets: HighlightOffsets,
		lineStart: number,
		lineEnd: number
	): { shift: number; intersects: boolean } => {
		let shift = 0
		let intersects = false

		for (const offset of offsets) {
			if (!offset) continue
			if (offset.newEndIndex <= lineStart) {
				shift += offset.charDelta
				continue
			}
			if (offset.fromCharIndex >= lineEnd) {
				continue
			}
			intersects = true
		}

		return { shift, intersects }
	}

	const applyShiftToSegments = (
		segments: LineHighlightSegment[],
		shift: number,
		lineTextLength: number
	): LineHighlightSegment[] => {
		if (segments.length === 0 || shift === 0) return segments

		const shifted: LineHighlightSegment[] = []
		for (const segment of segments) {
			const start = Math.max(0, Math.min(lineTextLength, segment.start + shift))
			const end = Math.max(0, Math.min(lineTextLength, segment.end + shift))
			if (end <= start) continue
			shifted.push({
				start,
				end,
				className: segment.className,
				scope: segment.scope,
			})
		}
		return shifted
	}

	let highlightCache = new Map<number, CachedLineHighlights>()
	let lastHighlightsRef: EditorSyntaxHighlight[] | undefined
	let lastErrorsRef: ErrorHighlight[] | undefined
	const MAX_HIGHLIGHT_CACHE_SIZE = 500

	const cacheLineHighlights = (
		cache: Map<number, CachedLineHighlights>,
		cacheIndex: number,
		entry: LineEntry,
		segments: LineHighlightSegment[],
		shift: number
	) => {
		cache.set(cacheIndex, {
			length: entry.length,
			text: entry.text,
			segments,
			appliedShift: shift,
		})
		if (cache.size > MAX_HIGHLIGHT_CACHE_SIZE) {
			const firstKey = cache.keys().next().value
			if (typeof firstKey === 'number') {
				cache.delete(firstKey)
			}
		}
	}

	const getLineHighlights = (entry: LineEntry): LineHighlightSegment[] => {
		const offsets = getValidatedOffsets()
		const hasOffsets = offsets.length > 0

		const lineKey = entry.lineId > 0 ? entry.lineId : entry.index

		const precomputed = hasOffsets ? undefined : precomputedSegments()
		if (precomputed) {
			lastPrecomputed = precomputed
			const segments = precomputed.segments[entry.index] ?? []
			lastHighlightsRef = sortedHighlights()
			lastErrorsRef = sortedErrorHighlights()

			cacheLineHighlights(highlightCache, lineKey, entry, segments, 0)
			if (segments.length > 0) {
				precomputedCache.set(lineKey, segments)
				if (precomputedCache.size > MAX_HIGHLIGHT_CACHE_SIZE) {
					const firstKey = precomputedCache.keys().next().value
					if (typeof firstKey === 'number') {
						precomputedCache.delete(firstKey)
					}
				}
			}
			return segments
		}

		const lineStart = options.getLineStart(entry.index)
		const lineLength = entry.length
		const lineTextLength = entry.text.length
		const lineEnd = lineStart + lineLength
		const highlights = sortedHighlights()
		const errors = sortedErrorHighlights()

		if (highlights !== lastHighlightsRef || errors !== lastErrorsRef) {
			setHighlightsRevision((value) => value + 1)
			highlightCache = new Map()
			dirtyHighlightCache.clear()
			precomputedCache.clear()
			lastPrecomputed = undefined
			lastHighlightsRef = highlights
			lastErrorsRef = errors
			spatialIndexReady = false
			setIsPrecomputedReady(false)
		}

		if (highlights.length > 0 && !spatialIndexReady) {
			const start = performance.now()
			buildSpatialIndex(highlights)
			spatialIndexReady = true
			log.debug(
				`buildSpatialIndex (lazy): ${highlights.length} highlights in ${(performance.now() - start).toFixed(2)}ms`
			)
		}

		const offsetShift = hasOffsets
			? toShiftOffsets(offsets, lineStart, lineEnd)
			: { shift: 0, intersects: false }
		const offsetShiftAmount = offsetShift.shift
		const hasIntersectingOffsets = offsetShift.intersects
		const shouldApplyOffsets =
			hasOffsets && (hasIntersectingOffsets || offsetShiftAmount !== 0)
		const offsetsForSegments = shouldApplyOffsets ? offsets : undefined

			if (hasOffsets && !hasIntersectingOffsets) {
				const cachedPrecomputed = precomputedCache.get(lineKey)
				if (cachedPrecomputed) {
					return cachedPrecomputed
				}

			const precomputedState = lastPrecomputed
			if (precomputedState) {
				const mappedIndex =
					entry.lineId > 0
						? precomputedState.indexByLineId.get(entry.lineId)
						: entry.index
				if (typeof mappedIndex === 'number') {
					const precomputedLine =
						precomputedState.segments[mappedIndex] ?? EMPTY_SEGMENTS
					if (precomputedLine.length > 0) {
						precomputedCache.set(lineKey, precomputedLine)
					}
					return precomputedLine
				}
			}
		}

		const cacheMap =
			hasOffsets && hasIntersectingOffsets
				? dirtyHighlightCache
				: highlightCache
		const cached = cacheMap.get(lineKey)

		if (
			cached !== undefined &&
			cached.length === lineLength &&
			cached.text === entry.text &&
			cached.appliedShift === offsetShiftAmount
		) {
			return cached.segments
		}

		let highlightSegments: LineHighlightSegment[]
		if (highlights.length > 0) {
			const lookupRange = hasOffsets
				? mapRangeToOldOffsets(lineStart, lineEnd, offsets)
				: { start: lineStart, end: lineEnd }
			let lookupStart = lookupRange.start
			let lookupEnd = lookupRange.end
			if (lookupStart < 0) lookupStart = 0
			if (lookupEnd < lookupStart) lookupEnd = lookupStart

			const startChunk = Math.floor(lookupStart / SPATIAL_CHUNK_SIZE)
			const lookupLast = lookupEnd > lookupStart ? lookupEnd - 1 : lookupStart
			const endChunk = Math.floor(lookupLast / SPATIAL_CHUNK_SIZE)

			let candidates: EditorSyntaxHighlight[]
			if (
				!hasOffsets &&
				largeHighlights.length === 0 &&
				startChunk === endChunk
			) {
				candidates = spatialIndex.get(startChunk) ?? []
			} else {
				candidateScratch.length = 0
				if (largeHighlights.length > 0) {
					for (const h of largeHighlights) candidateScratch.push(h)
				}

				for (let i = startChunk; i <= endChunk; i++) {
					const bucket = spatialIndex.get(i)
					if (!bucket) continue
					for (const h of bucket) candidateScratch.push(h)
				}

				candidateScratch.sort((a, b) => a.startIndex - b.startIndex)

				if (startChunk !== endChunk && candidateScratch.length > 1) {
					let writeIndex = 1
					for (let i = 1; i < candidateScratch.length; i++) {
						if (candidateScratch[i] !== candidateScratch[writeIndex - 1]) {
							candidateScratch[writeIndex] = candidateScratch[i]!
							writeIndex++
						}
					}
					candidateScratch.length = writeIndex
				}

				candidates = candidateScratch
			}

			highlightSegments = toLineHighlightSegmentsForLine(
				lineStart,
				lineLength,
				lineTextLength,
				candidates,
				offsetsForSegments
			)
		} else {
			highlightSegments = []
		}

		const errorSegments = toLineHighlightSegmentsForLine(
			lineStart,
			lineLength,
			lineTextLength,
			errors,
			offsetsForSegments
		)

		const shiftedHighlightSegments =
			hasOffsets && !shouldApplyOffsets
				? applyShiftToSegments(
						highlightSegments,
						offsetShiftAmount,
						lineTextLength
					)
				: highlightSegments
		const shiftedErrorSegments =
			hasOffsets && !shouldApplyOffsets
				? applyShiftToSegments(errorSegments, offsetShiftAmount, lineTextLength)
				: errorSegments

		const result = mergeLineSegments(
			shiftedHighlightSegments,
			shiftedErrorSegments
		)

		if (cached && cached.segments.length === result.length) {
			let match = true
			for (let i = 0; i < result.length; i++) {
				const r = result[i]!
				const c = cached.segments[i]!
				if (r.start !== c.start || r.end !== c.end || r.className !== c.className) {
					match = false
					break
				}
			}
				if (match) {
					cacheLineHighlights(
						cacheMap,
						lineKey,
						entry,
						cached.segments,
						offsetShiftAmount
					)
					return cached.segments
				}
			}

		cacheLineHighlights(cacheMap, lineKey, entry, result, offsetShiftAmount)
		return result
	}

	return {
		getLineHighlights,
		getHighlightsRevision: highlightsRevision,
		isPrecomputedReady,
		enablePrecomputedSegments: () => {
			setRetainPrecomputedSegments(true)
			setIsPrecomputedReady(false)
			lastPrecomputed = undefined
			precomputedCache.clear()
		},
		releasePrecomputedSegments: () => {
			if (!retainPrecomputedSegments()) return
			setRetainPrecomputedSegments(false)
			lastPrecomputed = undefined
			precomputedCache.clear()
		},
	}
}
