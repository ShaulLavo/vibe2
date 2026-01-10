import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Tabs } from './Tabs'
import type { ViewMode } from '../types/TabIdentity'

describe('Tabs Component - Enhanced Tooltips', () => {
	it('should enhance tooltip with view mode information when multiple modes available', () => {
		const getTooltip = (value: string) => `/path/to/${value}`
		const getViewMode = (value: string): ViewMode => 'ui'
		const getAvailableViewModes = (value: string): ViewMode[] => ['editor', 'ui']

		const { container } = render(() => (
			<Tabs
				values={['settings.json']}
				getTooltip={getTooltip}
				getViewMode={getViewMode}
				getAvailableViewModes={getAvailableViewModes}
			/>
		))

		// Should enhance tooltip with view mode info
		const tab = container.querySelector('[role="tab"]')
		expect(tab?.getAttribute('title')).toBe('/path/to/settings.json (UI mode)')
	})

	it('should use basic tooltip when only one mode is available', () => {
		const getTooltip = (value: string) => `/path/to/${value}`
		const getViewMode = (value: string): ViewMode => 'editor'
		const getAvailableViewModes = (value: string): ViewMode[] => ['editor']

		const { container } = render(() => (
			<Tabs
				values={['file.txt']}
				getTooltip={getTooltip}
				getViewMode={getViewMode}
				getAvailableViewModes={getAvailableViewModes}
			/>
		))

		// Should use basic tooltip without view mode info
		const tab = container.querySelector('[role="tab"]')
		expect(tab?.getAttribute('title')).toBe('/path/to/file.txt')
	})

	it('should use basic tooltip when no view mode functions provided', () => {
		const getTooltip = (value: string) => `/path/to/${value}`

		const { container } = render(() => (
			<Tabs
				values={['file.txt']}
				getTooltip={getTooltip}
			/>
		))

		// Should use basic tooltip
		const tab = container.querySelector('[role="tab"]')
		expect(tab?.getAttribute('title')).toBe('/path/to/file.txt')
	})

	it('should pass view mode information to Tab components', () => {
		const getViewMode = (value: string): ViewMode => 'binary'
		const getAvailableViewModes = (value: string): ViewMode[] => ['editor', 'binary']

		const { container } = render(() => (
			<Tabs
				values={['file.bin']}
				getViewMode={getViewMode}
				getAvailableViewModes={getAvailableViewModes}
			/>
		))

		// Should show binary mode indicator
		const indicator = container.querySelector('[title="BIN mode"]')
		expect(indicator).toBeTruthy()
		expect(indicator?.textContent).toBe('BIN')
	})
})