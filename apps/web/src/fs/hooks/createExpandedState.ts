/* eslint-disable solid/reactivity */
import { makePersisted } from '@solid-primitives/storage'
import { createStore, reconcile } from 'solid-js/store'

export const createExpandedState = () => {
	const [expanded, setExpanded] = makePersisted(
		createStore<Record<string, boolean>>({}),
		{
			name: 'fs-expanded',
		}
	)

	const collapseAll = () => {
		setExpanded(reconcile({}))
	}

	return {
		expanded,
		setExpanded,
		collapseAll,
	}
}
