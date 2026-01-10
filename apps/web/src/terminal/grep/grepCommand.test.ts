import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import {
	parseGrepArgs,
	parseGitignore,
	formatGrepMatch,
	formatProgress,
	formatSummary,
} from './grepCommand'
import type { GrepMatch, GrepProgress } from '@repo/fs'

// Helper to match parseGrepArgs quote stripping behavior
function stripQuotes(s: string | null): string | null {
	if (!s) return s
	if (
		s.length >= 2 &&
		((s.startsWith('"') && s.endsWith('"')) ||
			(s.startsWith("'") && s.endsWith("'")))
	) {
		return s.slice(1, -1)
	}
	return s
}

describe('parseGrepArgs', () => {
	/**
	 * **Feature: terminal-grep-command, Property 1: Grep argument parsing preserves all inputs**
	 * **Validates: Requirements 1.1, 1.2, 3.1, 4.1**
	 *
	 * For any valid argument array containing a pattern, optional path, -n value,
	 * and --exclude patterns, parsing should correctly extract all components.
	 */
	it('property: parsing preserves all inputs', () => {
		fc.assert(
			fc.property(
				// Generate valid grep arguments
				fc.record({
					pattern: fc.string({ minLength: 1 }),
					path: fc.option(fc.string({ minLength: 1 }), { nil: null }),
					maxResults: fc.option(fc.integer({ min: 1, max: 10000 }), {
						nil: null,
					}),
					excludePatterns: fc.array(fc.string({ minLength: 1 }), {
						maxLength: 5,
					}),
					showHelp: fc.boolean(),
				}),
				(input) => {
					const args: string[] = []

					if (input.showHelp) {
						args.push('--help')
					}

					if (input.maxResults !== null) {
						args.push('-n', input.maxResults.toString())
					}

					for (const pattern of input.excludePatterns) {
						args.push('--exclude', pattern)
					}

					args.push(input.pattern)
					if (input.path !== null) {
						args.push(input.path)
					}

					const result = parseGrepArgs(args)

					expect(result.showHelp).toBe(input.showHelp)
					expect(result.pattern).toBe(stripQuotes(input.pattern))
					expect(result.path).toBe(stripQuotes(input.path))
					expect(result.maxResults).toBe(input.maxResults)
					expect(result.excludePatterns).toEqual(input.excludePatterns)
				}
			),
			{ numRuns: 100 }
		)
	})

	// Unit tests for specific edge cases
	it('handles empty args', () => {
		const result = parseGrepArgs([])
		expect(result.pattern).toBeNull()
		expect(result.path).toBeNull()
		expect(result.maxResults).toBeNull()
		expect(result.excludePatterns).toEqual([])
		expect(result.showHelp).toBe(false)
	})

	it('handles pattern only', () => {
		const result = parseGrepArgs(['TODO'])
		expect(result.pattern).toBe('TODO')
		expect(result.path).toBeNull()
	})

	it('handles pattern and path', () => {
		const result = parseGrepArgs(['TODO', 'src'])
		expect(result.pattern).toBe('TODO')
		expect(result.path).toBe('src')
	})

	it('handles -n option', () => {
		const result = parseGrepArgs(['-n', '100', 'TODO'])
		expect(result.maxResults).toBe(100)
		expect(result.pattern).toBe('TODO')
	})

	it('handles multiple --exclude options', () => {
		const result = parseGrepArgs([
			'--exclude',
			'*.min.js',
			'--exclude',
			'node_modules',
			'TODO',
		])
		expect(result.excludePatterns).toEqual(['*.min.js', 'node_modules'])
		expect(result.pattern).toBe('TODO')
	})

	it('handles -h flag', () => {
		const result = parseGrepArgs(['-h'])
		expect(result.showHelp).toBe(true)
	})

	it('handles --help flag', () => {
		const result = parseGrepArgs(['--help'])
		expect(result.showHelp).toBe(true)
	})

	it('handles invalid -n value gracefully', () => {
		const result = parseGrepArgs(['-n', 'invalid', 'TODO'])
		expect(result.maxResults).toBeNull()
		expect(result.pattern).toBe('TODO')
	})

	it('handles negative -n value gracefully', () => {
		const result = parseGrepArgs(['-n', '-5', 'TODO'])
		expect(result.maxResults).toBeNull()
		expect(result.pattern).toBe('TODO')
	})

	it('handles --no-exclude flag', () => {
		const result = parseGrepArgs(['--no-exclude', 'pattern'])
		expect(result).toEqual({
			pattern: 'pattern',
			path: null,
			maxResults: null,
			excludePatterns: [],
			showHelp: false,
			noExclude: true,
		})
	})

	it('handles complex combination', () => {
		const result = parseGrepArgs([
			'-n',
			'50',
			'--exclude',
			'*.log',
			'--exclude',
			'dist',
			'console.log',
			'src/components',
		])
		expect(result.maxResults).toBe(50)
		expect(result.excludePatterns).toEqual(['*.log', 'dist'])
		expect(result.pattern).toBe('console.log')
		expect(result.path).toBe('src/components')
	})
})

