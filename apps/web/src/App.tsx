import { type Component, onMount } from 'solid-js'
import Main from './Main'
import { Providers } from './Providers'
import { pingServerRoutes } from '~/serverRoutesProbe'

const App: Component = () => {
	onMount(() => {
		void pingServerRoutes()
	})
	return (
		<Providers>
			<Main />
		</Providers>
	)
}

export default App
