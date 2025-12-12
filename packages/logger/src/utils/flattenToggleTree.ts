type LoggerToggleEntry =
	| boolean
	| {
			$self?: boolean
			[key: string]: LoggerToggleEntry | undefined
	  }

type LoggerToggleTree = Record<string, LoggerToggleEntry>

const flattenNode = (
	currentKey: string,
	node: LoggerToggleEntry,
	acc: Map<string, boolean>
) => {
	if (
		typeof node === 'undefined' ||
		node === null ||
		(typeof node !== 'boolean' && typeof node !== 'object')
	) {
		return
	}

	if (typeof node === 'boolean') {
		acc.set(currentKey, node)
		return
	}

	const selfValue = typeof node.$self === 'boolean' ? node.$self : false
	acc.set(currentKey, selfValue)

	for (const [childKey, childValue] of Object.entries(node)) {
		if (childKey === '$self') continue
		const nextKey = `${currentKey}:${childKey}`
		flattenNode(nextKey, childValue as LoggerToggleEntry, acc)
	}
}

const flattenTreeToMap = (
	tree: LoggerToggleTree,
	prefix = ''
): Map<string, boolean> => {
	const result = new Map<string, boolean>()

	for (const [key, value] of Object.entries(tree ?? {})) {
		if (typeof value === 'undefined') continue
		const fullKey = prefix ? `${prefix}:${key}` : key
		flattenNode(fullKey, value, result)
	}

	return result
}

const flattenTree = (
	tree: LoggerToggleTree,
	prefix = ''
): Record<string, boolean> => Object.fromEntries(flattenTreeToMap(tree, prefix))

export { flattenTree, flattenTreeToMap }
export type { LoggerToggleEntry, LoggerToggleTree }
