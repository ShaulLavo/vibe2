import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { CACHE_KEY_SCHEMA } from './treeCacheController'

describe('TreeCacheController', () => {
	describe('Property 2: Cache key format consistency', () => {
		it('should generate cache keys in the format "v1:tree:{directory_path}" for directory nodes', () => {
			fc.assert(
				fc.property(
					fc.oneof(
						fc.string({ minLength: 1, maxLength: 30 }).map(s => `/${s.replace(/\0/g, '')}`),
						fc.string({ minLength: 1, maxLength: 30 }).map(s => s.replace(/\0/g, '')),
						fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 })
							.map(parts => parts.map(p => p.replace(/\0/g, '')).join('/')),
						fc.constant('/'),
						fc.constant('')
					),
					(directoryPath) => {
						const cacheKey = CACHE_KEY_SCHEMA.dir(directoryPath)
						const expectedKey = `v1:tree:dir:${directoryPath}`
						
						expect(cacheKey).toBe(expectedKey)
						expect(cacheKey).toMatch(/^v1:tree:dir:.*$/)
						expect(cacheKey.startsWith('v1:tree:dir:')).toBe(true)
						
						const extractedPath = cacheKey.substring('v1:tree:dir:'.length)
						expect(extractedPath).toBe(directoryPath)
					}
				),
				{ numRuns: 20 }
			)
		})
	})

	describe('Cache key schema', () => {
		it('should generate correct root cache keys', () => {
			expect(CACHE_KEY_SCHEMA.root('local')).toBe('v1:tree:root:local')
			expect(CACHE_KEY_SCHEMA.root('opfs')).toBe('v1:tree:root:opfs')
			expect(CACHE_KEY_SCHEMA.root('memory')).toBe('v1:tree:root:memory')
		})

		it('should generate correct directory cache keys', () => {
			expect(CACHE_KEY_SCHEMA.dir('/')).toBe('v1:tree:dir:/')
			expect(CACHE_KEY_SCHEMA.dir('/src')).toBe('v1:tree:dir:/src')
			expect(CACHE_KEY_SCHEMA.dir('/src/components')).toBe('v1:tree:dir:/src/components')
		})

		it('should generate correct metadata cache keys', () => {
			expect(CACHE_KEY_SCHEMA.meta('/')).toBe('v1:tree:meta:/')
			expect(CACHE_KEY_SCHEMA.meta('/src')).toBe('v1:tree:meta:/src')
			expect(CACHE_KEY_SCHEMA.meta('/src/components')).toBe('v1:tree:meta:/src/components')
		})
	})
})