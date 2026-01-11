# Editor File Sync Integration

A reactive sync status management system for SolidJS applications that provides real-time file synchronization, conflict detection, and resolution UI.

## Architecture Overview

The sync system follows SolidJS best practices with a reactive context/hook pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SyncStatusProvider                           │
│  - Reactive store for all file sync statuses                   │
│  - Subscribes to EditorFileSyncManager events                  │
│  - Provides context for hooks and components                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Reactive Hooks & Components                     │
│  - createSyncStatus() - Single file status                     │
│  - createConflictTracker() - Conflict monitoring               │
│  - SyncStatusIndicator - Visual status indicators              │
│  - ConflictResolutionUI - Conflict resolution dialogs          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Wrap your app with SyncStatusProvider

```tsx
import { SyncStatusProvider } from '@repo/code-editor/sync'

function App() {
  const syncManager = new EditorFileSyncManager({ ... })
  
  return (
    <SyncStatusProvider syncManager={syncManager}>
      <YourEditorApp />
    </SyncStatusProvider>
  )
}
```

### 2. Use reactive hooks in components

```tsx
import { createSyncStatus, SyncStatusIndicator } from '@repo/code-editor/sync'

function FileTab(props: { filePath: string }) {
  const status = createSyncStatus(() => props.filePath)
  
  return (
    <div class="file-tab">
      <SyncStatusIndicator filePath={props.filePath} />
      <span>{props.filePath}</span>
      <span class="status">{status().type}</span>
    </div>
  )
}
```

## Core Components

### Context & Provider

- **`SyncStatusProvider`** - Root provider that manages reactive state
- **`useSyncStatusContext()`** - Access the context directly
- **`createSyncStatus(filePath)`** - Get reactive status for a single file

### UI Components

- **`SyncStatusIndicator`** - Dot indicator showing sync state
- **`SyncStatusBadge`** - Badge with icon and optional text
- **`SyncStatusSummary`** - Aggregate status across multiple files
- **`ConflictResolutionUI`** - Complete conflict resolution interface
- **`DiffView`** - Side-by-side diff viewer with manual merge

### Reactive Hooks

- **`createConflictTracker()`** - Monitor conflicts across all files
- **`createAggregatedSyncStatus(filePaths)`** - Aggregate status for multiple files
- **`createStatusFilter(filePaths, statusType)`** - Filter files by status
- **`createSyncStatusHistory(filePath)`** - Track status changes over time
- **`createDebouncedSyncStatus(filePath)`** - Debounced status updates

## Status Types

```typescript
type SyncStatusType = 
  | 'synced'           // File is up to date
  | 'dirty'            // Local changes not saved
  | 'external-changes' // External changes detected
  | 'conflict'         // Both local and external changes
  | 'error'            // Sync error occurred
  | 'not-watched'      // File not being watched
```

## Examples

### Basic File Status

```tsx
function FileExplorer() {
  const [openFiles] = createSignal(['/src/App.tsx', '/src/utils.ts'])
  
  return (
    <For each={openFiles()}>
      {(filePath) => (
        <div class="file-item">
          <SyncStatusIndicator filePath={filePath} showTooltip />
          <span>{filePath}</span>
        </div>
      )}
    </For>
  )
}
```

### Conflict Monitoring

```tsx
function ConflictAlert() {
  const conflictTracker = createConflictTracker()
  
  return (
    <Show when={conflictTracker.hasConflicts()}>
      <div class="alert alert-warning">
        {conflictTracker.conflictCount()} files have conflicts
      </div>
    </Show>
  )
}
```

### Aggregate Status Dashboard

```tsx
function StatusDashboard() {
  const [allFiles] = createSignal([...]) // Your file list
  const aggregated = createAggregatedSyncStatus(allFiles)
  
  return (
    <div class="dashboard">
      <div>Total: {aggregated().counts.total}</div>
      <div>Synced: {aggregated().counts.synced}</div>
      <div>Conflicts: {aggregated().counts.conflicts}</div>
      <div>Overall: {aggregated().overallStatus}</div>
    </div>
  )
}
```

### Status Change Notifications

```tsx
function NotificationSystem() {
  const [files] = createSignal([...])
  const notifications = createSyncStatusNotifications(files)
  
  return (
    <For each={notifications.notifications()}>
      {(notification) => (
        <div class="notification">
          {notification.path}: {notification.status.type}
          <button onClick={() => notifications.dismissNotification(notification.id)}>
            Dismiss
          </button>
        </div>
      )}
    </For>
  )
}
```

## Benefits of Reactive Architecture

### 1. **Automatic UI Updates**
Components automatically re-render when sync status changes - no manual state management needed.

### 2. **Shared State**
Multiple components can access the same file status without prop drilling or duplicate subscriptions.

### 3. **Performance**
Only components using specific file paths re-render when those files change.

### 4. **SolidJS Idiomatic**
Follows SolidJS patterns:
- Stateful logic in hooks (`create*`)
- Pure components (no logic inside)
- Reactive getters for props

### 5. **Type Safety**
Full TypeScript support with proper type inference for all hooks and components.

## Migration from Class-based Approach

**Before (Non-reactive):**
```tsx
// Manual status tracking
const [status, setStatus] = createSignal()
const manager = new EditorFileSyncManager()
manager.onStatusChange((path, newStatus) => {
  if (path === filePath) setStatus(newStatus)
})

// Manual cleanup required
onCleanup(() => manager.dispose())
```

**After (Reactive):**
```tsx
// Automatic reactive status
const status = createSyncStatus(() => filePath)
// No manual cleanup needed - handled by provider
```

## Testing

The reactive architecture is fully testable:

```tsx
// Mock the sync manager
const mockSyncManager = createMockSyncManager()

// Test reactive updates
render(() => (
  <SyncStatusProvider syncManager={mockSyncManager}>
    <TestComponent />
  </SyncStatusProvider>
))

// Simulate status change
mockSyncManager.emitStatusChange('/test/file.ts', { type: 'dirty', ... })

// Component automatically updates
expect(screen.getByText('dirty')).toBeInTheDocument()
```

## Best Practices

1. **Use the Provider at App Root** - Wrap your entire editor app with `SyncStatusProvider`
2. **Prefer Hooks over Context** - Use `createSyncStatus()` instead of `useSyncStatusContext()` directly
3. **Batch Status Updates** - The provider automatically batches rapid status changes
4. **Leverage Computed Values** - Use `createMemo()` for derived status calculations
5. **Handle Loading States** - Check for `not-watched` status type for untracked files

This reactive architecture provides a clean, performant, and maintainable way to handle sync status throughout your SolidJS editor application.