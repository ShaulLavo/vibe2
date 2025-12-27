import type { Component } from 'solid-js'
import { StatusBar } from './components/StatusBar'
import { Terminal } from './components/Terminal'
import { Resizable } from './components/Resizable'
import { Fs } from './fs/components/Fs'

const Main: Component = () => {
	return (
		<main class="h-screen max-h-screen overflow-hidden bg-background text-foreground">
			<div class="flex h-full min-h-0 flex-col">
				<Resizable
					orientation="vertical"
					storageKey="main-vertical-panel-size"
					defaultSizes={[0.65, 0.35]}
					class="flex flex-1 min-h-0 flex-col"
					minSize={0.01}
					handleAriaLabel="Resize editor and terminal"
				>
					<Fs />
					<Terminal />
				</Resizable>
				<StatusBar />
			</div>
		</main>
	)
}

export default Main
