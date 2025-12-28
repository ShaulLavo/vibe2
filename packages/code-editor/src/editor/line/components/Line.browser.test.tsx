import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-solid'
import { Line } from './Line'

describe('Line', () => {
	it('bails out silently when columnEnd is before columnStart', () => {
		const screen = render(() => (
			<Line
				virtualRow={{
					index: 0,
					start: 0,
					size: 20,
					columnStart: 8,
					columnEnd: 4,
					lineId: 1,
				}}
				lineIndex={0}
				lineText="Hello, world"
				lineHeight={20}
				contentWidth={200}
				charWidth={8}
				tabSize={2}
				isEditable={() => true}
				onPreciseClick={() => {}}
				isActive={false}
			/>
		))

		// Component should render empty when column range is invalid
		expect(screen.container.textContent).toBe('')
	})

	it('renders content when column range is valid', () => {
		const screen = render(() => (
			<Line
				virtualRow={{
					index: 0,
					start: 0,
					size: 20,
					columnStart: 0,
					columnEnd: 12,
					lineId: 1,
				}}
				lineIndex={0}
				lineText="Hello, world"
				lineHeight={20}
				contentWidth={200}
				charWidth={8}
				tabSize={2}
				isEditable={() => true}
				onPreciseClick={() => {}}
				isActive={false}
			/>
		))

		// Component should render the text
		expect(screen.container.textContent).toBe('Hello, world')
	})
})
