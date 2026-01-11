import { createSignal, Show, createMemo, For, onMount } from 'solid-js'
import type { ConflictInfo } from '../types'

/**
 * Represents a line in the diff view
 */
interface DiffLine {
	/** Line number in the original content (0-based, -1 for added lines) */
	originalLineNumber: number
	/** Line number in the modified content (0-based, -1 for deleted lines) */
	modifiedLineNumber: number
	/** The text content of the line */
	content: string
	/** Type of change for this line */
	type: 'unchanged' | 'added' | 'deleted' | 'modified'
}

/**
 * Represents a diff chunk (group of related changes)
 */
interface DiffChunk {
	/** Lines in this chunk */
	lines: DiffLine[]
	/** Starting line number in original content */
	originalStart: number
	/** Starting line number in modified content */
	modifiedStart: number
}

/**
 * Represents a merge conflict section
 */
interface MergeConflictSection {
	/** Type of section */
	type: 'conflict' | 'unchanged'
	/** Lines in this section */
	lines: string[]
	/** For conflict sections, the local version */
	localLines?: string[]
	/** For conflict sections, the external version */
	externalLines?: string[]
	/** Start line number in the merged content */
	startLine: number
	/** End line number in the merged content */
	endLine: number
}

/**
 * Props for DiffView component
 */
export interface DiffViewProps {
	/** Conflict information to display */
	conflictInfo: ConflictInfo
	/** Whether the diff view is open */
	isOpen: boolean
	/** Callback when merge is completed */
	onMergeComplete: (mergedContent: string) => void
	/** Callback when diff view is cancelled */
	onCancel: () => void
}

/**
 * Enhanced side-by-side diff view component for manual conflict resolution
 * Features line-by-line diff display, syntax highlighting, and manual merge functionality
 */
export function DiffView(props: DiffViewProps) {
	const [mergedContent, setMergedContent] = createSignal(props.conflictInfo.localContent)
	const [selectedConflictIndex, setSelectedConflictIndex] = createSignal<number | null>(null)

	const fileName = () => props.conflictInfo.path.split('/').pop() || props.conflictInfo.path
	const fileExtension = () => {
		const name = fileName()
		const lastDot = name.lastIndexOf('.')
		return lastDot > 0 ? name.substring(lastDot + 1) : ''
	}

	// Compute diff between local and external content
	const diffChunks = createMemo(() => {
		return computeDiff(props.conflictInfo.localContent, props.conflictInfo.externalContent)
	})

	// Parse merge conflicts in the current merged content
	const mergeConflicts = createMemo(() => {
		return parseMergeConflicts(mergedContent())
	})

	const handleSaveMerge = () => {
		props.onMergeComplete(mergedContent())
	}

	const useLocalContent = () => {
		setMergedContent(props.conflictInfo.localContent)
	}

	const useExternalContent = () => {
		setMergedContent(props.conflictInfo.externalContent)
	}

	// Accept left side (local) for a specific conflict
	const acceptLeft = (conflictIndex: number) => {
		const conflicts = mergeConflicts()
		if (conflictIndex >= 0 && conflictIndex < conflicts.length) {
			const conflict = conflicts[conflictIndex]
			if (conflict?.type === 'conflict' && conflict.localLines) {
				const lines = mergedContent().split('\n')
				const newLines = [
					...lines.slice(0, conflict.startLine),
					...conflict.localLines,
					...lines.slice(conflict.endLine + 1)
				]
				setMergedContent(newLines.join('\n'))
			}
		}
	}

	// Accept right side (external) for a specific conflict
	const acceptRight = (conflictIndex: number) => {
		const conflicts = mergeConflicts()
		if (conflictIndex >= 0 && conflictIndex < conflicts.length) {
			const conflict = conflicts[conflictIndex]
			if (conflict?.type === 'conflict' && conflict.externalLines) {
				const lines = mergedContent().split('\n')
				const newLines = [
					...lines.slice(0, conflict.startLine),
					...conflict.externalLines,
					...lines.slice(conflict.endLine + 1)
				]
				setMergedContent(newLines.join('\n'))
			}
		}
	}

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[95vh] flex flex-col">
					{/* Header */}
					<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
							Resolve Conflict: {fileName()}
						</h2>
						<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
							Review the differences and manually merge the changes. Click on individual changes to accept them.
						</p>
					</div>

					{/* Content */}
					<div class="flex-1 overflow-hidden flex">
						{/* Side-by-side diff view */}
						<div class="flex-1 flex border-r border-gray-200 dark:border-gray-700">
							{/* Local Changes */}
							<div class="flex-1 border-r border-gray-200 dark:border-gray-700 flex flex-col">
								<div class="px-4 py-2 bg-green-50 dark:bg-green-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
									<h3 class="text-sm font-medium text-green-800 dark:text-green-200">
										Your Changes (Local)
									</h3>
								</div>
								<div class="flex-1 overflow-auto">
									<DiffPanel 
										content={props.conflictInfo.localContent}
										otherContent={props.conflictInfo.externalContent}
										side="local"
										fileExtension={fileExtension()}
									/>
								</div>
							</div>

							{/* External Changes */}
							<div class="flex-1 flex flex-col">
								<div class="px-4 py-2 bg-blue-50 dark:bg-blue-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
									<h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">
										External Changes
									</h3>
								</div>
								<div class="flex-1 overflow-auto">
									<DiffPanel 
										content={props.conflictInfo.externalContent}
										otherContent={props.conflictInfo.localContent}
										side="external"
										fileExtension={fileExtension()}
									/>
								</div>
							</div>
						</div>

						{/* Merge Editor */}
						<div class="flex-1 flex flex-col">
							<div class="px-4 py-2 bg-purple-50 dark:bg-purple-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
								<h3 class="text-sm font-medium text-purple-800 dark:text-purple-200">
									Merged Result
								</h3>
							</div>
							<div class="flex-1 overflow-auto">
								<MergeEditor
									content={mergedContent()}
									onContentChange={setMergedContent}
									conflicts={mergeConflicts()}
									selectedConflictIndex={selectedConflictIndex()}
									onSelectConflict={setSelectedConflictIndex}
									onAcceptLeft={acceptLeft}
									onAcceptRight={acceptRight}
									fileExtension={fileExtension()}
								/>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between flex-shrink-0">
						<div class="flex space-x-2">
							<button
								onClick={useLocalContent}
								class="px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 rounded-md transition-colors"
							>
								Use All Local
							</button>
							<button
								onClick={useExternalContent}
								class="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 rounded-md transition-colors"
							>
								Use All External
							</button>
						</div>

						<div class="flex space-x-3">
							<button
								onClick={props.onCancel}
								class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleSaveMerge}
								class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
							>
								Save Merge
							</button>
						</div>
					</div>
				</div>
			</div>
		</Show>
	)
}

