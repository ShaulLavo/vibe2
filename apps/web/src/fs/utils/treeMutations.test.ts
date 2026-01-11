import { describe, it, expect } from 'vitest'
import {
	addNodeToTree,
	removeNodeFromTree,
	relocateNode,
} from './treeMutations'
import type { FsDirTreeNode, FsFileTreeNode } from '@repo/fs'

const createTestTree = (): FsDirTreeNode => ({
	kind: 'dir',
	name: 'root',
	path: '',
	depth: 0,
	children: [
		{
			kind: 'dir',
			name: 'src',
			path: 'src',
			depth: 1,
			parentPath: '',
			children: [
				{
					kind: 'file',
					name: 'index.ts',
					path: 'src/index.ts',
					depth: 2,
					parentPath: 'src',
				},
				{
					kind: 'file',
					name: 'utils.ts',
					path: 'src/utils.ts',
					depth: 2,
					parentPath: 'src',
				},
			],
		},
		{
			kind: 'dir',
			name: 'tests',
			path: 'tests',
			depth: 1,
			parentPath: '',
			children: [],
		},
		{
			kind: 'file',
			name: 'package.json',
			path: 'package.json',
			depth: 1,
			parentPath: '',
		},
	],
})

const applyMutation = (
	tree: FsDirTreeNode,
	mutation: (tree: FsDirTreeNode) => FsDirTreeNode
): FsDirTreeNode => {
	const clone = structuredClone(tree)
	return mutation(clone)
}

describe('addNodeToTree', () => {
	it('adds a file to the root', () => {
		const tree = createTestTree()
		const newFile: FsFileTreeNode = {
			kind: 'file',
			name: 'README.md',
			path: 'README.md',
			depth: 1,
			parentPath: '',
		}

		const result = applyMutation(tree, addNodeToTree('', newFile))

		expect(result.children).toHaveLength(4)
		expect(result.children.find((c) => c.name === 'README.md')).toBeDefined()
	})

	it('adds a file to a nested directory', () => {
		const tree = createTestTree()
		const newFile: FsFileTreeNode = {
			kind: 'file',
			name: 'helper.ts',
			path: 'src/helper.ts',
			depth: 2,
			parentPath: 'src',
		}

		const result = applyMutation(tree, addNodeToTree('src', newFile))
		const srcDir = result.children.find(
			(c) => c.name === 'src'
		) as FsDirTreeNode

		expect(srcDir.children).toHaveLength(3)
		expect(srcDir.children.find((c) => c.name === 'helper.ts')).toBeDefined()
	})

	it('maintains sorted order (folders first, then alphabetical)', () => {
		const tree = createTestTree()
		const newFolder: FsDirTreeNode = {
			kind: 'dir',
			name: 'components',
			path: 'src/components',
			depth: 2,
			parentPath: 'src',
			children: [],
		}

		const result = applyMutation(tree, addNodeToTree('src', newFolder))
		const srcDir = result.children.find(
			(c) => c.name === 'src'
		) as FsDirTreeNode

		expect(srcDir.children[0]!.name).toBe('components')
		expect(srcDir.children[0]!.kind).toBe('dir')
	})
})

describe('removeNodeFromTree', () => {
	it('removes a file from root', () => {
		const tree = createTestTree()

		const result = applyMutation(tree, removeNodeFromTree('package.json'))

		expect(result.children).toHaveLength(2)
		expect(
			result.children.find((c) => c.name === 'package.json')
		).toBeUndefined()
	})

	it('removes a file from nested directory', () => {
		const tree = createTestTree()

		const result = applyMutation(tree, removeNodeFromTree('src/index.ts'))
		const srcDir = result.children.find(
			(c) => c.name === 'src'
		) as FsDirTreeNode

		expect(srcDir.children).toHaveLength(1)
		expect(srcDir.children.find((c) => c.name === 'index.ts')).toBeUndefined()
	})

	it('removes a folder with children', () => {
		const tree = createTestTree()

		const result = applyMutation(tree, removeNodeFromTree('src'))

		expect(result.children).toHaveLength(2)
		expect(result.children.find((c) => c.name === 'src')).toBeUndefined()
	})
})

describe('relocateNode', () => {
	it('renames a file (same parent)', () => {
		const tree = createTestTree()

		const result = applyMutation(
			tree,
			relocateNode('src/index.ts', 'src/main.ts')
		)
		const srcDir = result.children.find(
			(c) => c.name === 'src'
		) as FsDirTreeNode

		expect(srcDir.children.find((c) => c.name === 'index.ts')).toBeUndefined()
		const mainFile = srcDir.children.find((c) => c.name === 'main.ts')
		expect(mainFile).toBeDefined()
		expect(mainFile?.path).toBe('src/main.ts')
	})

	it('renames a folder and updates descendant paths', () => {
		const tree = createTestTree()

		const result = applyMutation(tree, relocateNode('src', 'source'))

		const sourceDir = result.children.find(
			(c) => c.name === 'source'
		) as FsDirTreeNode
		expect(sourceDir).toBeDefined()
		expect(sourceDir.path).toBe('source')

		const indexFile = sourceDir.children.find((c) => c.name === 'index.ts')
		expect(indexFile?.path).toBe('source/index.ts')
	})

	it('moves a file to different parent', () => {
		const tree = createTestTree()

		const result = applyMutation(
			tree,
			relocateNode('src/utils.ts', 'tests/utils.ts')
		)

		const srcDir = result.children.find(
			(c) => c.name === 'src'
		) as FsDirTreeNode
		expect(srcDir.children.find((c) => c.name === 'utils.ts')).toBeUndefined()

		const testsDir = result.children.find(
			(c) => c.name === 'tests'
		) as FsDirTreeNode
		const movedFile = testsDir.children.find((c) => c.name === 'utils.ts')
		expect(movedFile).toBeDefined()
		expect(movedFile?.path).toBe('tests/utils.ts')
	})
})