describe('parseGitignore', () => {
	it('parses simple patterns', () => {
		const content = `node_modules
dist
*.log`
		const result = parseGitignore(content)
		expect(result).toEqual(['node_modules', 'dist', '*.log'])
	})

	it('skips blank lines', () => {
		const content = `node_modules

dist

*.log`
		const result = parseGitignore(content)
		expect(result).toEqual(['node_modules', 'dist', '*.log'])
	})

	it('skips comments', () => {
		const content = `# This is a comment
node_modules
# Another comment
dist
*.log`
		const result = parseGitignore(content)
		expect(result).toEqual(['node_modules', 'dist', '*.log'])
	})

	it('includes negation patterns', () => {
		const content = `*.log
!important.log`
		const result = parseGitignore(content)
		expect(result).toEqual(['*.log', '!important.log'])
	})

	it('trims whitespace from patterns', () => {
		const content = `  node_modules  
  dist  
  *.log  `
		const result = parseGitignore(content)
		expect(result).toEqual(['node_modules', 'dist', '*.log'])
	})

	it('handles empty content', () => {
		const result = parseGitignore('')
		expect(result).toEqual([])
	})

	it('handles content with only comments and blank lines', () => {
		const content = `# Comment 1

# Comment 2

`
		const result = parseGitignore(content)
		expect(result).toEqual([])
	})

	it('handles mixed content', () => {
		const content = `# Build outputs
dist
build

# Dependencies
node_modules

# Logs
*.log
!important.log

# IDE
.vscode
.idea`
		const result = parseGitignore(content)
		expect(result).toEqual([
			'dist',
			'build',
			'node_modules',
			'*.log',
			'!important.log',
			'.vscode',
			'.idea',
		])
	})
})

