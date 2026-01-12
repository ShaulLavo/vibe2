/**
 * Freshness Model
 *
 * Every piece of data in the system carries freshness metadata.
 * This allows consumers to know how stale data is and make
 * informed decisions about whether to refetch.
 */

/**
 * Wrapper type that adds freshness metadata to any value.
 */
export interface Timestamped<T> {
	/** The wrapped value */
	readonly value: T
	/** When this value was fetched/created (Unix timestamp in ms) */
	readonly fetchedAt: number
	/** Optional explicit expiry time (Unix timestamp in ms) */
	readonly validUntil?: number
}

/**
 * Create a timestamped value with current time.
 */
export function timestamp<T>(value: T, validUntil?: number): Timestamped<T> {
	return {
		value,
		fetchedAt: Date.now(),
		validUntil,
	}
}

/**
 * Policy for determining if data is fresh enough.
 */
export interface FreshnessPolicy {
	/** Maximum acceptable staleness in milliseconds */
	readonly maxAge: number
	/** Whether to trigger background refetch when stale */
	readonly preferFresh: boolean
}

/**
 * Default freshness policies for different data types.
 */
export const FRESHNESS_POLICIES = {
	/** Disk content - should be as fresh as observer allows */
	diskContent: { maxAge: 500, preferFresh: true } as FreshnessPolicy,

	/** Syntax highlights - expensive to compute, ok if slightly stale */
	highlights: { maxAge: 60_000, preferFresh: false } as FreshnessPolicy,

	/** Scroll position - user preference, never stale */
	scrollPosition: { maxAge: Infinity, preferFresh: false } as FreshnessPolicy,

	/** Visible content snapshot - view state, never stale */
	visibleContent: { maxAge: Infinity, preferFresh: false } as FreshnessPolicy,

	/** File stats/metadata - should be reasonably fresh */
	stats: { maxAge: 5_000, preferFresh: true } as FreshnessPolicy,

	/** Fold ranges - derived from tree-sitter, ok if stale */
	folds: { maxAge: 60_000, preferFresh: false } as FreshnessPolicy,

	/** Bracket info - derived from tree-sitter, ok if stale */
	brackets: { maxAge: 60_000, preferFresh: false } as FreshnessPolicy,

	/** Tree-sitter errors - should update reasonably quickly */
	errors: { maxAge: 5_000, preferFresh: true } as FreshnessPolicy,
} as const

/**
 * Result of a freshness check.
 */
export interface FreshnessCheckResult {
	/** Whether the data is still fresh according to the policy */
	readonly isFresh: boolean
	/** Age of the data in milliseconds */
	readonly ageMs: number
	/** Whether a background refresh should be triggered */
	readonly shouldRefresh: boolean
}

/**
 * Check if a timestamped value is fresh according to a policy.
 */
export function checkFreshness<T>(
	data: Timestamped<T> | null | undefined,
	policy: FreshnessPolicy
): FreshnessCheckResult {
	if (!data) {
		return {
			isFresh: false,
			ageMs: Infinity,
			shouldRefresh: policy.preferFresh,
		}
	}

	const now = Date.now()
	const ageMs = now - data.fetchedAt

	// Check explicit expiry first
	if (data.validUntil !== undefined && now > data.validUntil) {
		return {
			isFresh: false,
			ageMs,
			shouldRefresh: policy.preferFresh,
		}
	}

	const isFresh = ageMs <= policy.maxAge
	const shouldRefresh = !isFresh && policy.preferFresh

	return { isFresh, ageMs, shouldRefresh }
}

/**
 * Check if data is stale (convenience function).
 */
export function isStale<T>(
	data: Timestamped<T> | null | undefined,
	policy: FreshnessPolicy
): boolean {
	return !checkFreshness(data, policy).isFresh
}

/**
 * Get the age of timestamped data in milliseconds.
 */
export function getAge<T>(data: Timestamped<T>): number {
	return Date.now() - data.fetchedAt
}

/**
 * Check if data has expired (explicit expiry).
 */
export function hasExpired<T>(data: Timestamped<T>): boolean {
	if (data.validUntil === undefined) return false
	return Date.now() > data.validUntil
}

/**
 * Update the value while keeping the same timestamp.
 * Use this when transforming data without refetching.
 */
export function updateValue<T, U>(
	data: Timestamped<T>,
	transform: (value: T) => U
): Timestamped<U> {
	return {
		value: transform(data.value),
		fetchedAt: data.fetchedAt,
		validUntil: data.validUntil,
	}
}

/**
 * Refresh a timestamped value with new content.
 * Updates the fetchedAt timestamp.
 */
export function refresh<T>(
	data: Timestamped<T>,
	newValue: T,
	validUntil?: number
): Timestamped<T> {
	return {
		value: newValue,
		fetchedAt: Date.now(),
		validUntil,
	}
}

/**
 * Extract the raw value from timestamped data.
 * Returns undefined if data is null/undefined.
 */
export function unwrap<T>(data: Timestamped<T> | null | undefined): T | undefined {
	return data?.value
}
