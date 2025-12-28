import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-solid'
import { CursorProvider } from '../../cursor'
import { LineRow } from './LineRow'

describe('LineRow', () => {
	it('renders nothing silently when the line index is invalid', () => {
		const screen = render(() => (
			<CursorProvider
				filePath={() => 'test.ts'}
				isFileSelected={() => true}
				content={() => 'hello'}
				pieceTable={() => undefined}
			>
				<LineRow
					virtualRow={{
						index: 3,
						start: 0,
						size: 20,
						columnStart: 0,
						columnEnd: 4,
						lineId: 4,
					}}
					lineHeight={() => 20}
					contentWidth={() => 200}
					charWidth={() => 8}
					tabSize={() => 2}
					isEditable={() => true}
					onPreciseClick={() => {}}
					activeLineIndex={() => null}
					getLineBracketDepths={() => undefined}
					getLineHighlights={() => undefined}
				/>
			</CursorProvider>
		))

		// Component should render empty when line index is out of range
		expect(screen.container.textContent).toBe('')
	})

	it('renders line content when index is valid', () => {
		const screen = render(() => (
			<CursorProvider
				filePath={() => 'test.ts'}
				isFileSelected={() => true}
				content={() => 'hello'}
				pieceTable={() => undefined}
			>
				<LineRow
					virtualRow={{
						index: 0,
						start: 0,
						size: 20,
						columnStart: 0,
						columnEnd: 5,
						lineId: 1,
					}}
					lineHeight={() => 20}
					contentWidth={() => 200}
					charWidth={() => 8}
					tabSize={() => 2}
					isEditable={() => true}
					onPreciseClick={() => {}}
					activeLineIndex={() => null}
					getLineBracketDepths={() => undefined}
					getLineHighlights={() => undefined}
				/>
			</CursorProvider>
		))

		// Component should render the line text "hello"
		expect(screen.container.textContent).toBe('hello')
	})
})
