import { Accessor, createMemo } from 'solid-js'

export type UseTabsOptions = {
	maxTabs?: number
}

const DEFAULT_MAX_TABS = 10

export const useTabs = (
	activePath: Accessor<string | undefined>,
	options?: UseTabsOptions
) => {
	const maxTabs = options?.maxTabs ?? DEFAULT_MAX_TABS
	return createMemo<string[]>((prev) => {
		const previousTabs = prev ?? []
		const path = activePath()
		if (!path) return previousTabs
		if (
			previousTabs.length > 0 &&
			previousTabs[previousTabs.length - 1] === path
		) {
			return previousTabs
		}
		if (previousTabs.includes(path)) {
			return previousTabs
		}
		const next =
			previousTabs.length >= maxTabs ? previousTabs.slice(1) : previousTabs
		return [...next, path]
	}, [])
}
