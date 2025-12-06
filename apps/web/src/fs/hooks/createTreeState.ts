/* eslint-disable solid/reactivity */
import type { FsDirTreeNode } from '@repo/fs'
import { makePersisted } from '@solid-primitives/storage'
import localforage from 'localforage'
import { createStore, unwrap } from 'solid-js/store'

export const createTreeState = () => {
	const [tree, setTree, isTreeReady] = makePersisted(
		createStore<FsDirTreeNode>(undefined!),
		{
			name: 'fs-tree',
			storage: localforage,
			serialize: value => unwrap(value) as unknown as string,
			deserialize: value => value as unknown as FsDirTreeNode
		}
	)
	const hydration = Promise.allSettled([isTreeReady]).then(() => undefined)

	return {
		tree,
		setTree,
		hydration
	}
}
