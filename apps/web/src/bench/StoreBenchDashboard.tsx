import {
	For,
	Show,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	type Component,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { formatNumber, runStoreBenchmarks } from './runStoreBenchmarks'
import {
	subscribeStoreBenchEvents,
	type StoreBenchEvent,
} from './storeBenchEvents'
import type {
	BenchProgressKind,
	BenchScenario,
	BenchScenarioResult,
} from './types'
import { formatBytes } from '@repo/utils'
import { Card } from '@repo/ui/card'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@repo/ui/table'
import { Badge } from '@repo/ui/badge'
import {
	createSolidTable,
	getCoreRowModel,
	flexRender,
	type ColumnDef,
	type CellContext,
} from '@tanstack/solid-table'

type BenchStatus = 'idle' | 'running' | 'completed' | 'skipped' | 'error'
type ScenarioStatus = 'queued' | 'running' | 'complete'

type ScenarioState = {
	scenario: BenchScenario
	status: ScenarioStatus
	results: BenchScenarioResult[]
	durationMs?: number
}

type BenchLogEntry = {
	id: number
	timestamp: number
	message: string
	kind: BenchProgressKind | 'info' | 'error'
	scenarioName?: string
	adapter?: string
}

const formatDuration = (ms: number | undefined) => {
	if (ms == null || Number.isNaN(ms)) return '0.00s'
	return `${(ms / 1000).toFixed(2)}s`
}

const formatCount = (value?: number) =>
	value == null ? '…' : value.toLocaleString('en-US')

const describeScenario = (scenario: BenchScenario) => {
	if (scenario.category === 'raw-binary') {
		const chunkBytes = scenario.chunkBytes ?? scenario.valueBytes
		const operations = scenario.operations ?? scenario.items
		return `${formatCount(operations)} ops • ${formatBytes(chunkBytes)} chunk • random offsets`
	}
	const parts = [
		`${formatCount(scenario.items)} items`,
		`${formatBytes(scenario.valueBytes)} value`,
		scenario.order,
	]
	if (scenario.valueKind === 'arrayBuffer') {
		parts.push('ArrayBuffer')
	}
	return parts.join(' • ')
}

const scenarioStatusLabel: Record<ScenarioStatus, string> = {
	queued: 'Queued',
	running: 'Running',
	complete: 'Complete',
}

const scenarioStatusClass: Record<ScenarioStatus, string> = {
	queued: 'text-muted-foreground',
	running: 'text-amber-500 dark:text-amber-300',
	complete: 'text-emerald-500 dark:text-emerald-300',
}

const logKindClass: Record<BenchLogEntry['kind'], string> = {
	'run-start': 'text-sky-500 dark:text-sky-300',
	'run-complete': 'text-emerald-500 dark:text-emerald-300',
	'scenario-start': 'text-amber-500 dark:text-amber-300',
	'scenario-complete': 'text-emerald-500 dark:text-emerald-300',
	'adapter-start': 'text-sky-500 dark:text-sky-300',
	'adapter-complete': 'text-emerald-500 dark:text-emerald-200',
	info: 'text-muted-foreground',
	error: 'text-destructive',
}

const statusLabel: Record<BenchStatus, string> = {
	idle: 'Preparing worker…',
	running: 'Running benchmarks',
	completed: 'Completed',
	skipped: 'Skipped',
	error: 'Failed',
}

const statusBadgeClass: Record<BenchStatus, string> = {
	idle: 'bg-muted text-muted-foreground ring-1 ring-border',
	running:
		'bg-amber-500/10 text-amber-700 dark:text-amber-200 ring-1 ring-amber-500/40 animate-pulse',
	completed:
		'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-500/40',
	skipped: 'bg-muted text-muted-foreground ring-1 ring-border',
	error: 'bg-destructive/10 text-destructive ring-1 ring-destructive/40',
}

const BenchResultsTable = (props: {
	results: BenchScenarioResult[]
	winner: string | null
}) => {
	const columns = createMemo<ColumnDef<BenchScenarioResult>[]>(() => [
		{
			accessorKey: 'store',
			header: 'Store',
			cell: (info: CellContext<BenchScenarioResult, unknown>) => (
				<span class="font-medium">{info.getValue() as string}</span>
			),
		},
		{
			accessorKey: 'writeMs',
			header: 'Write',
			cell: (info: CellContext<BenchScenarioResult, unknown>) => (
				<span class="font-mono text-xs">
					{formatNumber(info.getValue() as number)} ms
				</span>
			),
		},
		{
			accessorKey: 'readMs',
			header: 'Read',
			cell: (info: CellContext<BenchScenarioResult, unknown>) => (
				<span class="font-mono text-xs">
					{formatNumber(info.getValue() as number)} ms
				</span>
			),
		},
		{
			accessorKey: 'removeMs',
			header: 'Remove',
			cell: (info: CellContext<BenchScenarioResult, unknown>) => (
				<span class="font-mono text-xs">
					{formatNumber(info.getValue() as number)} ms
				</span>
			),
		},
		{
			accessorKey: 'totalMs',
			header: 'Total',
			cell: (info: CellContext<BenchScenarioResult, unknown>) => (
				<span class="font-mono text-xs font-semibold">
					{formatNumber(info.getValue() as number)} ms
				</span>
			),
		},
	])

	const table = createSolidTable({
		get data() {
			return props.results
		},
		get columns() {
			return columns()
		},
		getCoreRowModel: getCoreRowModel(),
	})

	return (
		<Table class="text-left text-sm text-foreground">
			<TableHeader>
				<For each={table.getHeaderGroups()}>
					{(headerGroup) => (
						<TableRow class="text-xs uppercase tracking-wide text-muted-foreground">
							<For each={headerGroup.headers}>
								{(header) => (
									<TableHead class="pb-2 font-medium">
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext()
												)}
									</TableHead>
								)}
							</For>
						</TableRow>
					)}
				</For>
			</TableHeader>
			<TableBody>
				<For each={table.getRowModel().rows}>
					{(row) => {
						const isWinner = props.winner === row.original.store
						return (
							<TableRow
								class={`text-sm ${
									isWinner
										? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-100 hover:bg-emerald-500/20'
										: 'text-foreground hover:bg-muted/50'
								}`}
							>
								<For each={row.getVisibleCells()}>
									{(cell) => (
										<TableCell class="py-1">
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									)}
								</For>
							</TableRow>
						)
					}}
				</For>
			</TableBody>
		</Table>
	)
}

