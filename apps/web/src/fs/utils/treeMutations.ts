import type { FsDirTreeNode, FsTreeNode } from '@repo/fs'
import { produce } from 'solid-js/store'
import {
	getParentPath,
	getNodeName,
	sortChildrenInPlace,
	findParentNode,
	updateDescendantPathsInPlace,
	findNodeInTree,
} from './treeHelpers'

export const addNodeToTree = (parentPath: string, node: FsTreeNode) =>
	produce((tree: FsDirTreeNode) => {
		const parent = findParentNode(tree, parentPath)
		if (!parent) return

		parent.children.push(node)
		sortChildrenInPlace(parent.children)
	})

export const removeNodeFromTree = (path: string) =>
	produce((tree: FsDirTreeNode) => {
		if (tree.path === path) return

		const parentPath = getParentPath(path)
		const parent = findParentNode(tree, parentPath)
		if (!parent) return

		const index = parent.children.findIndex((c) => c.path === path)
		if (index !== -1) {
			parent.children.splice(index, 1)
		}
	})

export const relocateNode = (oldPath: string, newPath: string) =>
	produce((tree: FsDirTreeNode) => {
		if (oldPath === newPath) return

		const nodeToMove = findNodeInTree(tree, oldPath)
		if (!nodeToMove) return

		const oldParentPath = getParentPath(oldPath)
		const newParentPath = getParentPath(newPath)
		const newName = getNodeName(newPath)

		updateDescendantPathsInPlace(nodeToMove, oldPath, newPath)
		nodeToMove.name = newName

		if (oldParentPath !== newParentPath) {
			const oldParent = findParentNode(tree, oldParentPath)
			const newParent = findParentNode(tree, newParentPath)
			if (!oldParent || !newParent) return

			const index = oldParent.children.findIndex((c) => c.path === newPath)
			if (index !== -1) {
				oldParent.children.splice(index, 1)
				newParent.children.push(nodeToMove)
				sortChildrenInPlace(newParent.children)
			}
		} else {
			const parent = findParentNode(tree, oldParentPath)
			if (parent) {
				sortChildrenInPlace(parent.children)
			}
		}
	})
