export {
	type Timestamped,
	type FreshnessPolicy,
	type FreshnessCheckResult,
	timestamp,
	checkFreshness,
	isStale,
	getAge,
	hasExpired,
	updateValue,
	refresh,
	unwrap,
	FRESHNESS_POLICIES,
} from './FreshnessModel'
