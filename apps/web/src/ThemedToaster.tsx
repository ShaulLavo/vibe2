import { useColorMode } from '@kobalte/core'
import { Toaster } from '@repo/ui/toaster'
import type { Component } from 'solid-js'

export const ThemedToaster: Component = () => {
	const { colorMode } = useColorMode()
	const theme = () => (colorMode() === 'light' ? 'light' : 'dark')
	return <Toaster theme={theme()} />
}
