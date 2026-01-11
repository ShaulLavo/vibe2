/**
 * Font Family Select Component
 *
 * Uses the resource-based font registry with Suspense support.
 * Shows font previews for installed fonts.
 */

import type { Component } from 'solid-js'
import { createMemo, Show, Suspense } from 'solid-js'
import { Label } from '@repo/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@repo/ui/select'
import { cn } from '@repo/ui/utils'
import { useFontRegistry, FontSource } from '../../fonts'
import type { FontOption, FontCategoryType } from '../../fonts'

export type FontFamilySelectProps = {
	value: string
	onChange: (value: string) => void
	label: string
	description?: string
	class?: string
	/** Filter fonts by category (mono, sans, serif) */
	category?: FontCategoryType
}

export const FontFamilySelect: Component<FontFamilySelectProps> = (props) => {
	return (
		<div class={cn('space-y-1', props.class)}>
			<Label>{props.label}</Label>
			{props.description && (
				<p class="text-ui text-muted-foreground">{props.description}</p>
			)}
			<Suspense
				fallback={
					<div class="h-8 bg-muted rounded animate-pulse border border-border/60" />
				}
			>
				<FontFamilySelectInner
					value={props.value}
					onChange={props.onChange}
					category={props.category}
				/>
			</Suspense>
		</div>
	)
}

type FontFamilySelectInnerProps = {
	value: string
	onChange: (value: string) => void
	category?: FontCategoryType
}

const FontFamilySelectInner: Component<FontFamilySelectInnerProps> = (
	props
) => {
	const registry = useFontRegistry()

	// Get font options - this reads from resources, optionally filtered by category
	const fontOptions = createMemo(() => registry.getFontOptions(props.category))

	const selectedOption = createMemo(() =>
		fontOptions().find((o) => o.value === props.value)
	)

	return (
		<Select
			value={selectedOption()}
			onChange={(val) => val && props.onChange(val.value)}
			options={fontOptions()}
			optionValue="value"
			optionTextValue="label"
			itemComponent={(itemProps) => {
				const option = () => itemProps.item.rawValue as FontOption
				const showSourceBadge = () => option().source !== FontSource.BUNDLED
				const previewText = 'The quick brown fox 123'

				return (
					<SelectItem
						item={itemProps.item}
						class="focus:bg-foreground/5 focus:text-foreground py-2"
					>
						<div class="flex flex-col gap-1 w-full">
							<div class="flex items-center justify-between">
								<span class="text-ui font-medium">{option().label}</span>
								<Show when={showSourceBadge()}>
									<span class="text-ui-xs text-muted-foreground capitalize">
										{option().source}
									</span>
								</Show>
							</div>
							<Show when={option().isAvailable}>
								<div
									class="text-ui-xs text-muted-foreground truncate"
									style={{ 'font-family': option().value }}
								>
									{previewText}
								</div>
							</Show>
						</div>
					</SelectItem>
				)
			}}
		>
			<SelectTrigger class="h-8 py-1 focus:ring-0 focus:ring-offset-0 border-border/60">
				<SelectValue<FontOption>>
					{(state) => {
						const option = state.selectedOption()
						if (!option) return 'Select font...'

						return (
							<div class="flex items-center gap-2">
								<span class="text-ui">{option.label}</span>
								<Show when={option.isAvailable}>
									<span
										class="text-ui-xs text-muted-foreground"
										style={{ 'font-family': option.value }}
									>
										Aa
									</span>
								</Show>
							</div>
						)
					}}
				</SelectValue>
			</SelectTrigger>
			<SelectContent />
		</Select>
	)
}