/**
 * Props for DiffPanel component
 */
interface DiffPanelProps {
	content: string
	otherContent: string
	side: 'local' | 'external'
	fileExtension: string
}

/**
 * Individual diff panel showing content with line-by-line highlighting
 */
function DiffPanel(props: DiffPanelProps) {
	const lines = createMemo(() => props.content.split('\n'))
	const otherLines = createMemo(() => props.otherContent.split('\n'))
	
	// Compute which lines are different
	const diffLines = createMemo(() => {
		const content = lines()
		const other = otherLines()
		const result: Array<{ line: string; type: 'unchanged' | 'added' | 'deleted' | 'modified'; lineNumber: number }> = []
		
		const maxLines = Math.max(content.length, other.length)
		
		for (let i = 0; i < maxLines; i++) {
			const currentLine = content[i] ?? ''
			const otherLine = other[i] ?? ''
			
			let type: 'unchanged' | 'added' | 'deleted' | 'modified' = 'unchanged'
			
			if (i >= content.length) {
				// Line doesn't exist in current content
				type = props.side === 'local' ? 'deleted' : 'added'
			} else if (i >= other.length) {
				// Line doesn't exist in other content
				type = props.side === 'local' ? 'added' : 'deleted'
			} else if (currentLine !== otherLine) {
				// Lines are different
				type = 'modified'
			}
			
			if (i < content.length) {
				result.push({
					line: currentLine,
					type,
					lineNumber: i + 1
				})
			}
		}
		
		return result
	})

	const getLineClass = (type: string) => {
		switch (type) {
			case 'added':
				return 'bg-green-100 dark:bg-green-900 border-l-2 border-green-500'
			case 'deleted':
				return 'bg-red-100 dark:bg-red-900 border-l-2 border-red-500'
			case 'modified':
				return 'bg-yellow-100 dark:bg-yellow-900 border-l-2 border-yellow-500'
			default:
				return ''
		}
	}

	return (
		<div class="font-mono text-sm">
			<For each={diffLines()}>
				{(diffLine) => (
					<div class={`flex ${getLineClass(diffLine.type)}`}>
						<div class="w-12 px-2 py-1 text-gray-500 dark:text-gray-400 text-right border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
							{diffLine.lineNumber}
						</div>
						<div class="px-3 py-1 flex-1 whitespace-pre-wrap break-all">
							{diffLine.line || ' '}
						</div>
					</div>
				)}
			</For>
		</div>
	)
}

