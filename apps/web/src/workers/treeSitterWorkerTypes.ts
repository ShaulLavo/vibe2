export type TreeSitterCapture = {
	startIndex: number
	endIndex: number
	captureName: string
}

export type TreeSitterWorkerApi = {
	init(): Promise<void>
	parse(source: string): Promise<TreeSitterCapture[] | undefined>
	parseBuffer(payload: {
		path: string
		buffer: ArrayBuffer
	}): Promise<TreeSitterCapture[] | undefined>
	applyEdit(payload: TreeSitterEditPayload): Promise<TreeSitterCapture[] | undefined>
	dispose(): Promise<void>
}

export type TreeSitterPoint = {
	row: number
	column: number
}

export type TreeSitterEditPayload = {
	path: string
	startIndex: number
	oldEndIndex: number
	newEndIndex: number
	startPosition: TreeSitterPoint
	oldEndPosition: TreeSitterPoint
	newEndPosition: TreeSitterPoint
	insertedText: string
}
