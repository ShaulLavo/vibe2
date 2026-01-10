import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Tab } from './Tab'

describe('Tab Component - Visual Distinction', () => {
	it('should display view mode indicator for UI mode when multiple modes available', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.json"
				label="file.json"
				viewMode="ui"
				availableViewModes={['editor', 'ui']}
			/>
		))

		// Should show UI indicator
		const indicator = container.querySelector('[title="UI mode"]')
		expect(indicator).toBeTruthy()
		expect(indicator?.textContent).toBe('UI')
	})

	it('should display view mode indicator for binary mode when multiple modes available', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.bin"
				label="file.bin"
				viewMode="binary"
				availableViewModes={['editor', 'binary']}
			/>
		))

		// Should show BIN indicator
		const indicator = container.querySelector('[title="BIN mode"]')
		expect(indicator).toBeTruthy()
		expect(indicator?.textContent).toBe('BIN')
	})

	it('should not display view mode indicator for editor mode', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.txt"
				label="file.txt"
				viewMode="editor"
				availableViewModes={['editor', 'ui']}
			/>
		))

		// Should not show indicator for editor mode
		const indicator = container.querySelector('[title*="mode"]')
		expect(indicator).toBeFalsy()
	})

	it('should not display view mode indicator when only one mode is available', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.txt"
				label="file.txt"
				viewMode="editor"
				availableViewModes={['editor']}
			/>
		))

		// Should not show indicator when only one mode available
		const indicator = container.querySelector('[title*="mode"]')
		expect(indicator).toBeFalsy()
	})

	it('should apply correct styling for UI mode indicator', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.json"
				label="file.json"
				viewMode="ui"
				availableViewModes={['editor', 'ui']}
			/>
		))

		const indicator = container.querySelector('[title="UI mode"]')
		expect(indicator).toBeTruthy()
		expect(indicator?.className).toContain('bg-blue-500/20')
		expect(indicator?.className).toContain('text-blue-400')
		expect(indicator?.className).toContain('border-blue-500/30')
	})

	it('should apply correct styling for binary mode indicator', () => {
		const { container } = render(() => (
			<Tab
				value="/test/file.bin"
				label="file.bin"
				viewMode="binary"
				availableViewModes={['editor', 'binary']}
			/>
		))

		const indicator = container.querySelector('[title="BIN mode"]')
		expect(indicator).toBeTruthy()
		expect(indicator?.className).toContain('bg-orange-500/20')
		expect(indicator?.className).toContain('text-orange-400')
		expect(indicator?.className).toContain('border-orange-500/30')
	})
})