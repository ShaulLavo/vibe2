/* eslint-disable solid/reactivity */
import { makePersisted } from '@solid-primitives/storage'
import { createSignal } from 'solid-js'
import { DEFAULT_SOURCE } from '../config/constants'

export const createSelectionState = () => {
	const [selectedPath, setSelectedPath] = makePersisted(
		createSignal<string | undefined>(undefined),
		{
			name: 'fs-selected-path'
		}
	)
	const [activeSource, setActiveSource] = makePersisted(
		createSignal(DEFAULT_SOURCE),
		{
			name: 'fs-active-source'
		}
	)

	return {
		selectedPath,
		setSelectedPath,
		activeSource,
		setActiveSource
	}
}
