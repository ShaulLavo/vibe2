import { createContext, useContext, type JSX } from 'solid-js'
import {
	createSettingsStore,
	type SettingsStore,
} from './store/createSettingsStore'

const SettingsContext = createContext<SettingsStore>()

export type SettingsProviderProps = {
	children: JSX.Element
}

export function SettingsProvider(props: SettingsProviderProps) {
	const store = createSettingsStore()

	return (
		<SettingsContext.Provider value={store}>
			{props.children}
		</SettingsContext.Provider>
	)
}

export function useSettings(): SettingsStore {
	const context = useContext(SettingsContext)
	if (!context) {
		throw new Error('useSettings must be used within a SettingsProvider')
	}
	return context
}
