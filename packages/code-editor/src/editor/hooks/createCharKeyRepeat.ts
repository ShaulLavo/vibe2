import { onCleanup } from 'solid-js'
import {
	KEY_REPEAT_INITIAL_DELAY,
	KEY_REPEAT_INITIAL_INTERVAL,
	KEY_REPEAT_MIN_INTERVAL,
	KEY_REPEAT_ACCELERATION_RATE,
	KEY_REPEAT_ACCELERATION_STEPS,
} from '../consts'

// Keys that should never trigger repeat (modifiers, special keys)
const IGNORE_KEYS_REGEX =
	/^(?:Meta|Control|Alt|Shift|CapsLock|NumLock|ScrollLock|ContextMenu|OS|Dead|Unidentified)$/

export type KeyRepeatCallback = (
	key: string,
	ctrlOrMeta: boolean,
	shiftKey: boolean
) => void

export type UnifiedKeyRepeatActions = {
	handleKeyDown: (event: KeyboardEvent) => void
	handleKeyUp: (event: KeyboardEvent) => void
	stop: () => void
	isActive: (key: string) => boolean
}

/**
 * Creates a unified key repeat handler for all keys.
 * Handles key repeat for any key since native repeat may not work
 * reliably on all platforms (e.g., macOS).
 *
 * @param onKey - Function to call with each key event
 * @returns Object with handleKeyDown, handleKeyUp, stop, and isActive methods
 */
export function createUnifiedKeyRepeat(
	onKey: KeyRepeatCallback
): UnifiedKeyRepeatActions {
	let activeKey: string | null = null
	let activeCtrlOrMeta = false
	let activeShiftKey = false
	let repeatTimeout: ReturnType<typeof setTimeout> | null = null
	let repeatCount = 0

	const stop = () => {
		if (repeatTimeout) {
			clearTimeout(repeatTimeout)
			repeatTimeout = null
		}
		activeKey = null
		activeCtrlOrMeta = false
		activeShiftKey = false
		repeatCount = 0
	}

	const handleKeyDown = (event: KeyboardEvent) => {
		const key = event.key

		// Ignore modifier-only keys
		if (IGNORE_KEYS_REGEX.test(key)) {
			return
		}

		// Ignore native repeats - we handle our own
		if (event.repeat) {
			event.preventDefault()
			return
		}

		const ctrlOrMeta = event.ctrlKey || event.metaKey
		const shiftKey = event.shiftKey

		// If a different key is pressed, stop the previous repeat
		if (activeKey !== null && activeKey !== key) {
			stop()
		}

		// If this key is already active, ignore
		if (activeKey === key) {
			return
		}

		activeKey = key
		activeCtrlOrMeta = ctrlOrMeta
		activeShiftKey = shiftKey

		// Emit immediately on first press
		onKey(key, ctrlOrMeta, shiftKey)

		// Start repeat after initial delay
		repeatTimeout = setTimeout(() => {
			let currentInterval = KEY_REPEAT_INITIAL_INTERVAL

			const doRepeat = () => {
				if (activeKey !== key) return

				onKey(key, activeCtrlOrMeta, activeShiftKey)
				repeatCount++

				// Accelerate if not at max speed
				if (repeatCount < KEY_REPEAT_ACCELERATION_STEPS) {
					currentInterval = Math.max(
						KEY_REPEAT_MIN_INTERVAL,
						currentInterval * KEY_REPEAT_ACCELERATION_RATE
					)
				}

				// Schedule next repeat
				repeatTimeout = setTimeout(doRepeat, currentInterval)
			}

			doRepeat()
		}, KEY_REPEAT_INITIAL_DELAY)
	}

	const handleKeyUp = (event: KeyboardEvent) => {
		// Stop repeat when the active key is released
		if (event.key === activeKey) {
			stop()
		}
	}

	const isActive = (key: string): boolean => activeKey === key

	// Cleanup on unmount
	onCleanup(stop)

	return { handleKeyDown, handleKeyUp, stop, isActive }
}
