import type { MinimapTokenSummary } from './types'
import { getScopeColorId } from '@repo/code-editor/tokenSummary'
import { astCache } from './cache'
import { logger } from '../../logger'

const log = logger.withTag('treeSitter')

export const generateMinimapSummary = (
	path: string,
	version: number,
	maxChars: number = 160
): MinimapTokenSummary | undefined => {
	const cached = astCache.get(path)
	if (!cached) {
		log.debug('generateMinimapSummary: No cached entry for', path)
		return undefined
	}
	log.debug(
		'generateMinimapSummary: Cached entry found for',
		path,
		'Language:',
		cached.languageId
	)

	const text = cached.text
	const captures = cached.captures ?? []

	// Count lines
	const lines = text.split('\n')
	const lineCount = lines.length

	// Allocate buffer for tokens (lineCount * maxChars)
	// Uint16Array for (Color << 8) | Char
	// totalBytes = lineCount * maxChars * 2 bytes/element
	const totalTokens = lineCount * maxChars
	const buffer = new ArrayBuffer(totalTokens * 2)
	const tokens = new Uint16Array(buffer)

	// Build line start offsets for fast lookup
	const lineStarts: number[] = new Array(lineCount)
	let offset = 0
	for (let i = 0; i < lineCount; i++) {
		lineStarts[i] = offset
		offset += lines[i]!.length + 1 // +1 for newline
	}

	// Process each line
	let captureIndex = 0

	for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
		const lineText = lines[lineIndex]!
		const lineStart = lineStarts[lineIndex]!
		const lineEnd = lineStart + lineText.length

		// Skip past captures that end before this line
		while (
			captureIndex < captures.length &&
			captures[captureIndex]!.endIndex <= lineStart
		) {
			captureIndex++
		}

		const tokenOffset = lineIndex * maxChars
		const sampleLength = Math.min(lineText.length, maxChars)

		// 1. Fill base characters
		for (let i = 0; i < sampleLength; i++) {
			const code = lineText.charCodeAt(i)
			// Color 0, char code in low byte
			tokens[tokenOffset + i] = code
		}

		// 2. Iterate relevant captures for this line and paint the colors
		let idx = captureIndex
		while (idx < captures.length && captures[idx]!.startIndex < lineEnd) {
			const capture = captures[idx]!
			const colorId = getScopeColorId(capture.captureName)

			// Calculate intersection with clamped line range [lineStart, lineStart + sampleLength]
			const sampleEndGlobal = lineStart + sampleLength

			const startGlobal = Math.max(capture.startIndex, lineStart)
			const endGlobal = Math.min(capture.endIndex, sampleEndGlobal)

			if (startGlobal < endGlobal) {
				// Map to local token index
				const startLocal = startGlobal - lineStart
				const endLocal = endGlobal - lineStart

				// Fill colors for the character range
				for (let i = startLocal; i < endLocal; i++) {
					const code = lineText.charCodeAt(i)
					// Combine colorId (high byte) + charCode (low byte)
					tokens[tokenOffset + i] = (colorId << 8) | (code & 0xff)
				}
			}

			idx++
		}
	}

	return {
		tokens,
		maxChars,
		lineCount,
		version,
	}
}
