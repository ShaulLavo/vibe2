import type { VirtualItem, Virtualizer } from '@tanstack/virtual-core'
import type { Accessor } from 'solid-js'
import type { ParseResult } from '~/utils/parse'

export type EditorProps = {
	isFileSelected: Accessor<boolean>
	stats: Accessor<ParseResult | undefined>
	fontSize: Accessor<number>
	fontFamily: Accessor<string>
	previewBytes?: Accessor<Uint8Array | undefined>
}

export type LineEntry = {
	index: number
	start: number
	length: number
	text: string
}

export type VirtualizedRowProps = {
	rowVirtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>
	virtualRow: VirtualItem
	entry: LineEntry
	columns: VirtualItem[]
	totalColumnWidth: number
	lineHeight: number
	onRowClick: (entry: LineEntry) => void
	isActive: boolean
}

export type VirtualizedRowsProps = {
	rows: Accessor<VirtualItem[]>
	columns: Accessor<VirtualItem[]>
	entries: Accessor<LineEntry[]>
	totalColumnWidth: Accessor<number>
	rowVirtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>
	lineHeight: Accessor<number>
	onRowClick: (entry: LineEntry) => void
	activeLineIndex: Accessor<number | null>
}

export type TextFileEditorProps = EditorProps

