import type { CommandContext } from '../commands'
import type { GrepMatch, GrepProgress } from '@repo/fs'
import { grep } from '@repo/fs'
import { IGNORED_SEGMENTS } from '../../fs/config/constants'
import { readFileText } from '../../fs/runtime/streaming'
import { findNode } from '../../fs/runtime/tree'
import { DEFAULT_SOURCE } from '../../fs/config/constants'

/**
 * Parsed grep command arguments
 */
export interface GrepCommandArgs {
	/** Search pattern (literal string) */
	pattern: string | null
	/** Search path relative to CWD */
	path: string | null
	/** Maximum number of results to return */
	maxResults: number | null
	/** Glob patterns to exclude from search */
	excludePatterns: string[]
	/** Whether to show help text */
	showHelp: boolean
	/** Whether to disable default exclusions (search everywhere) */
	noExclude: boolean
}

/**
 * Parse grep command arguments
 * 
 * Supports:
 * - grep <pattern> [path]
 * - grep -n <number> <pattern> [path]
 * - grep --exclude <pattern> <pattern> [path]
 * - grep --no-exclude <pattern> [path]
 * - grep -h / --help
 * 
 * @param args - Raw command arguments
 * @returns Parsed arguments object
 */
export function parseGrepArgs(args: string[]): GrepCommandArgs {
	const result: GrepCommandArgs = {
		pattern: null,
		path: null,
		maxResults: null,
		excludePatterns: [],
		showHelp: false,
		noExclude: false,
	}

	const positional: string[] = []
	let i = 0

	while (i < args.length) {
		const arg = args[i]

		if (arg === '-h' || arg === '--help') {
			result.showHelp = true
			i++
		} else if (arg === '-n') {
			// Next arg should be a number
			i++
			if (i < args.length) {
				const numStr = args[i]
				if (numStr) {
					const num = Number.parseInt(numStr, 10)
					if (!Number.isNaN(num) && num > 0) {
						result.maxResults = num
					}
				}
			}
			i++
		} else if (arg === '--exclude') {
			// Next arg is the exclude pattern
			i++
			if (i < args.length) {
				const pattern = args[i]
				if (pattern) {
					result.excludePatterns.push(pattern)
				}
			}
			i++
		} else if (arg === '--no-exclude') {
			result.noExclude = true
			i++
		} else {
			// Positional argument
			if (arg) {
				positional.push(arg)
			}
			i++
		}
	}

	// First positional is pattern, second is path
	if (positional.length > 0) {
		result.pattern = positional[0] ?? null
	}
	if (positional.length > 1) {
		result.path = positional[1] ?? null
	}

	return result
}

/**
 * Parse .gitignore file content into array of glob patterns
 * 
 * Handles:
 * - Comments (lines starting with #)
 * - Negation patterns (lines starting with !)
 * - Blank lines
 * 
 * @param content - Raw .gitignore file content
 * @returns Array of glob patterns to exclude
 */
export function parseGitignore(content: string): string[] {
	const patterns: string[] = []
	const lines = content.split('\n')

	for (const line of lines) {
		const trimmed = line.trim()

		// Skip blank lines
		if (!trimmed) continue

		// Skip comments
		if (trimmed.startsWith('#')) continue

		// Include negation patterns (they start with !)
		// Note: For now we include them as-is; the grep implementation
		// may need to handle negation logic separately
		patterns.push(trimmed)
	}

	return patterns
}

/**
 * Load gitignore patterns from a .gitignore file in the search path
 * 
 * @param ctx - Command context with shell access
 * @param searchPath - Path to search for .gitignore file
 * @returns Array of glob patterns from .gitignore, or empty array if file doesn't exist
 */
export async function loadGitignorePatterns(
	ctx: CommandContext,
	searchPath: string
): Promise<string[]> {
	const gitignorePath = searchPath ? `${searchPath}/.gitignore` : '.gitignore'

	// Check if .gitignore exists in the tree
	const tree = ctx.shell.state.tree
	if (!tree) return []

	const node = findNode(tree, gitignorePath)
	if (!node || node.kind !== 'file') {
		return []
	}

	try {
		const source = ctx.shell.state.activeSource ?? DEFAULT_SOURCE
		const content = await readFileText(source, gitignorePath)
		return parseGitignore(content)
	} catch {
		// If we can't read the file, return empty array
		return []
	}
}

