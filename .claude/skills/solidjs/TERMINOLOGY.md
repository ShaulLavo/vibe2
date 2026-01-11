# SolidJS Terminology Guide

Comprehensive glossary of SolidJS terms and concepts.

## Core Concepts

### Computation

**Definition**: A scope that reruns when dependencies change

**Avoid confusing with**: "computed" (from other frameworks)

A computation is any function that tracks reactive dependencies and re-executes when they change. Effects, memos, and component render functions are all computations.

```tsx
// This createEffect creates a computation
createEffect(() => {
  console.log(count())  // Tracks count signal
})
```

### Core Primitive

**Definition**: Built-in Solid primitive; may or may not be reactive

**Avoid confusing with**: "API function"

Core primitives are the building blocks provided by SolidJS itself:
- `createSignal`
- `createMemo`
- `createEffect`
- `createResource`
- etc.

Not all core primitives are reactive (e.g., `batch`, `untrack`).

### Custom Primitive

**Definition**: User-defined primitive providing composable functionality

**Avoid confusing with**: "hook" (React term)

Custom primitives are user-defined functions that compose core primitives:

```tsx
function useCounter(initial = 0) {
  const [count, setCount] = createSignal(initial)
  const increment = () => setCount(c => c + 1)
  return [count, increment]
}
```

### Ownership

**Definition**: Cleanup relationship: parent computations clean up owned ones

Parent computations automatically dispose of child computations when they re-run or are disposed:

```tsx
createEffect(() => {
  // This effect owns the nested effect
  createEffect(() => {
    // Cleaned up when parent re-runs
  })
})
```

### Primitive

**Definition**: A function providing reactivity/behavior (`create*`, `use*`)

**Avoid confusing with**: "Hook" (React term)

In Solid, "primitive" is the term for reusable reactive functions. In React, these would be called "hooks."

### Reactive Value

**Definition**: Any trackable value (signals, memos, props, stores)

**Avoid confusing with**: "signal" (used generically)

Reactive values are any values that participate in Solid's reactive system:
- Signal getters: `count()`
- Memo getters: `doubled()`
- Props: `props.value`
- Store properties: `state.user.name`

### Root

**Definition**: A computation with no owner (`createRoot`)

**Use case**: Create reactive scope outside component lifecycle

```tsx
const dispose = createRoot((dispose) => {
  const [count, setCount] = createSignal(0)
  // This computation has no owner
  return dispose
})

// Later...
dispose()  // Clean up manually
```

### Scope

**Definition**: A function body / code block

A scope is simply a region of code. Can be reactive (tracking scope) or non-reactive.

### Tracking Scope

**Definition**: A scope that automatically tracks read signals

**Avoid confusing with**: "reactive context"

Tracking scopes are special scopes where Solid tracks which signals are read:

```tsx
// This is a tracking scope
createEffect(() => {
  console.log(count())  // Reading count establishes dependency
})

// This is not a tracking scope
function regularFunction() {
  console.log(count())  // Not tracked
}
```

## Reactivity Terms

### Signal

A reactive primitive that holds a value and notifies dependents when it changes.

```tsx
const [count, setCount] = createSignal(0)
```

**Parts**:
- **Getter**: `count()` - reads the value
- **Setter**: `setCount()` - updates the value

### Memo

A cached, derived reactive value.

```tsx
const doubled = createMemo(() => count() * 2)
```

**Key difference from effect**: Returns a value, doesn't cause side effects.

### Effect

A computation that runs side effects when dependencies change.

```tsx
createEffect(() => {
  console.log('Count changed:', count())
})
```

**Key difference from memo**: Causes side effects, doesn't return a tracked value.

### Store

A deeply reactive object using proxies.

```tsx
import { createStore } from 'solid-js/store'

const [state, setState] = createStore({
  user: { name: 'Alice', age: 30 },
  todos: []
})

// Fine-grained reactivity
<div>{state.user.name}</div>  // Only rerenders when name changes
```

## Component Terms

### Props

Reactive values passed to components.

```tsx
function Child(props) {
  // props.value is reactive—no need to wrap in function
  return <div>{props.value}</div>
}
```

**Critical**: Props are getters. Never destructure them.

### Children

Special prop containing component children.

