import { describe, expect, it } from 'bun:test'
import { createShortcutSequenceMatcher } from './sequenceMatcher'

const baseEvent: KeyboardEvent = {
	key: '',
	code: '',
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	metaKey: false,
	repeat: false
} as KeyboardEvent

function eventFor(key: string, overrides: Partial<KeyboardEvent> = {}) {
	return { ...baseEvent, key, code: key, ...overrides } as KeyboardEvent
}

describe('createShortcutSequenceMatcher', () => {
	it('matches a sequence of shortcuts', () => {
		const matcher = createShortcutSequenceMatcher('["k","m"]')
		expect(matcher.handleEvent(eventFor('k'))).toBe(false)
		expect(matcher.handleEvent(eventFor('m'))).toBe(true)
	})

	it('resets when sequence breaks', () => {
		const matcher = createShortcutSequenceMatcher('["k","m"]')
		matcher.handleEvent(eventFor('k'))
		matcher.handleEvent(eventFor('x'))
		expect(matcher.handleEvent(eventFor('m'))).toBe(false)
	})
})
