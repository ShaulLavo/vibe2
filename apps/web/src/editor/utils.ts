import {
	CHAR_WIDTH_RATIO,
	COLUMN_CHARS_PER_ITEM,
	LINE_HEIGHT_RATIO,
	MIN_ESTIMATED_LINE_HEIGHT
} from './consts'

export const estimateLineHeight = (fontSize: number) =>
	Math.max(Math.round(fontSize * LINE_HEIGHT_RATIO), MIN_ESTIMATED_LINE_HEIGHT)

export const estimateColumnWidth = (fontSize: number) =>
	Math.max(fontSize * CHAR_WIDTH_RATIO * COLUMN_CHARS_PER_ITEM, fontSize * 4)