/**
 * Props for MergeEditor component
 */
interface MergeEditorProps {
	content: string
	onContentChange: (content: string) => void
	conflicts: MergeConflictSection[]
	selectedConflictIndex: number | null
	onSelectConflict: (index: number | null) => void
	onAcceptLeft: (conflictIndex: number) => void
	onAcceptRight: (conflictIndex: number) => void
	fileExtension: string
}

/**
 * Merge editor with conflict resolution controls
 */
function MergeEditor(props: MergeEditorProps) {
	let textareaRef: HTMLTextAreaElement | undefined

	const lines = createMemo(() => props.content.split('\n'))
	
	const conflictLines = createMemo(() => {
		const conflicts = props.conflicts.filter(c => c.type === 'conflict')
		const result = new Set<number>()
		
		conflicts.forEach(conflict => {
			for (let i = conflict.startLine; i <= conflict.endLine; i++) {
				result.add(i)
			}
		})
		
		return result
	})

	const handleTextareaChange = (e: Event) => {
		const target = e.currentTarget as HTMLTextAreaElement
		props.onContentChange(target.value)
	}

	const handleLineClick = (lineIndex: number) => {
		const conflicts = props.conflicts.filter(c => c.type === 'conflict')
		const conflictIndex = conflicts.findIndex(c => 
			lineIndex >= c.startLine && lineIndex <= c.endLine
		)
		
		if (conflictIndex >= 0) {
			props.onSelectConflict(conflictIndex)
		} else {
			props.onSelectConflict(null)
		}
	}

	return (
		<div class="h-full flex">
			{/* Line numbers and conflict indicators */}
			<div class="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
				<For each={lines()}>
					{(line, index) => {
						const lineNumber = index() + 1
						const isConflictLine = conflictLines().has(index())
						const conflicts = props.conflicts.filter(c => c.type === 'conflict')
						const conflictIndex = conflicts.findIndex(c => 
							index() >= c.startLine && index() <= c.endLine
						)
						const isSelected = conflictIndex >= 0 && conflictIndex === props.selectedConflictIndex
						
						return (
							<div 
								class={`flex items-center px-2 py-1 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
									isConflictLine ? 'bg-red-50 dark:bg-red-900' : ''
								} ${isSelected ? 'bg-blue-100 dark:bg-blue-800' : ''}`}
								onClick={() => handleLineClick(index())}
							>
								<div class="w-8 text-right text-gray-500 dark:text-gray-400">
									{lineNumber}
								</div>
								{isConflictLine && (
									<div class="ml-2 flex space-x-1">
										{conflictIndex >= 0 && (
											<>
												<button
													onClick={(e) => {
														e.stopPropagation()
														props.onAcceptLeft(conflictIndex)
													}}
													class="w-4 h-4 bg-green-500 hover:bg-green-600 text-white text-xs rounded flex items-center justify-center"
													title="Accept local changes"
												>
													L
												</button>
												<button
													onClick={(e) => {
														e.stopPropagation()
														props.onAcceptRight(conflictIndex)
													}}
													class="w-4 h-4 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded flex items-center justify-center"
													title="Accept external changes"
												>
													R
												</button>
											</>
										)}
									</div>
								)}
							</div>
						)
					}}
				</For>
			</div>

			{/* Content editor */}
			<div class="flex-1">
				<textarea
					ref={textareaRef}
					value={props.content}
					onInput={handleTextareaChange}
					class="w-full h-full text-sm font-mono border-0 p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
					placeholder="Edit the merged content here..."
					spellcheck={false}
				/>
			</div>
		</div>
	)
}

/**
 * Compute a simple diff between two strings
 */
