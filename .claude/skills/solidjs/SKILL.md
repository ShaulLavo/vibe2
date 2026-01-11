---
name: solidjs
description: Expert guidance for SolidJS development including reactivity rules, component patterns, async handling, and Solid Primitives library. Use when working with SolidJS code, implementing reactive components, handling async data with Suspense, or when the user mentions SolidJS, signals, effects, or reactive patterns.
---

# SolidJS Development Skill

Expert guidance for building reactive applications with SolidJS. This skill provides best practices, reactivity rules, and integration patterns for the SolidJS ecosystem.

## Quick Reference

### Core Reactivity Rules

⚠️ **CRITICAL**: Never destructure props—it kills reactivity. Use `splitProps` or access `props.property` directly.

```tsx
// ❌ WRONG - Breaks reactivity
const { value, onChange } = props

// ✅ CORRECT - Preserves reactivity
const value = () => props.value
// OR access directly: props.value
```

### Common Patterns

| Pattern | Use |
|---------|-----|
| `createSignal()` | Reactive state with getter/setter |
| `createMemo()` | Derived reactive value (cached computation) |
| `createEffect()` | Side effect on dependency change |
| `batch()` | Group multiple signal updates |
| `splitProps()` | Split props while preserving reactivity |

## File Structure & Conventions

```tsx
// EditorPane.tsx - One component per file, PascalCase naming
import { createSignal, batch } from 'solid-js'

// ✅ Named export (preferred)
export function EditorPane(props) {
  // Component implementation
}
```

**Rules**:
- TypeScript with `.tsx` extension
- One component per file
- Named exports (avoid default exports)
- PascalCase for component filenames

## Reactivity Deep Dive

### Props Are Reactive Getters

Props are automatically reactive—no need to wrap them:

```tsx
function Child(props) {
  // ✅ Reactive automatically
  return <div>{props.value}</div>

  // ❌ Don't do this
  return <div>{props.value()}</div>  // props.value is not a function!
}
```

### Batching Multiple Updates

```tsx
import { batch } from 'solid-js'

// Batch prevents multiple re-renders
batch(() => {
  setName('Alice')
  setAge(30)
  setCity('NYC')
})
```

### The `children` Helper

**Always** use the `children` helper when accepting `props.children`:

```tsx
import { children } from 'solid-js'

function Wrapper(props) {
  const resolved = children(() => props.children)

  // Use resolved() in JSX
  return <div>{resolved()}</div>
}
```

**Benefits**:
- Properly resolves children (functions executed, arrays flattened)
- Memoizes to prevent redundant DOM creation
- Tracks in the correct scope

**Conditional rendering**:
```tsx
const resolved = children(() => visible() && props.children)
```

## Naming Conventions

### `create*` — Reactive Primitives

Creates a **reactive primitive** that integrates with Solid's tracking system.

```tsx
createSignal()  // Signal with getter/setter
createMemo()    // Derived reactive value
createEffect()  // Side effect on dependency change
```

**Use when**: Setting up reactivity, registering dependencies, producing tracked reads/writes

### `make*` — Non-Reactive Foundations

Creates a **non-reactive building block** with only setup + cleanup.

```tsx
makeTimer()  // Timer scheduler + cleanup
// createTimer() would wrap makeTimer() to add reactivity
```

**Use when**: Building low-level utilities, composing into reactive primitives, zero reactivity needed

### `use*` — Access Existing Resources

**Consumes** an already-created resource rather than creating new reactive machinery.

```tsx
useContext()     // Retrieves context created by createContext()
useTransition()  // Accesses transition state
```

**Use when**: Accessing existing contexts, retrieving already-created resources

## Async & Suspense

### Quick Reference

| Primitive | Purpose |
|-----------|---------|
| `Suspense` | Shows fallback until resources resolve |
| `createResource` | Keyed async data with cache, refetch, loading |
| `createAsync` | Fire-and-forget async (no keys, no refetch) |
| `startTransition` | Keeps old UI until new resource resolves |
| `useTransition` | Provides `pending()` during transitions |

### Critical Rules

1. **Only resources trigger Suspense**—signals, memos, and props do not
2. **Never wrap resources in `<Show>`** inside Suspense:
   ```tsx
   // ❌ Bad
   <Suspense><Show when={res()} /></Suspense>

   // ✅ Good
   <Suspense>{res()}</Suspense>
   ```
3. **Nested Suspense** isolates loading states—each waits only for its own resources

### Resource-Driven UI Pattern

```tsx
const [font] = createResource(activeFont, loadFont)

<Suspense fallback={<Spinner />}>
  <Editor font={font()} />
</Suspense>

// Smooth transition on change
startTransition(() => setActiveFont("Inter"))
```

### Decision Guide

| Need | Use |
|------|-----|
| No flicker | `Suspense` |
| Keyed async | `createResource` |
| Smooth swaps | `startTransition` |
| Loading indicator | `useTransition` |
| Partial loading | Nested `Suspense` |

## Common Mistakes to Avoid

1. **Setting signals in effects** → Use `createMemo` for derived values instead
2. **Destructuring props** → Kills reactivity; use `splitProps` or direct access
3. **Wrapping resources in `<Show>`** → Prevents Suspense from working
4. **Not batching updates** → Causes unnecessary re-renders
5. **Accessing props.value()** → Props are already reactive, don't call as function

## Solid Primitives Library

Before implementing custom solutions, check **[solid-primitives](https://github.com/solidjs-community/solid-primitives)**.

Install: `bun add @solid-primitives/{name}`

For detailed information about available primitives, see [PRIMITIVES.md](PRIMITIVES.md).

## Additional Resources

- **[PRIMITIVES.md](PRIMITIVES.md)** - Complete guide to solid-primitives library including fetchers, resources, WebSockets, and composition patterns
- **[TERMINOLOGY.md](TERMINOLOGY.md)** - Detailed glossary of SolidJS terms and concepts
- **Official Docs** - Use the `fetch_solidjs_docs` helper to access official documentation

## Official Documentation Access

To fetch the latest information from SolidJS official documentation (uses gitingest to access the solidjs/solid-docs GitHub repo):

```bash
# Fetch specific documentation page
python3 .claude/skills/solidjs/fetch_docs.py "reactivity"
python3 .claude/skills/solidjs/fetch_docs.py "createResource"
python3 .claude/skills/solidjs/fetch_docs.py "signals"

# Or search for any topic
python3 .claude/skills/solidjs/fetch_docs.py "Suspense"
```

**Features**:
- Caches documentation for 1 hour to avoid repeated fetches
- Searches through 219 files from the official solid-docs repo
- Returns relevant markdown documentation with examples
- Covers concepts, guides, API reference, and tutorials

When you need the most up-to-date information or details not covered in this skill, use the documentation fetcher.
