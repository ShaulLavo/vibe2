/* eslint-disable solid/reactivity */
import type { Accessor, JSX } from 'solid-js'
import type { TextEditorLayout } from '../hooks'

type InputProps = {
	inputRef: (element: HTMLTextAreaElement) => void
	layout: Pick<
		TextEditorLayout,
		'inputX' | 'inputY' | 'charWidth' | 'lineHeight'
	>
	isEditable: Accessor<boolean>
	onInput: JSX.EventHandlerUnion<HTMLTextAreaElement, InputEvent>
	onKeyDown: JSX.EventHandlerUnion<HTMLTextAreaElement, KeyboardEvent>
	onKeyUp: JSX.EventHandlerUnion<HTMLTextAreaElement, KeyboardEvent>
}
// TODO input becomes slow on massive files 200,000K lines very noticeable
export const Input = (props: InputProps) => (
	<textarea
		ref={props.inputRef}
		class="absolute opacity-0"
		style={{
			left: `${props.layout.inputX()}px`,
			top: `${props.layout.inputY()}px`,
			width: `${props.layout.charWidth()}px`,
			height: `${props.layout.lineHeight()}px`,
		}}
		onInput={props.onInput}
		onKeyDown={props.onKeyDown}
		onKeyUp={props.onKeyUp}
		disabled={!props.isEditable()}
		autocomplete="off"
		autocorrect="off"
		spellcheck={false}
		autocapitalize="off"
		aria-label="Code editor input"
	/>
)
