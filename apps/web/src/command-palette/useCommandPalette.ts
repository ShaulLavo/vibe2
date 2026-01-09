import { createSignal, createMemo, batch } from 'solid-js'
import { searchService } from '../search/SearchService'
import { getCommandPaletteRegistry } from './registry'
import { useFs } from '../fs/context/FsContext'
// import { useFocusManager } from '../focus/focusManager' // TODO: Will be used in later tasks
import type { SearchResult } from '../search/types'
import type { CommandDescriptor } from './types'

export type PaletteMode = 'file' | 'command'

export interface PaletteResult {
	id: string
	label: string
	description?: string
	shortcut?: string
	kind: 'file' | 'command'
}

export interface PaletteState {
	isOpen: boolean
	mode: PaletteMode
	query: string
	selectedIndex: number
	results: PaletteResult[]
	loading: boolean
}

export interface PaletteActions {
	open(mode?: PaletteMode): void
	close(): void
	setQuery(query: string): void
	selectNext(): void
	selectPrevious(): void
	setSelectedIndex(index: number): void
	activateSelected(): void
}

// Helper function to detect mode from query
function detectModeFromQuery(query: string): PaletteMode {
	return query.startsWith('>') ? 'command' : 'file'
}

// Helper function to transform SearchResult to PaletteResult
function fileToResult(file: SearchResult): PaletteResult {
	const fileName = file.path.split('/').pop() || file.path
	return {
		id: `file:${file.path}`,
		label: fileName,
		description: file.path,
		kind: 'file'
	}
}

// Helper function to transform CommandDescriptor to PaletteResult
function commandToResult(cmd: CommandDescriptor): PaletteResult {
	return {
		id: `cmd:${cmd.id}`,
		label: cmd.label,
		description: cmd.category,
		shortcut: cmd.shortcut,
		kind: 'command'
	}
}

export function useCommandPalette(): [() => PaletteState, PaletteActions] {
	// Get FS actions for file opening
	const [, fsActions] = useFs()
	
	// State signals
	const [isOpen, setIsOpen] = createSignal(false)
	const [query, setQuery] = createSignal('')
	const [selectedIndex, setSelectedIndex] = createSignal(0)
	const [results, setResults] = createSignal<PaletteResult[]>([])
	const [loading, setLoading] = createSignal(false)
	
	// Focus manager for focus restoration
	// const focusManager = useFocusManager() // TODO: Will be used in later tasks
	let previousActiveElement: HTMLElement | null = null

	// Computed mode based on query
	const mode = createMemo(() => detectModeFromQuery(query()))

	// Computed state object
	const state = createMemo((): PaletteState => ({
		isOpen: isOpen(),
		mode: mode(),
		query: query(),
		selectedIndex: selectedIndex(),
		results: results(),
		loading: loading()
	}))

	// Search function that handles both file and command modes
	const performSearch = async (searchQuery: string) => {
		if (!searchQuery.trim()) {
			setResults([])
			return
		}

		setLoading(true)
		
		try {
			const currentMode = detectModeFromQuery(searchQuery)
			
			if (currentMode === 'command') {
				// Remove the '>' prefix for command search
				const commandQuery = searchQuery.slice(1).trim()
				const registry = getCommandPaletteRegistry()
				const commands = registry.search(commandQuery)
				const commandResults = commands.map(commandToResult)
				setResults(commandResults)
			} else {
				// File mode search
				const files = await searchService.search(searchQuery)
				const fileResults = files.map(fileToResult)
				setResults(fileResults)
			}
		} catch (error) {
			console.error('Search failed:', error)
			setResults([])
		} finally {
			setLoading(false)
		}
	}

	// Actions
	const actions: PaletteActions = {
		open(openMode?: PaletteMode) {
			// Store current active element for focus restoration
			if (document.activeElement instanceof HTMLElement) {
				previousActiveElement = document.activeElement
			}
			
			batch(() => {
				setIsOpen(true)
				setSelectedIndex(0)
				
				if (openMode === 'command') {
					setQuery('>')
				} else {
					setQuery('')
				}
				
				// Clear results when opening
				setResults([])
			})
		},

		close() {
			batch(() => {
				setIsOpen(false)
				setQuery('')
				setResults([])
				setSelectedIndex(0)
				setLoading(false)
			})
			
			// Restore focus to previous element
			if (previousActiveElement) {
				previousActiveElement.focus()
				previousActiveElement = null
			}
		},

		setQuery(newQuery: string) {
			batch(() => {
				setQuery(newQuery)
				setSelectedIndex(0) // Reset selection when query changes
			})
			
			// Perform search with debouncing would be ideal, but for now search immediately
			void performSearch(newQuery)
		},

		selectNext() {
			const currentResults = results()
			if (currentResults.length === 0) return
			
			setSelectedIndex(prev => 
				prev < currentResults.length - 1 ? prev + 1 : prev
			)
		},

		selectPrevious() {
			setSelectedIndex(prev => prev > 0 ? prev - 1 : prev)
		},

		setSelectedIndex(index: number) {
			const currentResults = results()
			if (index >= 0 && index < currentResults.length) {
				setSelectedIndex(index)
			}
		},

		activateSelected() {
			const currentResults = results()
			const currentIndex = selectedIndex()
			
			console.log(`[useCommandPalette] activateSelected called`, { 
				resultsCount: currentResults.length, 
				currentIndex 
			})
			
			if (currentResults.length === 0 || currentIndex >= currentResults.length) {
				console.log(`[useCommandPalette] activateSelected: no results or invalid index`)
				return
			}
			
			const selectedResult = currentResults[currentIndex]
			if (!selectedResult) {
				console.log(`[useCommandPalette] activateSelected: selectedResult is undefined`)
				return
			}
			
			console.log(`[useCommandPalette] activateSelected: selected result`, { 
				kind: selectedResult.kind, 
				id: selectedResult.id,
				label: selectedResult.label,
				description: selectedResult.description 
			})
			
			if (selectedResult.kind === 'file') {
				// Handle file activation by opening it in the tab system
				const filePath = selectedResult.description // The full file path is stored in description
				console.log(`[useCommandPalette] activateSelected: opening file`, { filePath })
				if (filePath) {
					void fsActions.selectPath(filePath).then(() => {
						console.log(`[useCommandPalette] activateSelected: selectPath completed successfully`, { filePath })
						actions.close()
					}).catch((error) => {
						console.error('[useCommandPalette] Failed to open file:', error)
					})
				} else {
					console.error('[useCommandPalette] File path not found in result')
					actions.close()
				}
			} else if (selectedResult.kind === 'command') {
				// Execute command
				const commandId = selectedResult.id.replace('cmd:', '')
				const registry = getCommandPaletteRegistry()
				
				void registry.execute(commandId).then(() => {
					actions.close()
				}).catch((error) => {
					console.error('Command execution failed:', error)
				})
			}
		}
	}

	return [state, actions]
}