/**
 * ANSI color codes for terminal output
 */
const ANSI_CYAN = '\x1b[36m'
const ANSI_YELLOW = '\x1b[33m'
const ANSI_RESET = '\x1b[0m'

/**
 * Maximum line length before truncation
 */
const MAX_LINE_LENGTH = 200

/**
 * Truncation indicator
 */
const TRUNCATION_INDICATOR = '...'

/**
 * Format a grep match for terminal display
 * 
 * Formats as: <path>:<lineNumber>: <lineContent>
 * With ANSI color codes:
 * - Path: Cyan
 * - Line number: Yellow
 * - Line content: Default (reset)
 * 
 * Lines exceeding MAX_LINE_LENGTH are truncated with indicator.
 * 
 * @param match - Grep match to format
 * @param maxLineLength - Maximum line length before truncation (default: 200)
 * @returns Formatted string with ANSI color codes
 */
export function formatGrepMatch(
	match: GrepMatch,
	maxLineLength: number = MAX_LINE_LENGTH
): string {
	const { path, lineNumber, lineContent } = match

	// Truncate line content if it exceeds max length
	let displayContent = lineContent
	if (lineContent.length > maxLineLength) {
		displayContent = lineContent.slice(0, maxLineLength) + TRUNCATION_INDICATOR
	}

	// Format with ANSI color codes
	return `${ANSI_CYAN}${path}${ANSI_RESET}:${ANSI_YELLOW}${lineNumber}${ANSI_RESET}: ${displayContent}`
}

/**
 * Format progress update for terminal display
 * 
 * Formats as: Searching... <filesScanned>/<filesTotal> files, <matchesFound> matches
 * 
 * @param progress - Grep progress object
 * @returns Formatted progress string
 */
export function formatProgress(progress: GrepProgress): string {
	const { filesScanned, filesTotal, matchesFound } = progress
	return `Searching... ${filesScanned}/${filesTotal} files, ${matchesFound} matches`
}

/**
 * Format completion summary for terminal display
 * 
 * Formats as: Found <matchesFound> matches (searched <filesScanned> files)
 * 
 * @param progress - Final grep progress object
 * @returns Formatted summary string
 */
export function formatSummary(progress: GrepProgress): string {
	const { filesScanned, matchesFound } = progress
	const matchWord = matchesFound === 1 ? 'match' : 'matches'
	const fileWord = filesScanned === 1 ? 'file' : 'files'
	return `Found ${matchesFound} ${matchWord} (searched ${filesScanned} ${fileWord})`
}

/**
 * Display root path for terminal output
 */
const DISPLAY_ROOT = '/'

/**
 * Normalize a path relative to CWD
 * 
 * @param cwd - Current working directory
 * @param input - Input path (can be relative or absolute)
 * @returns Normalized path
 */
function normalizePath(cwd: string, input: string): string {
	const trimmed = input.trim()
	if (!trimmed || trimmed === '.') return cwd
	if (trimmed === DISPLAY_ROOT) return ''

	const base = trimmed.startsWith(DISPLAY_ROOT) ? '' : cwd
	const combined = [base, trimmed].filter(Boolean).join(DISPLAY_ROOT)
	const segments = combined.split(DISPLAY_ROOT).filter(Boolean)

	const stack: string[] = []
	for (const segment of segments) {
		if (segment === '.') continue
		if (segment === '..') {
			if (stack.length === 0) {
				throw new Error('Path escapes root')
			}
			stack.pop()
			continue
		}
		stack.push(segment)
	}

	return stack.join(DISPLAY_ROOT)
}

/**
 * Print grep help text
 * 
 * @param ctx - Command context
 */
