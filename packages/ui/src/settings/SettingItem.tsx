import type { Component } from 'solid-js'
import { Match, Switch } from 'solid-js'
import { SettingCheckbox } from './SettingCheckbox'
import { SettingSelect } from './SettingSelect'
import { SettingInput } from './SettingInput'
import { cn } from '../utils'

export type SettingDefinition = {
	key: string
	type: 'boolean' | 'string' | 'number'
	default: unknown
	description: string
	category: string
	subcategory?: string
	options?: { value: string; label: string }[]
	experimental?: boolean
}

export type SettingItemProps = {
	setting: SettingDefinition
	value: unknown
	onChange: (value: unknown) => void
	class?: string
	customComponents?: Record<string, () => any>
}

export const SettingItem: Component<SettingItemProps> = (props) => {
	// Check if there's a custom component for this setting
	const customComponent = () => props.customComponents?.[props.setting.key]

	return (
		<div class={cn('py-2.5', props.class)}>
			{/* Custom component if available */}
			<Switch>
				<Match when={customComponent()}>{customComponent()!()}</Match>

				<Match when={props.setting.type === 'boolean'}>
					<SettingCheckbox
						checked={Boolean(props.value)}
						onChange={(checked) => props.onChange(checked)}
						label={props.setting.key.split('.').pop() || props.setting.key}
						description={props.setting.description}
					/>
				</Match>

				<Match when={props.setting.type === 'string' && props.setting.options}>
					<SettingSelect
						value={String(props.value || props.setting.default || '')}
						options={props.setting.options || []}
						onChange={(value) => props.onChange(value)}
						label={props.setting.key.split('.').pop() || props.setting.key}
						description={props.setting.description}
					/>
				</Match>

				<Match when={props.setting.type === 'string' && !props.setting.options}>
					<SettingInput
						value={String(props.value || props.setting.default || '')}
						type="text"
						onChange={(value) => props.onChange(value)}
						label={props.setting.key.split('.').pop() || props.setting.key}
						description={props.setting.description}
					/>
				</Match>

				<Match when={props.setting.type === 'number'}>
					<SettingInput
						value={Number(props.value || props.setting.default || 0)}
						type="number"
						onChange={(value) => props.onChange(value)}
						label={props.setting.key.split('.').pop() || props.setting.key}
						description={props.setting.description}
					/>
				</Match>
			</Switch>
		</div>
	)
}
