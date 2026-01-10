import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { ByteContentHandle, ByteContentHandleFactory } from './content-handle'

describe('ContentHandle', () => {
	describe('Property 7: Content Handle Round-Trip', () => {
		it('should round-trip bytes correctly', () => {
			// **Feature: file-sync-layer, Property 7: Content Handle Round-Trip**
			// **Validates: Requirements 9.1**
			fc.assert(
				fc.property(fc.uint8Array(), (bytes) => {
					const handle = ByteContentHandleFactory.fromBytes(bytes)
					const roundTripped = handle.toBytes()
					
					// The round-tripped bytes should be identical to the original
					expect(roundTripped).toEqual(bytes)
				}),
				{ numRuns: 100 }
			)
		})

		it('should round-trip strings correctly', () => {
			// **Feature: file-sync-layer, Property 7: Content Handle Round-Trip**
			// **Validates: Requirements 9.1**
			fc.assert(
				fc.property(fc.string(), (str) => {
					const handle = ByteContentHandleFactory.fromString(str)
					const roundTripped = handle.toString()
					
					// The round-tripped string should be identical to the original
					expect(roundTripped).toBe(str)
				}),
				{ numRuns: 100 }
			)
		})

		it('should maintain consistency between bytes and string conversions', () => {
			// **Feature: file-sync-layer, Property 7: Content Handle Round-Trip**
			// **Validates: Requirements 9.1**
			fc.assert(
				fc.property(fc.string(), (str) => {
					// Create handle from string
					const handleFromString = ByteContentHandleFactory.fromString(str)
					
					// Convert to bytes and back to handle
					const bytes = handleFromString.toBytes()
					const handleFromBytes = ByteContentHandleFactory.fromBytes(bytes)
					
					// Both handles should be equal and produce the same string
					expect(handleFromString.equals(handleFromBytes)).toBe(true)
					expect(handleFromBytes.toString()).toBe(str)
				}),
				{ numRuns: 100 }
			)
		})

		it('should handle empty content correctly', () => {
			// **Feature: file-sync-layer, Property 7: Content Handle Round-Trip**
			// **Validates: Requirements 9.1**
			const emptyFromFactory = ByteContentHandleFactory.empty()
			const emptyFromBytes = ByteContentHandleFactory.fromBytes(new Uint8Array(0))
			const emptyFromString = ByteContentHandleFactory.fromString('')
			
			// All empty handles should be equal
			expect(emptyFromFactory.equals(emptyFromBytes)).toBe(true)
			expect(emptyFromFactory.equals(emptyFromString)).toBe(true)
			
			// Round-trip should work
			expect(emptyFromFactory.toBytes()).toEqual(new Uint8Array(0))
			expect(emptyFromFactory.toString()).toBe('')
		})
	})
})