/* eslint-disable solid/reactivity */
import { createStore, reconcile } from 'solid-js/store'
import type { PieceTableSnapshot } from '@repo/utils'

export const createPieceTableState = () => {
	const [pieceTables, setPieceTablesStore] = createStore<
		Record<string, PieceTableSnapshot | undefined>
	>({})

	const evictPieceTableEntry = (path: string) => {
		setPieceTablesStore(path, undefined)
	}

	const setPieceTable = (path: string, snapshot?: PieceTableSnapshot) => {
		if (!path) return
		if (!snapshot) {
			evictPieceTableEntry(path)
			return
		}

		setPieceTablesStore(path, snapshot)
	}

	const clearPieceTables = () => {
		setPieceTablesStore(reconcile({}))
	}

	return {
		pieceTables,
		setPieceTable,
		clearPieceTables,
	}
}
