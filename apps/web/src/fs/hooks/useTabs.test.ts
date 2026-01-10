import { describe, it, expect } from 'vitest'
import { createTabId, parseTabId, migrateTabState } from '../types/TabIdentity'

describe('Tab Identity System', () => {
	describe('createTabId', () => {
		it('should create tab ID from identity', () => {
			const identity = { path: '/test/file.txt', viewMode: 'editor' as const }
			expect(createTabId(identity)).toBe('/test/file.txt:editor')
		})

		it('should handle different view modes', () => {
			expect(createTabId({ path: '/settings.json', viewMode: 'ui' })).toBe('/settings.json:ui')
			expect(createTabId({ path: '/binary.exe', viewMode: 'binary' })).toBe('/binary.exe:binary')
		})
	})

	describe('parseTabId', () => {
		it('should parse tab ID back to identity', () => {
			const identity = parseTabId('/test/file.txt:editor')
			expect(identity).toEqual({ path: '/test/file.txt', viewMode: 'editor' })
		})

		it('should default to editor mode for legacy tab IDs', () => {
			const identity = parseTabId('/test/file.txt')
			expect(identity).toEqual({ path: '/test/file.txt', viewMode: 'editor' })
		})

		it('should handle different view modes', () => {
			expect(parseTabId('/settings.json:ui')).toEqual({ path: '/settings.json', viewMode: 'ui' })
			expect(parseTabId('/binary.exe:binary')).toEqual({ path: '/binary.exe', viewMode: 'binary' })
		})
	})

	describe('migrateTabState', () => {
		it('should migrate legacy tabs without view modes', () => {
			const legacyTabs = ['/file1.txt', '/file2.txt']
			const migrated = migrateTabState(legacyTabs)
			expect(migrated).toEqual(['/file1.txt:editor', '/file2.txt:editor'])
		})

		it('should leave already migrated tabs unchanged', () => {
			const modernTabs = ['/file1.txt:editor', '/file2.txt:ui']
			const migrated = migrateTabState(modernTabs)
			expect(migrated).toEqual(['/file1.txt:editor', '/file2.txt:ui'])
		})

		it('should handle mixed legacy and modern tabs', () => {
			const mixedTabs = ['/file1.txt', '/file2.txt:ui', '/file3.txt']
			const migrated = migrateTabState(mixedTabs)
			expect(migrated).toEqual(['/file1.txt:editor', '/file2.txt:ui', '/file3.txt:editor'])
		})
	})
})