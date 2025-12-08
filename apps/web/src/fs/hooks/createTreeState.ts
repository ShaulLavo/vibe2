import type { FsDirTreeNode } from '@repo/fs'
import { createStore } from 'solid-js/store'

export const createTreeState = () => {
	const [tree, setTree] = createStore<FsDirTreeNode>(undefined!)

	return {
		tree,
		setTree
	}
}
