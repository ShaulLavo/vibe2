import type { Component } from 'solid-js'
import { For } from 'solid-js'
import type { SettingsCategory } from './SettingsSidebarItem'
import { SettingsSidebarItem } from './SettingsSidebarItem'
import { SettingsScrollArea } from './SettingsScrollArea'
import { cn } from '../utils'

export type SettingsSidebarProps = {
	categories: SettingsCategory[]
	selectedCategory: string
	onCategorySelect: (categoryId: string) => void
	class?: string
}

export const SettingsSidebar: Component<SettingsSidebarProps> = (props) => {
	return (
		<SettingsScrollArea
			class={cn(
				'h-full min-h-0 bg-background border-r border-border/60',
				props.class
			)}
			contentClass="px-2 py-2 pr-4"
		>
			<nav class="space-y-1">
				<For each={props.categories}>
					{(category) => (
						<SettingsSidebarItem
							category={category}
							selectedCategory={props.selectedCategory}
							onCategorySelect={props.onCategorySelect}
						/>
					)}
				</For>
			</nav>
		</SettingsScrollArea>
	)
}

export type { SettingsCategory, SettingSetting } from './SettingsSidebarItem'