function computeDiff(original: string, modified: string): DiffChunk[] {
	const originalLines = original.split('\n')
	const modifiedLines = modified.split('\n')
	
	// Simple line-by-line diff implementation
	const chunks: DiffChunk[] = []
	let originalIndex = 0
	let modifiedIndex = 0
	
	while (originalIndex < originalLines.length || modifiedIndex < modifiedLines.length) {
		const chunkLines: DiffLine[] = []
		const chunkStart = originalIndex
		const modifiedStart = modifiedIndex
		
		// Find a sequence of matching or differing lines
		let foundDifference = false
		
		while (originalIndex < originalLines.length && modifiedIndex < modifiedLines.length) {
			const originalLine = originalLines[originalIndex] ?? ''
			const modifiedLine = modifiedLines[modifiedIndex] ?? ''
			
			if (originalLine === modifiedLine) {
				// Lines match
				chunkLines.push({
					originalLineNumber: originalIndex,
					modifiedLineNumber: modifiedIndex,
					content: originalLine,
					type: 'unchanged'
				})
				originalIndex++
				modifiedIndex++
				
				if (foundDifference) {
					// End of difference sequence
					break
				}
			} else {
				// Lines differ
				foundDifference = true
				
				// Simple heuristic: if next lines match, treat as modification
				// Otherwise, treat as addition/deletion
				const nextOriginalMatches = originalIndex + 1 < originalLines.length && 
					(originalLines[originalIndex + 1] ?? '') === modifiedLine
				const nextModifiedMatches = modifiedIndex + 1 < modifiedLines.length && 
					(modifiedLines[modifiedIndex + 1] ?? '') === originalLine
				
				if (nextOriginalMatches) {
					// Deletion in original
					chunkLines.push({
						originalLineNumber: originalIndex,
						modifiedLineNumber: -1,
						content: originalLine,
						type: 'deleted'
					})
					originalIndex++
				} else if (nextModifiedMatches) {
					// Addition in modified
					chunkLines.push({
						originalLineNumber: -1,
						modifiedLineNumber: modifiedIndex,
						content: modifiedLine,
						type: 'added'
					})
					modifiedIndex++
				} else {
					// Modification
					chunkLines.push({
						originalLineNumber: originalIndex,
						modifiedLineNumber: modifiedIndex,
						content: modifiedLine,
						type: 'modified'
					})
					originalIndex++
					modifiedIndex++
				}
			}
		}
		
		// Handle remaining lines
		while (originalIndex < originalLines.length) {
			chunkLines.push({
				originalLineNumber: originalIndex,
				modifiedLineNumber: -1,
				content: originalLines[originalIndex] ?? '',
				type: 'deleted'
			})
			originalIndex++
		}
		
		while (modifiedIndex < modifiedLines.length) {
			chunkLines.push({
				originalLineNumber: -1,
				modifiedLineNumber: modifiedIndex,
				content: modifiedLines[modifiedIndex] ?? '',
				type: 'added'
			})
			modifiedIndex++
		}
		
		if (chunkLines.length > 0) {
			chunks.push({
				lines: chunkLines,
				originalStart: chunkStart,
				modifiedStart: modifiedStart
			})
		}
	}
	
	return chunks
}

/**
 * Parse merge conflicts in content (Git-style conflict markers)
 */
function parseMergeConflicts(content: string): MergeConflictSection[] {
	const lines = content.split('\n')
	const sections: MergeConflictSection[] = []
	
	let currentSection: MergeConflictSection | null = null
	let lineIndex = 0
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? ''
		
		if (line.startsWith('<<<<<<<')) {
			// Start of conflict
			if (currentSection) {
				// End previous section
				currentSection.endLine = i - 1
				sections.push(currentSection)
			}
			
			currentSection = {
				type: 'conflict',
				lines: [],
				localLines: [],
				externalLines: [],
				startLine: i,
				endLine: i
			}
		} else if (line.startsWith('=======') && currentSection?.type === 'conflict') {
			// Switch from local to external in conflict
			// Local lines are already collected, now collect external lines
		} else if (line.startsWith('>>>>>>>') && currentSection?.type === 'conflict') {
			// End of conflict
			currentSection.endLine = i
			sections.push(currentSection)
			currentSection = null
		} else if (currentSection?.type === 'conflict') {
			// Inside conflict section
			if (currentSection.localLines && !line.startsWith('=======')) {
				if (!lines.slice(currentSection.startLine + 1, i).some(l => (l ?? '').startsWith('======='))) {
					// Still in local section
					currentSection.localLines.push(line)
				} else {
					// In external section
					currentSection.externalLines!.push(line)
				}
			}
			currentSection.lines.push(line)
		} else {
			// Regular content outside conflicts
			if (currentSection) {
				currentSection.endLine = i - 1
				sections.push(currentSection)
				currentSection = null
			}
			
			// Start new unchanged section or extend existing one
			const lastSection = sections[sections.length - 1]
			if (lastSection && lastSection.type === 'unchanged' && lastSection.endLine === i - 1) {
				// Extend existing unchanged section
				lastSection.lines.push(line)
				lastSection.endLine = i
			} else {
				// Start new unchanged section
				sections.push({
					type: 'unchanged',
					lines: [line],
					startLine: i,
					endLine: i
				})
			}
		}
	}
	
	// Handle any remaining section
	if (currentSection) {
		currentSection.endLine = lines.length - 1
		sections.push(currentSection)
	}
	
	return sections
}