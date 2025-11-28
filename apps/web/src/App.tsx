import { createSignal, onMount, type Component } from 'solid-js'
import Comp from './components/Comp'
import { client } from './client'
import { Button } from '@repo/ui/button'
const App: Component = () => {
	const [count, setCount] = createSignal(0)

	onMount(async () => {
		const { data: index } = await client.get()
		console.log({ index })

		const { data: id } = await client.id({ id: 1895 }).get()
		console.log({ id })

		const { data: nendoroid } = await client.mirror.post({
			id: 1895,
			name: 'Skadi'
		})
		console.log({ nendoroid })
	})
	return (
		<>
			<h1 class="text-3xl font-bold underline">Hello world!</h1>
			<Comp />
			<Button onClick={() => setCount(count() + 1)}>Count: {count()}</Button>
		</>
	)
}

export default App