function printGrepHelp(ctx: CommandContext): void {
	ctx.localEcho?.println('Usage: grep [options] <pattern> [path]')
	ctx.localEcho?.println('')
	ctx.localEcho?.println('Search for a literal text pattern in files.')
	ctx.localEcho?.println('')
	ctx.localEcho?.println('Options:')
	ctx.localEcho?.println('  -n <number>         Limit results to N matches')
	ctx.localEcho?.println('  --exclude <pattern> Exclude files/dirs matching pattern (can be repeated)')
	ctx.localEcho?.println('  --no-exclude        Disable default exclusions (search everywhere)')
	ctx.localEcho?.println('  -h, --help          Show this help text')
	ctx.localEcho?.println('')
	ctx.localEcho?.println('Examples:')
	ctx.localEcho?.println('  grep TODO                    # Search for "TODO" in current directory')
	ctx.localEcho?.println('  grep "import React" src      # Search in src directory')
	ctx.localEcho?.println('  grep -n 10 console.log       # Limit to 10 results')
	ctx.localEcho?.println('  grep --exclude "*.test.ts" bug  # Exclude test files')
	ctx.localEcho?.println('  grep --no-exclude console.log   # Search everywhere (including node_modules)')
}

/**
 * Main grep command handler
 * 
 * @param ctx - Command context with terminal and shell access
 * @param args - Raw command arguments
 */
export async function handleGrep(
	ctx: CommandContext,
	args: string[]
): Promise<void> {
	// Parse arguments
	const parsed = parseGrepArgs(args)

	// Handle help flag
	if (parsed.showHelp) {
		printGrepHelp(ctx)
		return
	}

	// Validate pattern is provided
	if (!parsed.pattern) {
		ctx.localEcho?.println('grep: missing pattern')
		ctx.localEcho?.println('Usage: grep [options] <pattern> [path]')
		ctx.localEcho?.println('Try "grep --help" for more information.')
		return
	}

	// Check if filesystem is ready
	if (!ctx.shell.state.tree) {
		ctx.localEcho?.println('Filesystem not ready. Try again in a moment.')
		return
	}

	// Resolve search path relative to CWD
	const cwd = ctx.shell.getCwd()
	const searchPath = parsed.path ? normalizePath(cwd, parsed.path) : cwd

	// Verify search path exists
	const searchNode = findNode(ctx.shell.state.tree, searchPath)
	if (!searchNode) {
		ctx.localEcho?.println(`grep: ${searchPath || '/'}: No such file or directory`)
		return
	}

	try {
		// Get VFS context
		const vfsContext = await ctx.shell.getVfsContext()

		// Load gitignore patterns from search path (skip if --no-exclude)
		const gitignorePatterns = parsed.noExclude ? [] : await loadGitignorePatterns(ctx, searchPath)

		// Combine default exclusions with gitignore patterns and user-specified exclusions
		const excludePatterns = [
			// Only add default exclusions if --no-exclude flag is not set
			...(parsed.noExclude ? [] : Array.from(IGNORED_SEGMENTS)),
			...gitignorePatterns,
			...parsed.excludePatterns,
		]

		// Track progress
		let lastProgress: GrepProgress | null = null
		let matchCount = 0
		let resultsTruncated = false

		// Perform grep search
		const matches = await grep(
			vfsContext,
			parsed.pattern,
			{
				paths: [searchPath],
				excludePatterns,
				maxResults: parsed.maxResults ?? undefined,
				// When --no-exclude is set, also include hidden files
				includeHidden: parsed.noExclude,
			},
			(progress) => {
				lastProgress = progress
				// Display progress updates (throttled by grep implementation)
				ctx.localEcho?.print(`\r${formatProgress(progress)}`)
			}
		)

		// Clear progress line
		if (lastProgress) {
			ctx.localEcho?.print('\r\x1b[K') // Clear line
		}

		// Check if results were truncated
		if (parsed.maxResults && matches.length >= parsed.maxResults) {
			resultsTruncated = true
		}

		// Display matches
		for (const match of matches) {
			ctx.localEcho?.println(formatGrepMatch(match))
			matchCount++
		}

		// Display summary
		if (matchCount === 0) {
			ctx.localEcho?.println('No matches found')
		} else {
			if (lastProgress) {
				ctx.localEcho?.println(formatSummary(lastProgress))
			}
			if (resultsTruncated) {
				ctx.localEcho?.println(`(results limited to ${parsed.maxResults})`)
			}
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unexpected error during grep'
		ctx.localEcho?.println(`grep: ${message}`)
	}
}
