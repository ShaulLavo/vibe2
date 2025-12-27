import { Accessor, createEffect, createSignal } from 'solid-js'

export type UseTabsOptions = {
	maxTabs?: number
	storageKey?: string
}

const DEFAULT_MAX_TABS = 10
const DEFAULT_STORAGE_KEY = 'fs-open-tabs'

const loadTabs = (key: string): string[] => {
	try {
		const stored = localStorage.getItem(key)
		if (stored) {
			const parsed = JSON.parse(stored)
			if (Array.isArray(parsed)) {
				return parsed.filter((item): item is string => typeof item === 'string')
			}
		}
	} catch {
		// ignore
	}
	return []
}

const saveTabs = (key: string, tabs: string[]): void => {
	try {
		localStorage.setItem(key, JSON.stringify(tabs))
	} catch {
		// ignore
	}
}

export const useTabs = (
	activePath: Accessor<string | undefined>,
	options?: UseTabsOptions
) => {
	const maxTabs = options?.maxTabs ?? DEFAULT_MAX_TABS
	const storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY
	
	const [tabs, setTabs] = createSignal<string[]>(loadTabs(storageKey))

	createEffect(() => {
		const path = activePath()
		if (!path) return
		
		setTabs((prev) => {
			if (prev.length > 0 && prev[prev.length - 1] === path) {
				return prev
			}
			if (prev.includes(path)) {
				return prev
			}
			const next = prev.length >= maxTabs ? prev.slice(1) : prev
			return [...next, path]
		})
	})

	createEffect(() => {
		saveTabs(storageKey, tabs())
	})

	return tabs
}
