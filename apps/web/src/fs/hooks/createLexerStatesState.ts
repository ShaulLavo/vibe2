import { createStore, reconcile } from 'solid-js/store'
import type { LineStartState } from '@repo/code-editor'

export const createLexerStatesState = () => {
	const [fileLexerStates, setLexerStatesStore] = createStore<
		Record<string, LineStartState[] | undefined>
	>({})

	const setLexerLineStates = (path: string, states?: LineStartState[]) => {
		if (!path) return
		if (!states?.length) {
			setLexerStatesStore(path, undefined)
			return
		}

		setLexerStatesStore(path, states)
	}

	const clearLexerStates = () => {
		setLexerStatesStore(reconcile({}))
	}

	return {
		fileLexerStates,
		setLexerLineStates,
		clearLexerStates,
	}
}
