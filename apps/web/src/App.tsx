import { type Component, onMount } from 'solid-js'
import {
	ColorModeProvider,
	ColorModeScript,
	createLocalStorageManager
} from '@kobalte/core'
import Main from './Main'
import { Toaster } from '@repo/ui/toaster'
import { FsProvider } from './fs/context/FsProvider'
import { FocusProvider } from './focus/focusManager'
import { pingServerRoutes } from '~/serverRoutesProbe'

const storageManager = createLocalStorageManager('vite-ui-theme')
const App: Component = () => {
	onMount(() => {
		void pingServerRoutes()
	})

	return (
		<>
			<ColorModeScript storageType={storageManager.type} />
			<ColorModeProvider storageManager={storageManager}>
				<FocusProvider>
					<FsProvider>
						<Main />
						<Toaster />
					</FsProvider>
				</FocusProvider>
			</ColorModeProvider>
		</>
	)
}

export default App
