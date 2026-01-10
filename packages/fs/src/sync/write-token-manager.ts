import type { WriteToken } from './types'

/**
 * Internal token entry with expiry timeout
 */
interface WriteTokenEntry {
	token: WriteToken
	expiryTimeout: ReturnType<typeof setTimeout>
}

/**
 * Options for WriteTokenManager
 */
export interface WriteTokenManagerOptions {
	/** Token expiry time in milliseconds (default: 5000ms) */
	tokenExpiryMs?: number
}

/**
 * Manages write tokens for distinguishing self-triggered changes from external changes
 */
export class WriteTokenManager {
	private readonly tokenExpiryMs: number
	private readonly pendingTokens = new Map<string, WriteTokenEntry>()
	private tokenCounter = 0

	constructor(options: WriteTokenManagerOptions = {}) {
		this.tokenExpiryMs = options.tokenExpiryMs ?? 5000
	}

	/**
	 * Generate a unique write token for a file path
	 */
	generateToken(path: string): WriteToken {
		const now = Date.now()
		const token: WriteToken = {
			id: `token_${++this.tokenCounter}_${now}`,
			path,
			createdAt: now,
			expectedMtimeMin: now, // mtime should be >= this after write
		}

		// Clear any existing token for this path
		this.clearToken(path)

		// Set up expiry timeout
		const expiryTimeout = setTimeout(() => {
			this.expireToken(token.id)
		}, this.tokenExpiryMs)

		// Store the token
		this.pendingTokens.set(token.id, {
			token,
			expiryTimeout,
		})

		return token
	}

	/**
	 * Check if a change matches a pending write token
	 * @param path - File path that changed
	 * @param mtime - Modification time of the change
	 * @returns The matching token if found, undefined otherwise
	 */
	matchToken(path: string, mtime: number): WriteToken | undefined {
		// Find tokens for this path
		for (const [tokenId, entry] of this.pendingTokens) {
			const { token } = entry
			if (
				token.path === path &&
				mtime >= token.expectedMtimeMin &&
				Date.now() - token.createdAt <= this.tokenExpiryMs
			) {
				// Found a match - clear the token and return it
				this.clearTokenById(tokenId)
				return token
			}
		}

		return undefined
	}

	/**
	 * Manually clear a token (e.g., when write operation completes)
	 */
	clearToken(path: string): void {
		// Find and clear all tokens for this path
		const tokensToRemove: string[] = []
		for (const [tokenId, entry] of this.pendingTokens) {
			if (entry.token.path === path) {
				tokensToRemove.push(tokenId)
			}
		}

		for (const tokenId of tokensToRemove) {
			this.clearTokenById(tokenId)
		}
	}

	/**
	 * Clear a specific token by ID
	 */
	private clearTokenById(tokenId: string): void {
		const entry = this.pendingTokens.get(tokenId)
		if (entry) {
			clearTimeout(entry.expiryTimeout)
			this.pendingTokens.delete(tokenId)
		}
	}

	/**
	 * Expire a token (called by timeout)
	 */
	private expireToken(tokenId: string): void {
		this.clearTokenById(tokenId)
	}

	/**
	 * Get all pending tokens (for debugging/testing)
	 */
	getPendingTokens(): WriteToken[] {
		return Array.from(this.pendingTokens.values()).map((entry) => entry.token)
	}

	/**
	 * Clear all tokens and dispose resources
	 */
	dispose(): void {
		for (const entry of this.pendingTokens.values()) {
			clearTimeout(entry.expiryTimeout)
		}
		this.pendingTokens.clear()
	}
}