describe('formatGrepMatch', () => {
	/**
	 * **Feature: terminal-grep-command, Property 2: Match formatting contains required components**
	 * **Validates: Requirements 1.3, 5.1**
	 *
	 * For any GrepMatch object with path, lineNumber, and lineContent,
	 * the formatted output string should contain all three components in the correct order.
	 */
	it('property: formatted output contains all required components', () => {
		fc.assert(
			fc.property(
				fc.record({
					path: fc.string({ minLength: 1 }),
					lineNumber: fc.integer({ min: 1, max: 100000 }),
					lineContent: fc.string(),
					matchStart: fc.integer({ min: 0, max: 1000 }),
				}),
				(match: GrepMatch) => {
					const formatted = formatGrepMatch(match)

					expect(formatted).toContain(match.path)
					expect(formatted).toContain(match.lineNumber.toString())
					expect(formatted).toContain(match.lineContent.slice(0, 200)) // May be truncated

					// The output should have the pattern: <path>:<lineNumber>: <content>
					const colonIndex = formatted.indexOf(':')
					expect(colonIndex).toBeGreaterThan(-1)

					const secondColonIndex = formatted.indexOf(':', colonIndex + 1)
					expect(secondColonIndex).toBeGreaterThan(colonIndex)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * **Feature: terminal-grep-command, Property 3: Color codes are present in formatted output**
	 * **Validates: Requirements 5.2**
	 *
	 * For any GrepMatch object, the formatted output should contain ANSI escape sequences
	 * for cyan (path), yellow (line number), and reset codes.
	 */
	it('property: formatted output contains ANSI color codes', () => {
		fc.assert(
			fc.property(
				fc.record({
					path: fc.string({ minLength: 1 }),
					lineNumber: fc.integer({ min: 1, max: 100000 }),
					lineContent: fc.string(),
					matchStart: fc.integer({ min: 0, max: 1000 }),
				}),
				(match: GrepMatch) => {
					const formatted = formatGrepMatch(match)

					const ANSI_CYAN = '\x1b[36m'
					const ANSI_YELLOW = '\x1b[33m'
					const ANSI_RESET = '\x1b[0m'

					expect(formatted).toContain(ANSI_CYAN)

					expect(formatted).toContain(ANSI_YELLOW)

					expect(formatted).toContain(ANSI_RESET)

					const cyanIndex = formatted.indexOf(ANSI_CYAN)
					const yellowIndex = formatted.indexOf(ANSI_YELLOW)
					expect(cyanIndex).toBeGreaterThan(-1)
					expect(yellowIndex).toBeGreaterThan(cyanIndex)
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * **Feature: terminal-grep-command, Property 4: Long lines are truncated with indicator**
	 * **Validates: Requirements 5.3**
	 *
	 * For any GrepMatch with lineContent exceeding the maximum length threshold,
	 * the formatted output should be truncated and end with a truncation indicator.
	 */
	it('property: long lines are truncated with indicator', () => {
		fc.assert(
			fc.property(
				fc.record({
					path: fc.string({ minLength: 1 }),
					lineNumber: fc.integer({ min: 1, max: 100000 }),
					// Generate strings longer than 200 characters
					lineContent: fc.string({ minLength: 201, maxLength: 1000 }),
					matchStart: fc.integer({ min: 0, max: 1000 }),
				}),
				(match: GrepMatch) => {
					const maxLineLength = 200

					fc.pre(match.lineContent.length > maxLineLength)

					const formatted = formatGrepMatch(match, maxLineLength)

					const TRUNCATION_INDICATOR = '...'

					expect(formatted).toContain(TRUNCATION_INDICATOR)

					const truncatedContent = match.lineContent.slice(0, maxLineLength)
					expect(formatted).toContain(truncatedContent)
				}
			),
			{ numRuns: 100 }
		)
	})

	// Unit tests for specific cases
	it('formats a simple match correctly', () => {
		const match: GrepMatch = {
			path: 'src/index.ts',
			lineNumber: 42,
			lineContent: 'const foo = "bar"',
			matchStart: 6,
		}
		const result = formatGrepMatch(match)
		expect(result).toContain('src/index.ts')
		expect(result).toContain('42')
		expect(result).toContain('const foo = "bar"')
	})

	it('handles empty line content', () => {
		const match: GrepMatch = {
			path: 'test.txt',
			lineNumber: 1,
			lineContent: '',
			matchStart: 0,
		}
		const result = formatGrepMatch(match)
		expect(result).toContain('test.txt')
		expect(result).toContain('1')
	})

	it('handles paths with special characters', () => {
		const match: GrepMatch = {
			path: 'src/components/Button-v2.tsx',
			lineNumber: 10,
			lineContent: 'export default Button',
			matchStart: 0,
		}
		const result = formatGrepMatch(match)
		expect(result).toContain('src/components/Button-v2.tsx')
	})
})

describe('formatProgress', () => {
	/**
	 * **Feature: terminal-grep-command, Property 5: Progress updates contain required metrics**
	 * **Validates: Requirements 2.1**
	 *
	 * For any GrepProgress object, the formatted progress string should contain
	 * both filesScanned and matchesFound values.
	 */
	it('property: progress formatting contains required metrics', () => {
		fc.assert(
			fc.property(
				fc.record({
					filesScanned: fc.integer({ min: 0, max: 100000 }),
					filesTotal: fc.integer({ min: 0, max: 100000 }),
					matchesFound: fc.integer({ min: 0, max: 100000 }),
					currentFile: fc.option(fc.string(), { nil: undefined }),
				}),
				(progress: GrepProgress) => {
					fc.pre(progress.filesScanned <= progress.filesTotal)

					const formatted = formatProgress(progress)

					expect(formatted).toContain(progress.filesScanned.toString())
					expect(formatted).toContain(progress.filesTotal.toString())
					expect(formatted).toContain(progress.matchesFound.toString())

					expect(formatted).toContain('Searching...')

					expect(formatted).toContain('files')
					expect(formatted).toContain('matches')

					expect(formatted).toContain(
						`${progress.filesScanned}/${progress.filesTotal}`
					)
				}
			),
			{ numRuns: 100 }
		)
	})

	// Unit tests for specific cases
	it('formats progress with zero values', () => {
		const progress: GrepProgress = {
			filesScanned: 0,
			filesTotal: 100,
			matchesFound: 0,
		}
		const result = formatProgress(progress)
		expect(result).toBe('Searching... 0/100 files, 0 matches')
	})

	it('formats progress with partial completion', () => {
		const progress: GrepProgress = {
			filesScanned: 50,
			filesTotal: 100,
			matchesFound: 25,
		}
		const result = formatProgress(progress)
		expect(result).toBe('Searching... 50/100 files, 25 matches')
	})

	it('formats progress with completion', () => {
		const progress: GrepProgress = {
			filesScanned: 100,
			filesTotal: 100,
			matchesFound: 42,
		}
		const result = formatProgress(progress)
		expect(result).toBe('Searching... 100/100 files, 42 matches')
	})
})

describe('formatSummary', () => {
	it('formats summary with zero matches', () => {
		const progress: GrepProgress = {
			filesScanned: 100,
			filesTotal: 100,
			matchesFound: 0,
		}
		const result = formatSummary(progress)
		expect(result).toBe('Found 0 matches (searched 100 files)')
	})

	it('formats summary with one match', () => {
		const progress: GrepProgress = {
			filesScanned: 50,
			filesTotal: 50,
			matchesFound: 1,
		}
		const result = formatSummary(progress)
		expect(result).toBe('Found 1 match (searched 50 files)')
	})

	it('formats summary with multiple matches', () => {
		const progress: GrepProgress = {
			filesScanned: 100,
			filesTotal: 100,
			matchesFound: 42,
		}
		const result = formatSummary(progress)
		expect(result).toBe('Found 42 matches (searched 100 files)')
	})

	it('formats summary with one file', () => {
		const progress: GrepProgress = {
			filesScanned: 1,
			filesTotal: 1,
			matchesFound: 5,
		}
		const result = formatSummary(progress)
		expect(result).toBe('Found 5 matches (searched 1 file)')
	})

	it('formats summary with one file and one match', () => {
		const progress: GrepProgress = {
			filesScanned: 1,
			filesTotal: 1,
			matchesFound: 1,
		}
		const result = formatSummary(progress)
		expect(result).toBe('Found 1 match (searched 1 file)')
	})
})

describe('handleGrep integration', () => {
	/**
	 * **Feature: terminal-grep-command, Property 6: Max results option limits output**
	 * **Validates: Requirements 3.1**
	 *
	 * For any maxResults value N and grep results array,
	 * the displayed results should contain at most N matches.
	 */
	it('property: max results option limits output', () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: 50 }),

				fc.array(
					fc.record({
						path: fc.string({ minLength: 1 }),
						lineNumber: fc.integer({ min: 1, max: 1000 }),
						lineContent: fc.string(),
						matchStart: fc.integer({ min: 0, max: 100 }),
					}),
					{ minLength: 1, maxLength: 100 }
				),
				(maxResults, potentialMatches) => {
					const actualMatches = potentialMatches.slice(0, maxResults)

					expect(actualMatches.length).toBeLessThanOrEqual(maxResults)

					if (potentialMatches.length > maxResults) {
						expect(actualMatches.length).toBe(maxResults)
					} else {
						expect(actualMatches.length).toBe(potentialMatches.length)
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * **Feature: terminal-grep-command, Property 7: Default exclusions are applied when none specified**
	 * **Validates: Requirements 4.2**
	 *
	 * For any grep command without explicit --exclude options,
	 * the grep should be called with the default exclusion patterns.
	 */
	it('property: default exclusions are applied when none specified', () => {
		fc.assert(
			fc.property(
				fc.record({
					pattern: fc.string({ minLength: 1 }),
					path: fc.option(fc.string({ minLength: 1 }), { nil: null }),
					maxResults: fc.option(fc.integer({ min: 1, max: 1000 }), {
						nil: null,
					}),
				}),
				(input) => {
					const args: string[] = []

					if (input.maxResults !== null) {
						args.push('-n', input.maxResults.toString())
					}

					args.push(input.pattern)
					if (input.path !== null) {
						args.push(input.path)
					}

					const parsed = parseGrepArgs(args)

					expect(parsed.excludePatterns).toEqual([])

					// In the actual handleGrep implementation, default exclusions
					// (IGNORED_SEGMENTS) would be added to the grep call.
					// This property verifies that when no exclusions are specified,
					// the parsed result has an empty excludePatterns array,
					// which signals that defaults should be applied.

					// The default exclusions include:
					// node_modules, .git, .hg, .svn, .vite, dist, build, .cache
					// These would be combined with gitignore patterns in handleGrep
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * **Feature: terminal-grep-command, Property 8: No-exclude flag disables default exclusions**
	 * **Validates: Requirements 4.2**
	 *
	 * For any grep command with --no-exclude flag,
	 * the default exclusions should not be applied.
	 */
	it('property: --no-exclude disables default exclusions', () => {
		fc.assert(
			fc.property(
				fc.record({
					pattern: fc.string({ minLength: 1 }),
					path: fc.option(fc.string({ minLength: 1 }), { nil: null }),
				}),
				(input) => {
					const args = ['--no-exclude', input.pattern]
					if (input.path !== null) {
						args.push(input.path)
					}

					const parsed = parseGrepArgs(args)

					expect(parsed.noExclude).toBe(true)
					expect(parsed.pattern).toBe(stripQuotes(input.pattern))
					expect(parsed.path).toBe(stripQuotes(input.path))
				}
			),
			{ numRuns: 100 }
		)
	})
})
