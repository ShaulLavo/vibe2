/**
 * Sampling state for minimap - maps minimap line indices to model line numbers.
 * Used for large files where displaying every line would be too expensive.
 */
export class MinimapSamplingState {
	constructor(
		public readonly samplingRatio: number,
		public readonly minimapLines: Uint32Array,
		public readonly displayLineCount: number
	) {}

	/**
	 * Convert a model line number to minimap line index
	 * @param modelLineNumber 0-based model line index
	 */
	modelLineToMinimapLine(modelLineNumber: number): number {
		if (this.samplingRatio <= 1) return modelLineNumber
		return Math.min(
			this.minimapLines.length - 1,
			Math.max(0, Math.floor(modelLineNumber / this.samplingRatio))
		)
	}

	/**
	 * Convert a minimap line index to model line number
	 * @param minimapLine 0-based minimap line index
	 */
	minimapLineToModelLine(minimapLine: number): number {
		if (minimapLine < 0 || minimapLine >= this.minimapLines.length) {
			return -1
		}
		return this.minimapLines[minimapLine] ?? -1
	}

	get minimapLineCount(): number {
		return this.minimapLines.length
	}
}

/**
 * Maximum number of minimap line entries to keep memory bounded.
 * With sampling, even million-line files stay manageable.
 */
const MAX_MINIMAP_LINE_ENTRIES = 50_000

/**
 * Create sampling state for given display line count.
 * @param displayLineCount Number of displayable lines (after folding)
 * @param displayToLine Optional function to map display index to model line
 */
export function createMinimapSamplingState(
	displayLineCount: number,
	displayToLine?: (displayIndex: number) => number
): MinimapSamplingState {
	if (displayLineCount <= 0) {
		return new MinimapSamplingState(1, new Uint32Array(0), 0)
	}

	// Calculate sampling ratio to keep within bounds
	const samplingRatio = Math.max(
		1,
		Math.ceil(displayLineCount / MAX_MINIMAP_LINE_ENTRIES)
	)

	// Calculate how many minimap lines we'll have
	const minimapLineCount = Math.ceil(displayLineCount / samplingRatio)

	// Build the mapping array
	const minimapLines = new Uint32Array(minimapLineCount)

	for (let i = 0; i < minimapLineCount; i++) {
		const displayIndex = Math.min(displayLineCount - 1, i * samplingRatio)
		// If we have a display-to-line mapping (for folds), use it
		// Otherwise, display index equals model line index
		minimapLines[i] = displayToLine ? displayToLine(displayIndex) : displayIndex
	}

	return new MinimapSamplingState(samplingRatio, minimapLines, displayLineCount)
}

/**
 * Dirty line range for incremental updates
 */
export type DirtyLineRange = {
	startLine: number
	endLine: number
}

/**
 * Coalesce overlapping or adjacent dirty ranges
 */
export function coalesceDirtyRanges(
	ranges: DirtyLineRange[]
): DirtyLineRange[] {
	if (ranges.length <= 1) return ranges

	// Sort by start line
	const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine)
	const result: DirtyLineRange[] = []

	let current = sorted[0]!
	for (let i = 1; i < sorted.length; i++) {
		const next = sorted[i]!
		// Check if overlapping or adjacent (within 1 line)
		if (next.startLine <= current.endLine + 1) {
			// Merge
			current = {
				startLine: current.startLine,
				endLine: Math.max(current.endLine, next.endLine),
			}
		} else {
			result.push(current)
			current = next
		}
	}
	result.push(current)

	return result
}

/**
 * State for tracking dirty lines and enabling incremental rendering
 */
export class MinimapDirtyTracker {
	private dirtyRanges: DirtyLineRange[] = []
	private fullInvalidation = true // Start with full repaint

	/**
	 * Mark a range of lines as dirty
	 */
	markDirty(startLine: number, endLine: number): void {
		this.dirtyRanges.push({ startLine, endLine })
	}

	/**
	 * Mark entire minimap as dirty (full repaint needed)
	 */
	markFullDirty(): void {
		this.fullInvalidation = true
		this.dirtyRanges = []
	}

	/**
	 * Check if full repaint is needed
	 */
	needsFullRepaint(): boolean {
		return this.fullInvalidation
	}

	/**
	 * Get coalesced dirty ranges
	 */
	getDirtyRanges(): DirtyLineRange[] {
		return coalesceDirtyRanges(this.dirtyRanges)
	}

	/**
	 * Clear dirty state after rendering
	 */
	clear(): void {
		this.fullInvalidation = false
		this.dirtyRanges = []
	}

	/**
	 * Check if a line is within any dirty range
	 */
	isLineDirty(line: number): boolean {
		if (this.fullInvalidation) return true
		return this.dirtyRanges.some(
			(r) => line >= r.startLine && line <= r.endLine
		)
	}
}

/**
 * Viewport state for minimap rendering
 */
export type MinimapViewport = {
	startMinimapLine: number
	endMinimapLine: number
	minimapLineCount: number
}

/**
 * Calculate which minimap lines are visible in the canvas
 */
export function calculateMinimapViewport(
	canvasHeightCss: number,
	minimapRowHeightCss: number,
	minimapScrollTopCss: number,
	totalMinimapLines: number
): MinimapViewport {
	const linesVisible = Math.ceil(canvasHeightCss / minimapRowHeightCss)
	const startMinimapLine = Math.max(
		0,
		Math.floor(minimapScrollTopCss / minimapRowHeightCss)
	)
	const endMinimapLine = Math.min(
		totalMinimapLines - 1,
		startMinimapLine + linesVisible
	)

	return {
		startMinimapLine,
		endMinimapLine,
		minimapLineCount: totalMinimapLines,
	}
}
