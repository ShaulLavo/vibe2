type LoggerToggleEntry =
	| boolean
	| {
			$self?: boolean
			[key: string]: LoggerToggleEntry | undefined
	  }

type LoggerToggleTree = Record<string, LoggerToggleEntry>

const flattenTree = (
	tree: LoggerToggleTree,
	prefix = ''
): Record<string, boolean> => {
	const result: Record<string, boolean> = {}

	for (const [key, value] of Object.entries(tree)) {
		const fullKey = prefix ? `${prefix}:${key}` : key

		if (typeof value === 'boolean') {
			result[fullKey] = value
		} else {
			result[fullKey] = value.$self ?? false
			for (const [childKey, childValue] of Object.entries(value)) {
				if (childKey === '$self') continue
				if (typeof childValue === 'boolean') {
					result[`${fullKey}:${childKey}`] = childValue
				} else if (childValue !== undefined) {
					Object.assign(
						result,
						flattenTree({ [childKey]: childValue }, fullKey)
					)
				}
			}
		}
	}

	return result
}

export { flattenTree }
export type { LoggerToggleEntry, LoggerToggleTree }
