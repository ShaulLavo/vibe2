import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EditorStateManager } from './editor-state-manager'
import type { EditorInstance, EditorState, CursorPosition } from './types'

// Mock EditorInstance for testing
const createMockEditor = (content: string = ''): EditorInstance => ({
	getContent: vi.fn(() => content),
	setContent: vi.fn(),
	isDirty: vi.fn(() => false),
	markClean: vi.fn(),
	getCursorPosition: vi.fn(() => ({ line: 0, column: 0 })),
	setCursorPosition: vi.fn(),
	getScrollPosition: vi.fn(() => ({ scrollTop: 0, scrollLeft: 0 })),
	setScrollPosition: vi.fn(),
	getFoldedRegions: vi.fn(() => []),
	setFoldedRegions: vi.fn(),
	onContentChange: vi.fn(() => () => {}),
	onDirtyStateChange: vi.fn(() => () => {}),
})

describe('EditorStateManager', () => {
	let stateManager: EditorStateManager
	let mockEditor: EditorInstance

	beforeEach(() => {
		stateManager = new EditorStateManager()
		mockEditor = createMockEditor()
	})

	describe('captureState', () => {
		it('should capture all editor state components', () => {
			const mockState = {
				cursorPosition: { line: 5, column: 10 },
				scrollPosition: { scrollTop: 100, scrollLeft: 0 },
				foldedRegions: [{ startLine: 2, endLine: 4 }]
			}

			mockEditor.getCursorPosition = vi.fn(() => mockState.cursorPosition)
			mockEditor.getScrollPosition = vi.fn(() => mockState.scrollPosition)
			mockEditor.getFoldedRegions = vi.fn(() => mockState.foldedRegions)

			const capturedState = stateManager.captureState(mockEditor)

			expect(capturedState).toEqual({
				cursorPosition: mockState.cursorPosition,
				scrollPosition: mockState.scrollPosition,
				foldedRegions: mockState.foldedRegions,
			})
		})
	})

	describe('calculateBestCursorPosition', () => {
		it('should preserve position when line is unchanged', () => {
			const oldContent = 'line 1\nline 2\nline 3'
			const newContent = 'line 1\nline 2\nline 3'
			const oldPosition: CursorPosition = { line: 1, column: 4 }

			const newPosition = stateManager.calculateBestCursorPosition(oldContent, newContent, oldPosition)

			expect(newPosition).toEqual({ line: 1, column: 4 })
		})

		it('should adjust column when line is shorter', () => {
			const oldContent = 'line 1\nvery long line here\nline 3'
			const newContent = 'line 1\nvery long\nline 3'  // Similar but shorter
			const oldPosition: CursorPosition = { line: 1, column: 15 }

			const newPosition = stateManager.calculateBestCursorPosition(oldContent, newContent, oldPosition)

			expect(newPosition).toEqual({ line: 1, column: 9 }) // "very long".length
		})

		it('should find similar line nearby when exact line changed', () => {
			const oldContent = 'function test() {\n  console.log("hello")\n}'
			const newContent = 'function test() {\n  console.log("hello world")\n}'
			const oldPosition: CursorPosition = { line: 1, column: 10 }

			const newPosition = stateManager.calculateBestCursorPosition(oldContent, newContent, oldPosition)

			expect(newPosition.line).toBe(1) // Should stay on the similar line
		})

		it('should use relative positioning when line is completely different', () => {
			const oldContent = 'line 1\nline 2\nline 3\nline 4'
			const newContent = 'completely\ndifferent\ncontent\nhere\nnow'
			const oldPosition: CursorPosition = { line: 2, column: 0 } // Middle of old content

			const newPosition = stateManager.calculateBestCursorPosition(oldContent, newContent, oldPosition)

			// Should be roughly in the middle of new content
			expect(newPosition.line).toBeGreaterThanOrEqual(1)
			expect(newPosition.line).toBeLessThan(5)
			expect(newPosition.column).toBe(0) // Safe fallback
		})

		it('should handle position beyond new content bounds', () => {
			const oldContent = 'line 1\nline 2\nline 3\nline 4\nline 5'
			const newContent = 'line 1\nline 2'
			const oldPosition: CursorPosition = { line: 4, column: 0 }

			const newPosition = stateManager.calculateBestCursorPosition(oldContent, newContent, oldPosition)

			expect(newPosition.line).toBeLessThan(2) // Within new content bounds
		})
	})

	describe('restoreState', () => {
		it('should restore cursor position within bounds', () => {
			const state: EditorState = {
				cursorPosition: { line: 1, column: 5 },
				scrollPosition: { scrollTop: 50, scrollLeft: 0 },
				foldedRegions: []
			}
			const newContent = 'line 1\nline 2 is here\nline 3'

			mockEditor.getContent = vi.fn(() => 'line 1\nline 2\nline 3')

			stateManager.restoreState(mockEditor, state, newContent)

			expect(mockEditor.setCursorPosition).toHaveBeenCalledWith({ line: 1, column: 5 })
			expect(mockEditor.setScrollPosition).toHaveBeenCalledWith({ scrollTop: 50, scrollLeft: 0 })
		})

		it('should clamp cursor position to line length', () => {
			const state: EditorState = {
				cursorPosition: { line: 1, column: 20 }, // Beyond line length
				scrollPosition: { scrollTop: 0, scrollLeft: 0 },
				foldedRegions: []
			}
			const newContent = 'line 1\nshort\nline 3'

			mockEditor.getContent = vi.fn(() => 'line 1\noriginal long line\nline 3')

			stateManager.restoreState(mockEditor, state, newContent)

			expect(mockEditor.setCursorPosition).toHaveBeenCalledWith({ line: 1, column: 5 }) // "short".length
		})

		it('should filter out invalid folded regions', () => {
			const state: EditorState = {
				cursorPosition: { line: 0, column: 0 },
				scrollPosition: { scrollTop: 0, scrollLeft: 0 },
				foldedRegions: [
					{ startLine: 1, endLine: 3 }, // Valid
					{ startLine: 5, endLine: 10 }, // Invalid - beyond content
					{ startLine: 3, endLine: 2 }, // Invalid - start > end
				]
			}
			const newContent = 'line 1\nline 2\nline 3\nline 4'

			mockEditor.getContent = vi.fn(() => 'old content')

			stateManager.restoreState(mockEditor, state, newContent)

			expect(mockEditor.setFoldedRegions).toHaveBeenCalledWith([
				{ startLine: 1, endLine: 3 }
			])
		})

		it('should handle scroll position restoration failure gracefully', () => {
			const state: EditorState = {
				cursorPosition: { line: 0, column: 0 },
				scrollPosition: { scrollTop: 100, scrollLeft: 0 },
				foldedRegions: []
			}

			mockEditor.setScrollPosition = vi.fn(() => {
				throw new Error('Scroll restoration failed')
			})
			mockEditor.getContent = vi.fn(() => 'content')

			// Should not throw
			expect(() => {
				stateManager.restoreState(mockEditor, state, 'new content')
			}).not.toThrow()

			expect(mockEditor.setCursorPosition).toHaveBeenCalled()
		})
	})
})