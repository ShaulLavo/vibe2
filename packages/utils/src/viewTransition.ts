import { batch } from 'solid-js'

const viewTranstionMock: ViewTransition = {
	finished: Promise.resolve(undefined),
	ready: Promise.resolve(undefined),
	skipTransition: () => {},
	updateCallbackDone: Promise.resolve(undefined),
	types: new Set<string>(),
}

export const viewTransition = (fn: () => void) => {
	if (!document.startViewTransition) {
		fn()
		return viewTranstionMock
	}

	// Disable all CSS transitions during the capture phase
	// This ensures the "new" snapshot captures the final state, not an interpolation
	const style = document.createElement('style')
	style.innerHTML = '* { transition: none !important; }'
	document.head.appendChild(style)

	const transition = document.startViewTransition(fn)

	// Clean up after the "new" snapshot has been taken
	transition.ready.then(() => {
		style.remove()
	})

	return transition
}

export const viewTransitionBatched = (fn: () => void) => {
	return viewTransition(() => batch(fn))
}