export const StoreBenchDashboard: Component = () => {
	const [status, setStatus] = createSignal<BenchStatus>('idle')
	const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
	const [scenarioOrder, setScenarioOrder] = createSignal<string[]>([])
	const [currentScenario, setCurrentScenario] = createSignal<string | null>(
		null
	)
	const [scenarios, setScenarios] = createStore<Record<string, ScenarioState>>(
		{}
	)
	const [logs, setLogs] = createSignal<BenchLogEntry[]>([])
	const [elapsedMs, setElapsedMs] = createSignal(0)
	const [startedAt, setStartedAt] = createSignal<number | null>(null)
	const [finishedAt, setFinishedAt] = createSignal<number | null>(null)

	let timerId: number | undefined
	let nextLogId = 0
	let unsubscribe: (() => void) | undefined
	onMount(() => {
		void runStoreBenchmarks()
	})
	const scenarioEntries = createMemo(() =>
		scenarioOrder()
			.map((name) => scenarios[name])
			.filter((entry): entry is ScenarioState => Boolean(entry))
	)

	const completedCount = createMemo(
		() =>
			scenarioEntries().filter((entry) => entry.status === 'complete').length
	)

	const totalElapsedMs = createMemo(() => {
		if (startedAt() != null && finishedAt() != null) {
			return finishedAt()! - startedAt()!
		}
		return elapsedMs()
	})

	const startTimer = (startTime: number) => {
		if (timerId != null) {
			window.clearInterval(timerId)
		}
		setStartedAt(startTime)
		setFinishedAt(null)
		setElapsedMs(Math.max(0, Date.now() - startTime))
		timerId = window.setInterval(() => {
			setElapsedMs(Math.max(0, Date.now() - startTime))
		}, 100)
	}

	const stopTimer = (finishTime?: number) => {
		if (timerId != null) {
			window.clearInterval(timerId)
			timerId = undefined
		}
		if (startedAt() != null) {
			const end = finishTime ?? Date.now()
			setElapsedMs(Math.max(0, end - (startedAt() ?? 0)))
			setFinishedAt(end)
		}
	}

	const pushLog = (
		message: string,
		kind: BenchLogEntry['kind'],
		timestamp: number,
		scenarioName?: string,
		adapter?: string
	) => {
		setLogs((current) => {
			const next = [
				...current,
				{
					id: nextLogId++,
					timestamp,
					message,
					kind,
					scenarioName,
					adapter,
				},
			]
			if (next.length > 200) {
				return next.slice(next.length - 200)
			}
			return next
		})
	}

	const updateScenarioState = (
		scenario: BenchScenario,
		updates: Partial<Omit<ScenarioState, 'scenario'>> = {}
	) => {
		setScenarios(scenario.name, (prev) => {
			const next: ScenarioState = {
				scenario: prev?.scenario ?? scenario,
				status: prev?.status ?? 'queued',
				results: prev?.results ?? [],
				durationMs: prev?.durationMs,
			}
			if (updates.status) next.status = updates.status
			if (updates.results !== undefined) next.results = updates.results
			if (updates.durationMs != null) next.durationMs = updates.durationMs
			return next
		})
	}

	const resetDashboardState = () => {
		if (timerId != null) {
			window.clearInterval(timerId)
			timerId = undefined
		}
		nextLogId = 0
		setStatus('idle')
		setErrorMessage(null)
		setScenarioOrder([])
		setCurrentScenario(null)
		setLogs([])
		setElapsedMs(0)
		setStartedAt(null)
		setFinishedAt(null)
		setScenarios(() => ({}) as Record<string, ScenarioState>)
	}

	const handleEvent = (event: StoreBenchEvent) => {
		switch (event.type) {
			case 'reset':
				resetDashboardState()
				break
			case 'manifest': {
				const manifest = event.payload.scenarios
				setScenarioOrder(() => manifest.map((item) => item.name))
				for (const scenario of manifest) {
					updateScenarioState(scenario, { status: 'queued', results: [] })
				}
				pushLog(
					`Loaded ${manifest.length} scenario${
						manifest.length === 1 ? '' : 's'
					}`,
					'info',
					event.timestamp
				)
				break
			}
			case 'progress': {
				const payload = event.payload
				pushLog(
					payload.message,
					payload.kind,
					event.timestamp,
					payload.scenario?.name,
					payload.adapter
				)
				if (payload.kind === 'run-start') {
					setStatus('running')
					startTimer(event.timestamp)
				}
				if (payload.kind === 'scenario-start' && payload.scenario) {
					updateScenarioState(payload.scenario, { status: 'running' })
					setCurrentScenario(payload.scenario.name)
				}
				if (payload.kind === 'scenario-complete') {
					setCurrentScenario(null)
				}
				if (payload.kind === 'run-complete') {
					setCurrentScenario(null)
					stopTimer(event.timestamp)
				}
				break
			}
			case 'scenario-complete':
				updateScenarioState(event.payload.scenario, {
					status: 'complete',
					results: event.payload.results,
					durationMs: event.payload.durationMs,
				})
				break
			case 'results':
				setStatus('completed')
				stopTimer(event.timestamp)
				pushLog(
					`Benchmarks finished (${event.payload.length} scenario${
						event.payload.length === 1 ? '' : 's'
					})`,
					'info',
					event.timestamp
				)
				break
			case 'skipped': {
				const message = event.reason ?? 'no available adapters'
				setStatus('skipped')
				stopTimer(event.timestamp)
				setErrorMessage(message)
				pushLog(`[skipped] ${message}`, 'info', event.timestamp)
				break
			}
			case 'error':
				setStatus('error')
				stopTimer(event.timestamp)
				setErrorMessage(event.error.message)
				pushLog(event.error.message, 'error', event.timestamp)
				break
		}
	}

	onMount(() => {
		unsubscribe = subscribeStoreBenchEvents(handleEvent)
	})

	onCleanup(() => {
		if (timerId != null) window.clearInterval(timerId)
		unsubscribe?.()
	})

	return (
		<div class="min-h-screen bg-background px-6 py-8 text-foreground">
			<div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
				<Card class="rounded-2xl p-6">
					<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<p class="text-sm uppercase tracking-[0.2em] text-muted-foreground">
								Virtual FS store benchmark
							</p>
							<h1 class="mt-2 text-3xl font-semibold text-card-foreground">
								Storage adapter shootout
							</h1>
							<p class="mt-1 text-sm text-muted-foreground">
								Comparing OPFS async/sync + IndexedDB adapters with multiple
								scenarios.
							</p>
							<p class="text-xs uppercase tracking-[0.2em] text-muted-foreground">
								{completedCount()} / {scenarioEntries().length || '…'} scenarios
								done
							</p>
						</div>
						<div class="flex flex-col items-end gap-2 text-right">
							<div class="flex items-center gap-3 text-sm text-muted-foreground">
								<div class="flex items-center gap-2 font-mono text-lg text-foreground">
									<Show when={status() === 'running'}>
										<span class="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
									</Show>
									{formatDuration(totalElapsedMs())}
								</div>
								<Badge
									round
									class={`px-3 py-1 font-medium ${statusBadgeClass[status()]}`}
								>
									{statusLabel[status()]}
								</Badge>
							</div>
							<Show when={currentScenario()}>
								<p class="text-sm text-amber-200">
									Running scenario {currentScenario()}
								</p>
							</Show>
							<Show when={errorMessage()}>
								<p class="text-sm text-rose-300">{errorMessage()}</p>
							</Show>
						</div>
					</div>
				</Card>

				<section class="grid gap-4 md:grid-cols-2">
					<Show
						when={scenarioEntries().length > 0}
						fallback={
							<div class="rounded-xl border border-dashed border-border bg-muted/50 p-6 text-center text-sm text-muted-foreground">
								Waiting for worker manifest…
							</div>
						}
					>
						<For each={scenarioEntries()}>
							{(entry) => {
								const winner =
									entry.results.length > 0
										? entry.results.reduce((best, current) =>
												current.totalMs < best.totalMs ? current : best
											).store
										: null
								return (
									<Card class="rounded-2xl p-4">
										<header class="flex items-start justify-between gap-4">
											<div>
												<h2 class="text-xl font-semibold text-card-foreground">
													{entry.scenario.name}
												</h2>
												<p class="text-sm text-muted-foreground">
													{describeScenario(entry.scenario)}
												</p>
											</div>
											<div class="text-right text-sm">
												<p class={scenarioStatusClass[entry.status]}>
													{scenarioStatusLabel[entry.status]}
												</p>
												<Show when={entry.durationMs != null}>
													<p class="text-xs text-muted-foreground">
														{formatDuration(entry.durationMs)} elapsed
													</p>
												</Show>
											</div>
										</header>
										<Show
											when={entry.results.length > 0}
											fallback={
												<p class="mt-6 text-sm text-muted-foreground">
													Awaiting adapter results…
												</p>
											}
										>
											<div class="mt-4 overflow-x-auto">
												<BenchResultsTable
													results={entry.results}
													winner={winner}
												/>
											</div>
										</Show>
									</Card>
								)
							}}
						</For>
					</Show>
				</section>

				<Card class="rounded-2xl p-4">
					<header class="mb-3 flex items-center justify-between">
						<div>
							<h3 class="text-lg font-semibold text-card-foreground">
								Live logs
							</h3>
							<p class="text-sm text-muted-foreground">
								Tap into worker progress + adapter updates
							</p>
						</div>
						<span class="text-xs text-muted-foreground">
							{logs().length} events
						</span>
					</header>
					<div class="max-h-64 overflow-y-auto pr-2">
						<Show
							when={logs().length > 0}
							fallback={
								<p class="text-sm text-muted-foreground">
									Awaiting worker events…
								</p>
							}
						>
							<For each={logs()}>
								{(log) => (
									<div class="flex items-start gap-3 py-1 text-sm">
										<span class="w-20 text-xs font-mono text-muted-foreground">
											{new Date(log.timestamp).toLocaleTimeString()}
										</span>
										<span
											class={`text-[11px] font-semibold uppercase tracking-wide ${logKindClass[log.kind]}`}
										>
											{log.kind}
										</span>
										<div class="flex-1 text-foreground">
											{log.message}
											<Show when={log.scenarioName}>
												<span class="text-muted-foreground">
													{' '}
													({log.scenarioName}
													<Show when={log.adapter}>{` • ${log.adapter}`}</Show>)
												</span>
											</Show>
										</div>
									</div>
								)}
							</For>
						</Show>
					</div>
				</Card>
			</div>
		</div>
	)
}
