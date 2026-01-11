# Solid Primitives Library Reference

Complete guide to the [@solid-primitives](https://github.com/solidjs-community/solid-primitives) library—a collection of high-quality, composable primitives for SolidJS.

## Installation

```bash
bun add @solid-primitives/{name}
```

## Available Packages

`active-element` `audio` `autofocus` `bounds` `clipboard` `connectivity` `context` `cursor` `date` `deep` `destructure` `devices` `event-bus` `event-dispatcher` `event-listener` `event-props` `filesystem` `fullscreen` `geolocation` `graphql` `history` `i18n` `immutable` `input` `intersection-observer` `keyboard` `keyed` `lifecycle` `map` `media` `memo` `mouse` `mutation-observer` `network` `pagination` `platform` `pointer` `props` `raf` `range` `refs` `resize-observer` `resource` `rootless` `scheduled` `script-loader` `scroll` `selection` `share` `signal-builders` `start` `static-store` `storage` `stream` `styles` `template` `timer` `title` `transition` `trigger` `tween` `upload` `utils` `websocket` `workers`

## Fetcher Modifiers

Enhance fetch operations with composable modifiers:

| Modifier | Purpose | Usage |
|----------|---------|-------|
| `makeAbortable` | Adds AbortController, auto-aborts on timeout | Network cleanup |
| `makeRetrying` | Retries failed requests N times with delay | Resilient fetching |
| `makeCache` | Caches by key with TTL, optional persistence | Performance |

**Example**:
```tsx
import { makeAbortable, makeRetrying, makeCache } from '@solid-primitives/fetch'

const fetcher = makeCache(
  makeRetrying(
    makeAbortable(fetch),
    { attempts: 3, delay: 1000 }
  ),
  { ttl: 60000 }
)
```

## Resource Modifiers

Enhance `createResource` with advanced behaviors:

| Modifier | Purpose | Usage |
|----------|---------|-------|
| `createAggregated` | Merges new data into old | Pagination, streaming |
| `createDeepSignal` | Deeply reactive resource | Avoid rerender storms |

### Aggregation Rules

- **Array** → append
- **Object** → shallow merge
- **String** → append
- **null** → no overwrite

**Example**:
```tsx
import { createAggregated } from '@solid-primitives/resource'

const [messages] = createAggregated(fetchMessages)
// Each fetch appends to previous messages
```

## `createFetch` - TanStack Query Alternative

TanStack-Query-like fetch layer with native Solid integration:

```tsx
import { createFetch } from '@solid-primitives/fetch'

const { data, loading, error, refetch } = createFetch(url, options)
```

**Built-in modifiers**:
- `withAbort` - Automatic request cancellation
- `withTimeout` - Request timeout handling
- `withRetry` - Automatic retry logic
- `withCache` - Request/response caching
- `withAggregation` - Data aggregation
- `withRefetchEvent` - Event-based refetching
- `withCatchAll` - Global error handling
- `withCacheStorage` - Persistent cache

## Stream Primitives

### Media Streams

| Primitive | Purpose |
|-----------|---------|
| `createStream` | MediaStream as a resource |
| `createAmplitudeStream` | Audio amplitude signal |

**Example**:
```tsx
import { createStream } from '@solid-primitives/stream'

const [stream] = createStream(async () => {
  return await navigator.mediaDevices.getUserMedia({ video: true })
})
```

## WebSocket Primitives

| Primitive | Purpose |
|-----------|---------|
| `createWS` / `makeWS` | WebSocket with message signal |
| `makeReconnectingWS` | Auto reconnect on disconnect |
| `makeHeartbeatWS` | Ping/pong keepalive |
| `createWSState` | readyState signal |

**Example**:
```tsx
import { createWS } from '@solid-primitives/websocket'

const [messages, send, state] = createWS('wss://api.example.com')

createEffect(() => {
  console.log('Latest message:', messages())
})

send('Hello server')
```

## Static Stores

For performance-critical reactive objects with fixed shapes:

| Primitive | Purpose |
|-----------|---------|
| `createStaticStore` | Shallow reactive object, fixed shape |
| `createDerivedStaticStore` | Static store derived from a signal |

**Use for**: Window size, mouse position, layout state, event state

**Why use static stores**:
- Fixed shape known at creation
- More efficient than regular stores
- Prevents unnecessary deep reactivity

**Example**:
```tsx
import { createStaticStore } from '@solid-primitives/static-store'

const [state, setState] = createStaticStore({
  x: 0,
  y: 0,
  width: window.innerWidth,
  height: window.innerHeight
})

// Efficient updates
setState({ x: 100, y: 200 })
```

## Event Handling

### Event Listener

```tsx
import { createEventListener } from '@solid-primitives/event-listener'

createEventListener(window, 'resize', (e) => {
  console.log('Window resized', e)
})
```

### Event Bus

```tsx
import { createEventBus } from '@solid-primitives/event-bus'

const bus = createEventBus()

bus.on('user:login', (user) => {
  console.log('User logged in:', user)
})

bus.emit('user:login', { id: 1, name: 'Alice' })
```

## Storage Primitives

```tsx
import { createStorage } from '@solid-primitives/storage'

const [value, setValue] = createStorage('key', 'default')
// Automatically syncs with localStorage
```

## Intersection Observer

```tsx
import { createIntersectionObserver } from '@solid-primitives/intersection-observer'

const [isVisible, setRef] = createIntersectionObserver()

<div ref={setRef}>
  <Show when={isVisible()}>
    <ExpensiveComponent />
  </Show>
</div>
```

## Resize Observer

```tsx
import { createResizeObserver } from '@solid-primitives/resize-observer'

const [size, setRef] = createResizeObserver()

createEffect(() => {
  console.log('Size:', size())
})
```

## Timer Primitives

```tsx
import { createTimer } from '@solid-primitives/timer'

const [running, start, stop] = createTimer(
  () => console.log('Tick'),
  1000,
  setInterval
)
```

## Composition Pattern

Stack primitives for full-featured data fetching:

```
source → makeCache → makeRetrying → makeAbortable → createResource → createAggregated → Suspense
```

**Result**: Keys, cache, retry, abort, streaming, pagination, fine-grained reactivity, Suspense, and transitions—all without a query client.

**Example of composition**:
```tsx
// 1. Base fetcher with abort
const abortableFetch = makeAbortable(fetch)

// 2. Add retry logic
const resilientFetch = makeRetrying(abortableFetch, {
  attempts: 3,
  delay: 1000
})

// 3. Add caching
const cachedFetch = makeCache(resilientFetch, {
  ttl: 60000
})

// 4. Create resource with aggregation
const [data] = createAggregated(
  createResource(key, cachedFetch)
)

// 5. Wrap in Suspense
<Suspense fallback={<Loading />}>
  <DataView data={data()} />
</Suspense>
```

## Performance Optimization

### When to Use What

| Scenario | Primitive | Why |
|----------|-----------|-----|
| Fixed-shape reactive object | `createStaticStore` | More efficient than regular stores |
| Expensive computation | `createMemo` | Caches result |
| Paginated data | `createAggregated` | Appends instead of replaces |
| Deep object reactivity | `createDeepSignal` | Granular updates |
| Media/camera access | `createStream` | Proper cleanup |
| Real-time data | `createWS` | Automatic reconnection |

## Common Patterns

### Real-time Data with WebSocket

```tsx
import { createWS } from '@solid-primitives/websocket'
import { createAggregated } from '@solid-primitives/resource'

const [messages, send] = createWS('wss://api.example.com/chat')

<For each={messages()}>
  {(msg) => <Message data={msg} />}
</For>
```

### Infinite Scroll with Aggregation

```tsx
import { createAggregated } from '@solid-primitives/resource'

const [data, { refetch }] = createAggregated(
  createResource(page, fetchPage)
)

createIntersectionObserver(
  loadMoreRef,
  () => setPage(p => p + 1)
)
```

### Cached API with Retry

```tsx
const fetcher = makeCache(
  makeRetrying(makeAbortable(fetch), {
    attempts: 3,
    delay: 1000
  }),
  { ttl: 60000 }
)

const [user] = createResource(userId, (id) =>
  fetcher(`/api/users/${id}`).then(r => r.json())
)
```

## Additional Resources

- **GitHub**: https://github.com/solidjs-community/solid-primitives
- **NPM Org**: https://www.npmjs.com/org/solid-primitives
- **Documentation**: Each package includes detailed README
