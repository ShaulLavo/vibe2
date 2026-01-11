import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EditorRegistryImpl } from './editor-registry'
import type { EditorInstance } from './types'

// Mock EditorInstance
const createMockEditor = (id: string): EditorInstance => ({
	getContent: vi.fn().mockReturnValue(`content-${id}`),
	setContent: vi.fn(),
	isDirty: vi.fn().mockReturnValue(false),
	markClean: vi.fn(),
	getCursorPosition: vi.fn().mockReturnValue({ line: 0, column: 0 }),
	setCursorPosition: vi.fn(),
	getScrollPosition: vi.fn().mockReturnValue({ scrollTop: 0, scrollLeft: 0 }),
	setScrollPosition: vi.fn(),
	getFoldedRegions: vi.fn().mockReturnValue([]),
	setFoldedRegions: vi.fn(),
	onContentChange: vi.fn().mockReturnValue(() => {}),
	onDirtyStateChange: vi.fn().mockReturnValue(() => {}),
})

describe('EditorRegistryImpl', () => {
	let registry: EditorRegistryImpl

	beforeEach(() => {
		registry = new EditorRegistryImpl()
	})

	it('should register and retrieve editors', () => {
		const editor = createMockEditor('1')
		const path = '/test/file.ts'

		registry.registerEditor(path, editor)

		expect(registry.getEditor(path)).toBe(editor)
		expect(registry.hasEditor(path)).toBe(true)
		expect(registry.size).toBe(1)
	})

	it('should unregister editors', () => {
		const editor = createMockEditor('1')
		const path = '/test/file.ts'

		registry.registerEditor(path, editor)
		registry.unregisterEditor(path)

		expect(registry.getEditor(path)).toBeUndefined()
		expect(registry.hasEditor(path)).toBe(false)
		expect(registry.size).toBe(0)
	})

	it('should return all open file paths', () => {
		const editor1 = createMockEditor('1')
		const editor2 = createMockEditor('2')
		const path1 = '/test/file1.ts'
		const path2 = '/test/file2.ts'

		registry.registerEditor(path1, editor1)
		registry.registerEditor(path2, editor2)

		const openFiles = registry.getOpenFiles()
		expect(openFiles).toHaveLength(2)
		expect(openFiles).toContain(path1)
		expect(openFiles).toContain(path2)
	})

	it('should emit open events', () => {
		const editor = createMockEditor('1')
		const path = '/test/file.ts'
		const openEvents: Array<{ path: string; editor: EditorInstance }> = []

		const unsubscribe = registry.onEditorOpen((path, editor) => {
			openEvents.push({ path, editor })
		})

		registry.registerEditor(path, editor)

		expect(openEvents).toHaveLength(1)
		expect(openEvents[0]?.path).toBe(path)
		expect(openEvents[0]?.editor).toBe(editor)

		unsubscribe()
	})

	it('should emit close events', () => {
		const editor = createMockEditor('1')
		const path = '/test/file.ts'
		const closeEvents: string[] = []

		const unsubscribe = registry.onEditorClose((path) => {
			closeEvents.push(path)
		})

		registry.registerEditor(path, editor)
		registry.unregisterEditor(path)

		expect(closeEvents).toHaveLength(1)
		expect(closeEvents[0]).toBe(path)

		unsubscribe()
	})

	it('should replace existing editor for same path', () => {
		const editor1 = createMockEditor('1')
		const editor2 = createMockEditor('2')
		const path = '/test/file.ts'
		const events: Array<{ type: 'open' | 'close'; path: string }> = []

		const unsubscribeOpen = registry.onEditorOpen((path) => {
			events.push({ type: 'open', path })
		})
		const unsubscribeClose = registry.onEditorClose((path) => {
			events.push({ type: 'close', path })
		})

		registry.registerEditor(path, editor1)
		registry.registerEditor(path, editor2) // Should close editor1 and open editor2

		expect(registry.getEditor(path)).toBe(editor2)
		expect(registry.size).toBe(1)
		expect(events).toHaveLength(3) // open, close, open
		expect(events[0]).toEqual({ type: 'open', path })
		expect(events[1]).toEqual({ type: 'close', path })
		expect(events[2]).toEqual({ type: 'open', path })

		unsubscribeOpen()
		unsubscribeClose()
	})

	it('should dispose all resources', () => {
		const editor1 = createMockEditor('1')
		const editor2 = createMockEditor('2')
		const path1 = '/test/file1.ts'
		const path2 = '/test/file2.ts'

		registry.registerEditor(path1, editor1)
		registry.registerEditor(path2, editor2)

		expect(registry.size).toBe(2)

		registry.dispose()

		expect(registry.size).toBe(0)
		expect(registry.getOpenFiles()).toHaveLength(0)
	})
})