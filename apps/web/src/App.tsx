import { type Component, onCleanup } from 'solid-js'
import Main from './Main'
import { Providers } from './Providers'
import { disposeTreeSitterWorker } from './treeSitter/workerClient'

const App: Component = () => {
	onCleanup(() => {
		void disposeTreeSitterWorker()
	})
	return (
		<Providers>
			<Main />
		</Providers>
	)
}

export default App
