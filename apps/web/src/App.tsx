import { type Component } from 'solid-js'
import Main from './Main'
import { Toaster } from '@repo/ui/toaster'
import { FsProvider } from './fs/context/FsProvider'
import { FocusProvider } from './focus/focusManager'
const App: Component = () => (
	<FocusProvider>
		<FsProvider>
			<Main />
			<Toaster />
		</FsProvider>
	</FocusProvider>
)

export default App
