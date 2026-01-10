import { Show } from 'solid-js'
import { Flex } from '@repo/ui/flex'
import { Badge } from '@repo/ui/badge'

type HeaderProps = {
	selectedTable: string | null
	hasRowId: boolean
	primaryKeys: string[]
}

export const Header = (props: HeaderProps) => {
	return (
		<Flex
			class="h-14 border-b border-border px-6 bg-card"
			justifyContent="between"
		>
			<Flex justifyContent="start" class="gap-4">
				<h2 class="text-sm font-medium text-foreground">
					{props.selectedTable ? (
						<span class="flex items-center gap-2">
							<span class="text-muted-foreground">Table:</span>
							<span class="text-primary">{props.selectedTable}</span>
							<Show when={props.hasRowId}>
								<Badge
									round
									class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
								>
									ROWID
								</Badge>
							</Show>
							<Show when={props.primaryKeys.length > 0}>
								<Badge
									round
									class="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
								>
									PK: {props.primaryKeys.join(', ')}
								</Badge>
							</Show>
						</span>
					) : (
						<span class="text-muted-foreground">Dashboard</span>
					)}
				</h2>
			</Flex>
			<Flex justifyContent="start" class="gap-2" />
		</Flex>
	)
}
