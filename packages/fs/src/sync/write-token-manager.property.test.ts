import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { WriteTokenManager } from './write-token-manager'

describe('WriteTokenManager Property Tests', () => {
	let manager: WriteTokenManager

	beforeEach(() => {
		vi.useFakeTimers()
		manager = new WriteTokenManager()
	})

	afterEach(() => {
		manager.dispose()
		vi.useRealTimers()
	})

	/**
	 * Property 2: Write Token Filtering
	 * For any write operation initiated through beginWrite/endWrite, when the observer detects 
	 * a change within the token expiry window with an mtime >= expectedMtimeMin, the change 
	 * SHALL be classified as self-triggered and SHALL NOT emit an external-change or conflict event.
	 * 
	 * **Feature: file-sync-layer, Property 2: Write Token Filtering**
	 * **Validates: Requirements 2.2, 2.3**
	 */
	it('Property 2: Write Token Filtering - should correctly identify self-triggered changes', () => {
		fc.assert(
			fc.property(
				// Generate test data
				fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 5 }), // file paths (non-empty after trim)
				fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 10 }), // mtime offsets
				(paths, mtimeOffsets) => {
					// Reset manager for each property test iteration
					manager.dispose()
					manager = new WriteTokenManager({ tokenExpiryMs: 5000 })

					const baseTime = Date.now()
					const uniquePaths = [...new Set(paths)] // Ensure unique paths
					
					if (uniquePaths.length === 0) return // Skip empty paths

					// Generate one token per unique path
					const tokenData: Array<{ path: string; token: any }> = []
					for (const path of uniquePaths) {
						const token = manager.generateToken(path)
						tokenData.push({ path, token })
					}

					// Test the core property: tokens should match their own path with valid mtime
					for (const { path, token } of tokenData) {
						// Test with a valid mtime (>= expectedMtimeMin and within expiry)
						const validMtime = token.expectedMtimeMin + 10
						const matchedToken = manager.matchToken(path, validMtime)
						
						// Should match and return the token
						expect(matchedToken).toBeDefined()
						expect(matchedToken?.id).toBe(token.id)
						expect(matchedToken?.path).toBe(path)
						
						// After matching, token should be cleared
						const secondMatch = manager.matchToken(path, validMtime)
						expect(secondMatch).toBeUndefined()
						
						// Regenerate token for next tests
						const newToken = manager.generateToken(path)
						
						// Test with invalid mtime (< expectedMtimeMin)
						const invalidMtime = newToken.expectedMtimeMin - 10
						const invalidMatch = manager.matchToken(path, invalidMtime)
						expect(invalidMatch).toBeUndefined()
					}

					// Test cross-path isolation: tokens should not match wrong paths
					if (uniquePaths.length > 1) {
						const path1 = uniquePaths[0]!
						const path2 = uniquePaths[1]!
						
						const token1 = manager.generateToken(path1)
						const token2 = manager.generateToken(path2)
						
						const validMtime = Math.max(token1.expectedMtimeMin, token2.expectedMtimeMin) + 10
						
						// Token1 should not match path2
						const wrongMatch1 = manager.matchToken(path2, validMtime)
						if (wrongMatch1) {
							expect(wrongMatch1.id).not.toBe(token1.id)
						}
						
						// Token2 should not match path1  
						const wrongMatch2 = manager.matchToken(path1, validMtime)
						if (wrongMatch2) {
							expect(wrongMatch2.id).not.toBe(token2.id)
						}
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Additional property test for token expiry behavior
	 */
	it('Property 2 Extension: Token expiry should prevent false matches', () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1, maxLength: 20 }), // file path
				fc.integer({ min: 1, max: 100 }), // expiry time in ms
				fc.integer({ min: 101, max: 1000 }), // delay beyond expiry
				(path, expiryMs, delayMs) => {
					manager.dispose()
					manager = new WriteTokenManager({ tokenExpiryMs: expiryMs })

					const token = manager.generateToken(path)
					const baseTime = Date.now()

					// Simulate time passing beyond expiry
					const futureTime = baseTime + delayMs
					
					// Mock Date.now to return future time for expiry check
					const originalNow = Date.now
					Date.now = vi.fn(() => futureTime)

					try {
						const matchedToken = manager.matchToken(path, futureTime)
						
						if (delayMs > expiryMs) {
							// Should not match expired token
							expect(matchedToken).toBeUndefined()
						}
					} finally {
						Date.now = originalNow
					}
				}
			),
			{ numRuns: 100 }
		)
	})

	/**
	 * Property test for token uniqueness and isolation
	 */
	it('Property 2 Extension: Token isolation between paths', () => {
		fc.assert(
			fc.property(
				fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 2, maxLength: 10 }), // multiple paths
				fc.integer({ min: 0, max: 1000 }), // mtime
				(paths, mtime) => {
					// Ensure paths are unique
					const uniquePaths = [...new Set(paths)]
					if (uniquePaths.length < 2) return // Skip if not enough unique paths

					const tokens = uniquePaths.map(path => ({
						path,
						token: manager.generateToken(path)
					}))

					// Each token should only match its own path
					for (const { path, token } of tokens) {
						const matchedToken = manager.matchToken(path, mtime + token.expectedMtimeMin)
						
						if (matchedToken) {
							expect(matchedToken.path).toBe(path)
							expect(matchedToken.id).toBe(token.id)
						}

						// Should not match other paths
						for (const otherPath of uniquePaths) {
							if (otherPath !== path) {
								const wrongMatch = manager.matchToken(otherPath, mtime + token.expectedMtimeMin)
								if (wrongMatch) {
									expect(wrongMatch.id).not.toBe(token.id)
								}
							}
						}
					}
				}
			),
			{ numRuns: 100 }
		)
	})
})