```tsx
function Wrapper(props) {
  const resolved = children(() => props.children)
  return <div>{resolved()}</div>
}
```

Always use the `children()` helper to properly resolve children.

## Control Flow Terms

### Show

Conditional rendering for a single condition.

```tsx
<Show when={loggedIn()} fallback={<Login />}>
  <Dashboard />
</Show>
```

### For

Optimized list rendering with keys.

```tsx
<For each={items()}>
  {(item, index) => <Item data={item} />}
</For>
```

### Switch/Match

Multi-branch conditional rendering.

```tsx
<Switch fallback={<NotFound />}>
  <Match when={state.route === 'home'}>
    <Home />
  </Match>
  <Match when={state.route === 'about'}>
    <About />
  </Match>
</Switch>
```

### Index

List rendering without key-based reconciliation.

```tsx
<Index each={items()}>
  {(item, index) => <div>{item()}</div>}
</Index>
```

**Use when**: Items are primitives or frequently reordered.

## Async Terms

### Resource

Keyed async data with loading states.

```tsx
const [data, { refetch, mutate }] = createResource(key, fetcher)
```

**Features**:
- Automatic refetch when key changes
- Loading state
- Error handling
- Manual refetch
- Optimistic updates with `mutate`

### Suspense

Boundary that shows fallback during resource loading.

```tsx
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

**Only triggered by**: Resources (not signals or memos)

### Transition

Keeps old UI visible until new resources resolve.

```tsx
const [isPending, startTransition] = useTransition()

startTransition(() => {
  setPage(2)  // Won't flicker during load
})
```

## Advanced Terms

### Batch

Groups multiple signal updates into one reactive update.

```tsx
batch(() => {
  setName('Alice')
  setAge(30)
  setCity('NYC')
})
// Only one reactive update fires
```

### Untrack

Reads signals without establishing dependencies.

```tsx
createEffect(() => {
  console.log(count())  // Tracked
  untrack(() => {
    console.log(other())  // Not tracked
  })
})
```

### Context

Share values down the component tree without props.

```tsx
const ThemeContext = createContext()

function Provider(props) {
  return (
    <ThemeContext.Provider value="dark">
      {props.children}
    </ThemeContext.Provider>
  )
}

function Consumer() {
  const theme = useContext(ThemeContext)
  return <div>{theme}</div>
}
```

### Portal

Render content outside the current DOM hierarchy.

```tsx
<Portal mount={document.getElementById('modal-root')}>
  <Modal />
</Portal>
```

### ErrorBoundary

Catches errors in child components.

```tsx
<ErrorBoundary fallback={(err) => <Error message={err.message} />}>
  <RiskyComponent />
</ErrorBoundary>
```

## Comparison with Other Frameworks

| SolidJS | React | Vue |
|---------|-------|-----|
| Primitive | Hook | Composable |
| Signal | State | Ref |
| Memo | useMemo | Computed |
| Effect | useEffect | WatchEffect |
| Store | (complex state) | Reactive |
| Computation | (none) | (none) |
| Tracking scope | (none) | Effect scope |

## Common Misconceptions

### "Signals are like useState"

❌ Not quite. Signals are more primitive:
- No component coupling
- Can be created anywhere
- No re-render mechanism (fine-grained updates)

### "Props need to be functions"

❌ No. Props are **already** getters:
```tsx
// ✅ Correct
props.value

// ❌ Wrong
props.value()
```

### "Effects are like useEffect"

❌ Different ownership model:
- Solid effects clean up automatically
- React effects need manual cleanup
- Solid effects can create nested effects

### "Memos prevent re-renders"

❌ In Solid, components don't "re-render":
- Only the specific DOM nodes update
- Memos cache expensive computations
- Not about preventing component updates

## Best Practices

1. **Use the correct term**: Say "primitive" not "hook"
2. **Understand ownership**: Parent disposes children automatically
3. **Track correctly**: Know which scopes track signals
4. **Don't confuse primitives**: Effect for side effects, memo for derived values
5. **Remember props are reactive**: Never destructure

## References

- [SolidJS Documentation](https://www.solidjs.com/docs)
- [Understanding Reactivity](https://www.solidjs.com/tutorial/introduction_basics)
- [SolidJS Discord](https://discord.com/invite/solidjs)
