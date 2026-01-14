# Vibe Web App - Complete Loading Architecture Graph

## Table of Contents
1. [High-Level Boot Sequence](#1-high-level-boot-sequence)
2. [Entry Point Flow](#2-entry-point-flow)
3. [Provider Initialization Stack](#3-provider-initialization-stack)
4. [SolidJS Reactive Graph](#4-solidjs-reactive-graph)
5. [Worker Architecture](#5-worker-architecture)
6. [Cache Layer Architecture](#6-cache-layer-architecture)
7. [Filesystem Initialization](#7-filesystem-initialization)
8. [Conditional Branches](#8-conditional-branches)
9. [Complete Dependency Graph](#9-complete-dependency-graph)

---

## 1. High-Level Boot Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIBE WEB APP BOOT SEQUENCE                          │
└─────────────────────────────────────────────────────────────────────────────┘

index.html
    │
    ▼
┌──────────────────┐
│   index.tsx      │ ─────────────────────────────────────────────────────────┐
│  (Entry Point)   │                                                          │
└────────┬─────────┘                                                          │
         │                                                                    │
         │  import solid-devtools                                             │
         │  import ./styles.css                                               │
         │  import @repo/code-editor/styles.css                               │
         │                                                                    │
         ▼                                                                    │
┌──────────────────┐                                                          │
│     App.tsx      │                                                          │
│   (Root Comp)    │                                                          │
└────────┬─────────┘                                                          │
         │                                                                    │
         │  Setup onCleanup(disposeTreeSitterWorker)                          │
         │                                                                    │
         ▼                                                                    │
┌──────────────────┐     ┌─────────────────────────────────────────────────┐  │
│   Providers.tsx  │────▶│  NESTED PROVIDER STACK (13 layers deep)         │  │
│ (Context Setup)  │     │  See Section 3 for complete hierarchy           │  │
└────────┬─────────┘     └─────────────────────────────────────────────────┘  │
         │                                                                    │
         ▼                                                                    │
┌──────────────────┐                                                          │
│  @solidjs/router │                                                          │
│    (Routing)     │                                                          │
└────────┬─────────┘                                                          │
         │                                                                    │
         ├──────────────────┬──────────────────┬──────────────────┐           │
         ▼                  ▼                  ▼                  ▼           │
    ┌─────────┐      ┌───────────┐      ┌───────────┐      ┌──────────┐      │
    │ Main.tsx│      │/bench     │      │/vfs-bench │      │/sqlite   │      │
    │   "/"   │      │StoreBench │      │VfsPathBnch│      │SqliteStdo│      │
    └────┬────┘      └───────────┘      └───────────┘      └──────────┘      │
         │                                                                    │
         ├────────────────────┬────────────────────┐                          │
         ▼                    ▼                    ▼                          │
    ┌─────────┐         ┌──────────┐         ┌──────────┐                     │
    │  Fs.tsx │         │Terminal  │         │StatusBar │                     │
    │(Editor) │         │ (Shell)  │         │          │                     │
    └─────────┘         └──────────┘         └──────────┘                     │
                                                                              │
◀─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Entry Point Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            index.tsx EXECUTION                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              index.tsx
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐
│ solid-devtools  │    │   styles.css    │    │@repo/code-editor/styles│
│   (Dev Only)    │    │                 │    │                         │
└─────────────────┘    └────────┬────────┘    └─────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              ┌──────────┐           ┌──────────────┐
              │tailwindcss│           │@xterm/xterm  │
              │          │           │   /css       │
              └──────────┘           └──────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ packages/ui/styles.css│
                    └───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEV MODE CHECK                                     │
│  if (import.meta.env.DEV && !root) {                                        │
│    throw new Error('Root element not found')                                │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     render(() => <App />, root!)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Provider Initialization Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROVIDER NESTING HIERARCHY                               │
│                    (13 Layers - Order Matters!)                             │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1  ┌─────────────────────────────────────────────────────────────────┐
         │ ColorModeScript                                                  │
         │ └─ Injects theme script into <head> before hydration            │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 2       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ ColorModeProvider (@kobalte/core)                               │
         │ └─ Manages light/dark/system theme mode                         │
         │ └─ Reads from localStorage: 'ui-theme'                          │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 3       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ ThemeProvider (@repo/theme)                                     │
         │ ├─ Creates theme store with LIGHT_THEME / DARK_THEME            │
         │ ├─ isDark memo                                                  │
         │ ├─ trackedTheme for deep reactivity                             │
         │ └─ Effect: syncToCssVars() on theme change                      │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 4       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ SettingsProvider                                                │
         │ ├─ createSettingsStore()                                        │
         │ │   ├─ Loads schemas: editor.json, terminal.json, ui.json,      │
         │ │   │                 appearance.json                           │
         │ │   └─ Initializes defaults + userOverrides                     │
         │ └─ Provides [state, actions] tuple                              │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 5       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ SettingsEffects                                                 │
         │ ├─ EFFECT 1: Theme Mode Sync (bi-directional)                   │
         │ │   settings → ThemeProvider.setMode()                          │
         │ ├─ EFFECT 2: Reverse Theme Sync                                 │
         │ │   theme.mode() → settings (with 50ms debounce)                │
         │ └─ EFFECT 3: Font CSS Variables                                 │
         │     Watches: 6 font settings + 3 zoom offsets                   │
         │     Sets: --ui-font-size, --editor-font-size, etc.              │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 6       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ KeymapProvider                                                  │
         │ ├─ createKeymapController() from @repo/keyboard                 │
         │ ├─ onMount: controller.attach(window)                           │
         │ └─ onCleanup: controller.detach()                               │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 7       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ FocusProvider                                                   │
         │ ├─ Tracks: 'global' | 'terminal' | 'editor' | 'fileTree'        │
         │ ├─ Registers area resolvers                                     │
         │ └─ Listens: pointerdown, focusin events                         │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 8       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ FontZoomProvider                                                │
         │ ├─ registerFontZoomShortcuts()                                  │
         │ └─ Ctrl+Wheel zoom functionality                                │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 9       ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ FsProvider  ◀══════════════════════════════════════════════════ │
         │ ║                    MAJOR INITIALIZATION                     ║ │
         │ ╠══════════════════════════════════════════════════════════════╣ │
         │ ║ Creates:                                                    ║ │
         │ ║ ├─ createFsState()                                          ║ │
         │ ║ │   ├─ createTreeState()      (tree structure)              ║ │
         │ ║ │   ├─ createExpandedState()  (expanded dirs)               ║ │
         │ ║ │   ├─ createSelectionState() (selected path)               ║ │
         │ ║ │   ├─ createFileDisplayState() (loading/saving)            ║ │
         │ ║ │   ├─ createPrefetchState()  (background indexing)         ║ │
         │ ║ │   └─ createFileStore()      (file content/syntax)         ║ │
         │ ║ ├─ createFileCacheController() (IndexedDB cache)            ║ │
         │ ║ ├─ useFileSelection()                                       ║ │
         │ ║ ├─ makeTreePrefetch() (worker pool)                         ║ │
         │ ║ ├─ useDirectoryLoader()                                     ║ │
         │ ║ ├─ useFsRefresh()                                           ║ │
         │ ║ ├─ createFsMutations()                                      ║ │
         │ ║ └─ useFileSystemObserver()                                  ║ │
         │ ╠══════════════════════════════════════════════════════════════╣ │
         │ ║ onMount Effects:                                            ║ │
         │ ║ ├─ restoreHandleCache()                                     ║ │
         │ ║ ├─ refresh(DEFAULT_SOURCE)                                  ║ │
         │ ║ ├─ startObserving()                                         ║ │
         │ ║ └─ Listen 'settings-file-changed'                           ║ │
         │ ╚══════════════════════════════════════════════════════════════╝ │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 10      ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ LayoutManagerProvider                                           │
         │ ├─ createPersistedLayoutManager()                               │
         │ └─ Wraps with ActiveFileProvider                                │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 11      ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ FontRegistryProvider                                            │
         │ ├─ createFontRegistry()                                         │
         │ ├─ availableFontsResource (Suspense)                            │
         │ └─ cachedFontsResource (Suspense)                               │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 12      ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ CommandPaletteProvider                                          │
         │ ├─ Creates command registry                                     │
         │ ├─ Registers built-in commands                                  │
         │ ├─ Registers keyboard shortcuts                                 │
         │ └─ Registers settings shortcuts                                 │
         └─────────────────────────────────────────────────────────────────┘
              │
Layer 13      ▼
         ┌─────────────────────────────────────────────────────────────────┐
         │ UI Components                                                   │
         │ ├─ ThemedToaster                                                │
         │ ├─ Modal                                                        │
         │ ├─ CommandPalette                                               │
         │ ├─ {children} (Router + routes)                                 │
         │ └─ [DEV ONLY] TanStackDevtools                                  │
         │     ├─ Position: 'bottom-right'                                 │
         │     ├─ Hotkey: Ctrl+Shift+D                                     │
         │     └─ Performance panel plugin                                 │
         └─────────────────────────────────────────────────────────────────┘
```

---

## 4. SolidJS Reactive Graph

### 4.1 Signal Map (141+ signals)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SIGNAL DEPENDENCIES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║                          FILE SYSTEM SIGNALS                              ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  createSelectionState.ts                                                  ║
║  ┌─────────────────┐     ┌─────────────────┐                              ║
║  │ selectedPath    │────▶│ selectedNode    │ (memo)                       ║
║  │ (FilePath|undef)│     │ (FsTreeNode)    │                              ║
║  └─────────────────┘     └─────────────────┘                              ║
║           │                      │                                        ║
║           │                      ▼                                        ║
║           │              ┌─────────────────┐                              ║
║           │              │ Last known path │ (localStorage effect)        ║
║           │              └─────────────────┘                              ║
║           │                                                               ║
║  ┌─────────────────┐                                                      ║
║  │ activeSource    │ ('local'|'opfs'|'memory')                            ║
║  │ (persisted)     │                                                      ║
║  └─────────────────┘                                                      ║
║                                                                           ║
║  createFileDisplayState.ts                                                ║
║  ┌─────────────────┐     ┌─────────────────┐                              ║
║  │ loading         │     │ saving          │                              ║
║  │ (boolean)       │     │ (boolean)       │                              ║
║  └─────────────────┘     └─────────────────┘                              ║
║                                                                           ║
║  createPrefetchState.ts                                                   ║
║  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  ║
║  │backgroundPrefetching│  │backgroundIndexedCnt │  │lastPrefetchedPath │  ║
║  └─────────────────────┘  └─────────────────────┘  └───────────────────┘  ║
║  ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  ║
║  │prefetchError        │  │prefetchProcessedCnt │  │prefetchLastDurMs  │  ║
║  └─────────────────────┘  └─────────────────────┘  └───────────────────┘  ║
║  ┌─────────────────────┐                                                  ║
║  │prefetchAverageDurMs │                                                  ║
║  └─────────────────────┘                                                  ║
║                                                                           ║
║  createFsState.ts                                                         ║
║  ┌─────────────────┐                                                      ║
║  │ creationState   │ ({type, parentPath, suggestedName})                  ║
║  └─────────────────┘                                                      ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                          EDITOR SIGNALS                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  CursorContext.tsx (Critical for text editing)                            ║
║  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            ║
║  │ documentLength  │  │ lineStarts      │  │ lineIds         │            ║
║  │ (number)        │  │ (Uint32Array)   │  │ (Uint32Array)   │            ║
║  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            ║
║           │                    │                    │                     ║
║           └────────────────────┼────────────────────┘                     ║
║                                ▼                                          ║
║                    ┌─────────────────────┐                                ║
║                    │ lineCount (memo)    │                                ║
║                    └─────────────────────┘                                ║
║                                                                           ║
║  ┌─────────────────┐  ┌─────────────────┐                                 ║
║  │ activePieceTable│  │ lineDataRevision│                                 ║
║  └─────────────────┘  └─────────────────┘                                 ║
║                                                                           ║
║  CommandPalette                                                           ║
║  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            ║
║  │ isOpen          │  │ query           │  │ selectedIndex   │            ║
║  │ (boolean)       │  │ (string)        │  │ (number)        │            ║
║  └─────────────────┘  └─────────────────┘  └─────────────────┘            ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                          THEME SIGNALS                                    ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  @repo/theme/context.tsx                                                  ║
║  ┌─────────────────┐                                                      ║
║  │ mode            │ ('light'|'dark'|'system')                            ║
║  │ (signal)        │                                                      ║
║  └────────┬────────┘                                                      ║
║           │                                                               ║
║           ▼                                                               ║
║  ┌─────────────────┐     ┌─────────────────┐                              ║
║  │ isDark (memo)   │────▶│ theme (store)   │                              ║
║  └─────────────────┘     │ (ThemePalette)  │                              ║
║                          └────────┬────────┘                              ║
║                                   │                                       ║
║                                   ▼                                       ║
║                          ┌─────────────────┐                              ║
║                          │ CSS Variables   │                              ║
║                          │ (effect)        │                              ║
║                          └─────────────────┘                              ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### 4.2 Store Map (15+ major stores)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORE HIERARCHY                                   │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║  createFileStore.ts                                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  files: Record<FilePath, FileState>                                       ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ {                                                                   │  ║
║  │   [path]: {                                                         │  ║
║  │     pieceTable: PieceTableSnapshot,                                 │  ║
║  │     syntax: { highlights, folds, brackets, errors },                │  ║
║  │     loading: boolean,                                               │  ║
║  │     contentVersion: number                                          │  ║
║  │   }                                                                 │  ║
║  │ }                                                                   │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  highlightOffsets: Record<FilePath, number>                               ║
║  └─ Tracks syntax highlight transform deltas                              ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  createTreeState.ts                                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  treeState: { root: FsTreeNode | undefined }                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ root: {                                                             │  ║
║  │   type: 'dir',                                                      │  ║
║  │   name: string,                                                     │  ║
║  │   path: FilePath,                                                   │  ║
║  │   children: FsTreeNode[],                                           │  ║
║  │   loaded: boolean                                                   │  ║
║  │ }                                                                   │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  pathIndex: Record<FilePath, FsTreeNode>                                  ║
║  └─ Fast O(1) path lookup                                                 ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  createExpandedState.ts                                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  expanded: Record<string, boolean>  (persisted to localStorage)           ║
║  └─ Which directories are expanded in tree view                           ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  createPrefetchState.ts                                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  deferredMetadata: Record<FilePath, DeferredDirMetadata>                  ║
║  └─ Async-loaded directory metadata from background workers               ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  createSettingsStore.ts                                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  state: {                                                                 ║
║    schemas: Record<string, JSONSchema>,                                   ║
║    values: Record<string, any>,                                           ║
║    defaults: Record<string, any>,                                         ║
║    userOverrides: Record<string, any>,                                    ║
║    isLoaded: boolean                                                      ║
║  }                                                                        ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  createLayoutManager.ts                                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  state: {                                                                 ║
║    rootId: string,                                                        ║
║    nodes: Record<string, LayoutNode>,                                     ║
║    focusedPaneId: string,                                                 ║
║    scrollSyncGroups: Record<string, string[]>                             ║
║  }                                                                        ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  CursorContext.tsx                                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  lineDataById: Record<number, { text: string, length: number }>           ║
║  └─ Lazy-loaded line content cache                                        ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  @repo/theme/context.tsx                                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  theme: ThemePalette                                                      ║
║  └─ All color values, synced via trackedTheme()                           ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  createFontRegistry.ts                                                    ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  store: {                                                                 ║
║    fonts: Map<string, FontInfo>,                                          ║
║    downloading: Set<string>                                               ║
║  }                                                                        ║
║                                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  useHistoryStore.tsx                                                      ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ReactiveMap<string, HistoryState>                                        ║
║  └─ Undo/redo history per file path                                       ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### 4.3 Critical Effect Chains (141+ effects)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CRITICAL EFFECT CHAINS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
CHAIN 1: Theme Synchronization (Bi-directional)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────┐
│SettingsProvider     │
│createSettingsStore()│
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────┐
│ settingsState.values         │
│ ['appearance.theme.mode']    │
└──────────────┬───────────────┘
               │ WATCHES
               ▼
┌──────────────────────────────┐      ┌─────────────────────────┐
│ SettingsEffects              │      │ Anti-loop guard:        │
│ createEffect #1              │─────▶│ isSyncing flag          │
│ (Theme Sync Effect)          │      │ Prevents infinite loop  │
└──────────────┬───────────────┘      └─────────────────────────┘
               │ TRIGGERS
               ▼
┌──────────────────────────────┐
│ ThemeProvider.setMode()      │
│ with view transition anim    │
│ document.startViewTransition │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ theme.mode() signal          │
└──────────────┬───────────────┘
               │ WATCHES
               ▼
┌──────────────────────────────┐
│ SettingsEffects              │
│ createEffect #2              │
│ (Reverse Sync - 50ms delay)  │
└──────────────┬───────────────┘
               │ TRIGGERS
               ▼
┌──────────────────────────────┐
│ settingsActions.setSetting   │
│ ('appearance.theme.mode')    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ isDark memo recomputes       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ theme store updates          │
│ DARK_THEME / LIGHT_THEME     │
└──────────────┬───────────────┘
               │ WATCHES (via trackedTheme)
               ▼
┌──────────────────────────────┐
│ CSS Variables Effect         │
│ syncToCssVars()              │
│ Updates all --theme-* vars   │
└──────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
CHAIN 2: Font Settings → CSS Custom Properties
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                         WATCHED SIGNALS (9 total)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ settings.values['ui.font.size']                                             │
│ settings.values['ui.font.family']                                           │
│ settings.values['editor.font.size']                                         │
│ settings.values['editor.font.family']                                       │
│ settings.values['terminal.font.size']                                       │
│ settings.values['terminal.font.family']                                     │
│ settings.getZoomedFontSize('ui')        ◀─── createFontZoomStore           │
│ settings.getZoomedFontSize('editor')    ◀─── (ui, editor, terminal offsets)│
│ settings.getZoomedFontSize('terminal')  ◀───                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ANY CHANGE TRIGGERS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SettingsEffects createEffect #3                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ root.style.setProperty('--ui-font-size', ...)                               │
│ root.style.setProperty('--ui-font-family', ...)                             │
│ root.style.setProperty('--editor-font-size', ...)                           │
│ root.style.setProperty('--editor-font-family', ...)                         │
│ root.style.setProperty('--terminal-font-size', ...)                         │
│ root.style.setProperty('--terminal-font-family', ...)                       │
│ root.style.setProperty('--base-font-size', ...)                             │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
CHAIN 3: Text Input → Document State → UI Update
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────┐
│ User keystroke      │
│ (input event)       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│TextEditorInput      │
│handleInput()        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              batch() {                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│   cursor.lines.applyEdit()                                                  │
│   updatePieceTable()        ──▶  files[path].pieceTable store update        │
│   setDocumentLength()       ──▶  documentLength signal                      │
│   setLineStarts()           ──▶  lineStarts signal                          │
│   setLineDataById()         ──▶  lineDataById store                         │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           │ TRIGGERS
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CursorContext createEffect                               │
│            (watches pieceTable, documentLength, lineStarts)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Invalidates dependent memos:                                                │
│ ├─ lineCount memo                                                           │
│ ├─ Character measurement memos                                              │
│ ├─ Virtualizer recomputation (visible lines)                                │
│ └─ Cursor visual state updates                                              │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
CHAIN 4: File Selection → Content Loading → Syntax Highlighting
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────┐
│ User clicks file    │
│ in tree view        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│FsProvider.selectPath│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐        ┌─────────────────────────────────────┐
│selectedPath signal  │───────▶│ FsState.selectedNode memo recomputes│
└──────────┬──────────┘        └─────────────────────────────────────┘
           │
           │ TRIGGERS
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         useFileSelection                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ loadFile()                                                                  │
│ ├─ Check fileCache.getAsync(path)                                           │
│ │   ├─ Memory cache check (instant)                                         │
│ │   └─ IndexedDB check (if miss)                                            │
│ ├─ If cache miss:                                                           │
│ │   ├─ readFileBuffer() from OPFS/Local                                     │
│ │   ├─ createPieceTableSnapshot()                                           │
│ │   └─ parseFileBuffer()                                                    │
│ └─ setPieceTable() → updates files store                                    │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           │ ASYNC (parallel)
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TreeSitter Worker (async)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ parseBufferWithTreeSitter(path, buffer)                                     │
│ ├─ Worker receives ArrayBuffer (transferred)                                │
│ ├─ Parses with tree-sitter                                                  │
│ └─ Returns highlights, folds, brackets, errors                              │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│ setSyntax() →       │
│ files store update  │
│ → Editor re-renders │
└─────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
CHAIN 5: Background Prefetch → UI Status Updates
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                    makeTreePrefetch() (background workers)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Worker pool (1-4 workers based on hardwareConcurrency)                      │
│ Indexes directories in background                                           │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           │ PERIODIC UPDATES
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Signal Updates (via Comlink callbacks)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ setBackgroundPrefetching(boolean)                                           │
│ setBackgroundIndexedFileCount(number)                                       │
│ setLastPrefetchedPath(FilePath)                                             │
│ setPrefetchError(Error | null)                                              │
│ setPrefetchProcessedCount(number)                                           │
│ setPrefetchLastDurationMs(number)                                           │
│ setPrefetchAverageDurationMs(number)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│ FS Header Component │
│ Progress indicators │
└─────────────────────┘
```

---

## 5. Worker Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKER ECOSYSTEM                                    │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║                         MAIN THREAD                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  Worker Clients (all use Comlink.wrap() for RPC):                         ║
║  ├─ gitClient.ts ──────────────▶ git.worker.ts                            ║
║  ├─ sqliteClient.ts ───────────▶ sqlite.ts                                ║
║  ├─ workerClient.ts ───────────▶ treeSitter.worker.ts                     ║
║  ├─ treePrefetchClient.ts ─────▶ treePrefetch.worker.ts (Pool: 1-4)       ║
║  ├─ GrepCoordinator.ts ────────▶ grepWorker.ts (Pool: 1-6)                ║
║  └─ useMinimapWorker.ts ───────▶ minimapWorker/worker.ts                  ║
║                                                                           ║
║  ComlinkPool:                                                             ║
║  ├─ Creates configurable number of workers                                ║
║  ├─ Queues jobs when all workers busy                                     ║
║  ├─ pool.api → Proxied API on any available worker                        ║
║  └─ pool.destroy() → Cleanup all workers                                  ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
                              │
                              │ Comlink RPC / MessagePort / Transfer
                              ▼
╔═══════════════════════════════════════════════════════════════════════════╗
║                         WORKER THREADS                                    ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ TREE-SITTER WORKER                    treeSitter.worker.ts          │  ║
║  ├─────────────────────────────────────────────────────────────────────┤  ║
║  │ State: parser, astCache, minimapSubscribers                         │  ║
║  │ API: init(), parse(), parseBuffer(), dispose()                      │  ║
║  │ Special: Accepts MessagePort for worker-to-worker (Minimap)         │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                            ▲                                              ║
║                            │ MessagePort                                  ║
║                            ▼                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ MINIMAP WORKER                        minimapWorker/worker.ts       │  ║
║  ├─────────────────────────────────────────────────────────────────────┤  ║
║  │ State: OffscreenCanvas, summaryCache, treeSitterWorker ref          │  ║
║  │ API: init(canvas), connectTreeSitter(port), render()                │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ GIT WORKER                            git.worker.ts                 │  ║
║  ├─────────────────────────────────────────────────────────────────────┤  ║
║  │ State: baseConfig, in-memory FS for clone                           │  ║
║  │ API: init(config), clone(request, onProgress, onFile)               │  ║
║  │ Transfers: file.content.buffer (Uint8Array)                         │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ SQLITE WORKER                         sqlite.ts                     │  ║
║  ├─────────────────────────────────────────────────────────────────────┤  ║
║  │ State: sqlite3 WASM, client, db, initPromise                        │  ║
║  │ API: init() → {version, opfsEnabled}, exec(sql)                     │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ TREE PREFETCH WORKERS (Pool: 1-4)     treePrefetch.worker.ts        │  ║
║  ├─────────────────────────────────────────────────────────────────────┤  ║
║  │ State: FsContext, initialized flag                                  │  ║
║  │ API: init(), seedTree(), ingestSubtree(), tryRestoreFromCache()     │  ║
║  │ Note: FileSystemDirectoryHandle NOT transferable (WebKit limit)     │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────────┐  ║
║  │ GREP WORKERS (Pool: 1-6)              grepWorker.ts                 │  ║
║  ├─────────────────────────────────────────────────────────────────────┤  ║
║  │ State: STATELESS (pure computation)                                 │  ║
║  │ API: grepFile(task), grepBatch(tasks)                               │  ║
║  │ Features: Chunk streaming, case-insensitive, word-regexp            │  ║
║  └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                    WORKER COMMUNICATION PATTERNS                            │
└─────────────────────────────────────────────────────────────────────────────┘

Pattern 1: Single Worker (Git, SQLite)
┌──────────────┐     Comlink.wrap()     ┌──────────────┐
│ gitClient.ts │ ◀─────────────────────▶│ git.worker.ts│
└──────────────┘        RPC             └──────────────┘

Pattern 2: Worker Pool (TreePrefetch, Grep)
┌────────────────────┐                   ┌──────────────┐
│ treePrefetchClient │     ComlinkPool   │ Worker 1-4   │
│ pool.api.method()  │ ◀────────────────▶│ Load balanced│
└────────────────────┘                   └──────────────┘

Pattern 3: Worker-to-Worker (Minimap → TreeSitter)
┌──────────────┐     MessageChannel      ┌──────────────┐
│MinimapWorker │ ◀──────────────────────▶│TreeSitterWkr │
│ Subscribes   │     MessagePort         │ Notifies     │
└──────────────┘                         └──────────────┘

Pattern 4: Transferable Objects
┌──────────────┐     transfer([buffer])   ┌──────────────┐
│ Main Thread  │ ─────────────────────────▶│ Worker       │
│ ArrayBuffer  │  (zero-copy transfer)    │ Owns buffer  │
│ OffscreenCnv │                          │              │
└──────────────┘                          └──────────────┘
```

---

## 6. Cache Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TIER CACHE ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║  TIER 1: IN-MEMORY                                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  fsCache: Map<FsSource, VfsContext>     (fsRuntime.ts)                    ║
║  fileHandleCache: Map<FilePath, Handle>                                   ║
║  memoryCache: Map<FilePath, CacheEntry> (FileCacheController)             ║
║  Solid Stores: files, treeState, pathIndex, expanded, deferredMetadata    ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  TIER 2: INDEXEDDB                                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  file-cache-v2/files      → pieceTable, stats, highlights, folds          ║
║  prefetch-cache/cache     → loadedDirFileCounts, shapeFingerprint         ║
║  nerdfonts-metadata/fonts → name, size, lastAccessed                      ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  TIER 3: CACHE API (Service Worker)                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  nerdfonts-v1 (100MB max) → Font files, cache-first strategy              ║
║  Intercepts: /api/fonts/*                                                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  TIER 4: LOCALSTORAGE (Fallback)                                          ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  fs-last-known-file-path, terminal-cwd, ui-theme, panel sizes             ║
║  font-metadata-* (fallback when IndexedDB fails)                          ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  TIER 5: OPFS (Primary Storage)                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  navigator.storage.getDirectory() → Actual project files                  ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE INVALIDATION STRATEGIES                            │
└─────────────────────────────────────────────────────────────────────────────┘

1. FS Cache:        invalidateFs(source) → delete fsCache[source]
2. Prefetch:        shapeFingerprint → hash of root children names
3. Font LRU:        100MB limit, evict least-recently-accessed
4. Error Recovery:  Cache API → localStorage → In-memory → Disable
```

---

## 7. Filesystem Initialization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FILESYSTEM INITIALIZATION FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

FsProvider onMount
        │
        ├─▶ restoreHandleCache() → primeFsCache() → populate fsCache
        │
        └─▶ refresh(DEFAULT_SOURCE)
            │
            │  for (;;) {  // Source fallback loop
            ▼
        ┌───────────────────────────────────────────────────┐
        │ batch { setLoading(true), clearAllFileState() }   │
        └───────────────────────────────────────────────────┘
            │
            ▼
        ┌───────────────────────────────────────────────────┐
        │ ensureFs(source)                                  │
        │ ├─ getRootDirectory()                             │
        │ │   ├─ 'local': showDirectoryPicker()             │
        │ │   ├─ 'opfs': navigator.storage.getDirectory()   │
        │ │   └─ Fallback modal if error                    │
        │ └─ createFs(rootHandle) → VfsContext              │
        └───────────────────────────────────────────────────┘
            │
            ▼
        ┌───────────────────────────────────────────────────┐
        │ buildTree(source)                                 │
        │ └─ Skip DEFERRED_SEGMENTS: node_modules, .git,    │
        │    .hg, .svn, .vite, dist, build, .cache, target  │
        └───────────────────────────────────────────────────┘
            │
            ▼
        ┌───────────────────────────────────────────────────┐
        │ mergeSystemFolder() (if source !== 'opfs')        │
        └───────────────────────────────────────────────────┘
            │
            ▼
        ┌───────────────────────────────────────────────────┐
        │ batch { setTreeRoot, setActiveSource, setExpanded}│
        └───────────────────────────────────────────────────┘
            │
            ▼
        ┌───────────────────────────────────────────────────┐
        │ treePrefetchClient.init() → Worker pool (1-4)     │
        │ tryRestoreFromCache() → Check shapeFingerprint    │
        │ seedTree() → Begin background indexing            │
        └───────────────────────────────────────────────────┘
            │
            ▼
        ┌───────────────────────────────────────────────────┐
        │ ensureDirLoaded() for expanded paths              │
        │ selectPath(restorablePath) → Restore last file    │
        └───────────────────────────────────────────────────┘
            │
            │  Catch: LocalDirectoryFallbackSwitchError
            │  └─ source = error.nextSource; continue
            │
            │  Finally: setLoading(false)
            ▼
        ┌───────────────────────────────────────────────────┐
        │ startObserving() → Filesystem polling             │
        └───────────────────────────────────────────────────┘
```

---

## 8. Conditional Branches

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ALL CONDITIONAL LOADING PATHS                            │
└─────────────────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════════════════╗
║  ENVIRONMENT BRANCHES                                                     ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  DEV MODE (import.meta.env.DEV):                                          ║
║  ├─ TRUE:  Root validation, TanStackDevtools, Benchmark routes            ║
║  └─ FALSE: Skip validation, skip devtools                                 ║
║                                                                           ║
║  TEST MODE (VITEST | MODE === 'test'):                                    ║
║  ├─ TRUE:  DEFAULT_SOURCE = 'memory'                                      ║
║  └─ FALSE: DEFAULT_SOURCE = 'local'                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  FILESYSTEM SOURCE                                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                        source                                             ║
║           ┌──────────────┼──────────────┐                                 ║
║           ▼              ▼              ▼                                 ║
║       'local'        'opfs'        'memory'                               ║
║           │              │              │                                 ║
║   DirectoryPicker   OPFS API     In-memory FS                             ║
║           │                                                               ║
║      Error? ──▶ LocalDirectoryFallbackModal                               ║
║                 ├─ Switch to OPFS                                         ║
║                 └─ Switch to Memory                                       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  FILE LOADING                                                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Binary Detection:                                                        ║
║  ├─ Binary  → Show indicator, no editing                                  ║
║  └─ Text    → Parse content, TreeSitter highlighting                      ║
║                                                                           ║
║  Error Types:                                                             ║
║  ├─ not-found, invalid-encoding, binary-file, file-too-large → No retry   ║
║  └─ permission-denied, network-error, unknown → Retry (3x, backoff)       ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  CACHE FALLBACK                                                           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  cache_corruption       → clear_and_rebuild                               ║
║  cache_api_unavailable  → fallback_localstorage                           ║
║  storage_quota_exceeded → reduce_cache_size (50%)                         ║
║                                                                           ║
║  Final fallback: Cache API → localStorage → In-memory → Disable           ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  WORKER CAPABILITY                                                        ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  typeof Worker !== 'undefined':                                           ║
║  ├─ TRUE:  Create worker pool (1-4 based on hardwareConcurrency)          ║
║  └─ FALSE: Return NoopTreePrefetchClient                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  DEFERRED DIRECTORY LOADING                                               ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  DEFERRED_SEGMENTS (skipped during initial tree build):                   ║
║  node_modules, .git, .hg, .svn, .vite, dist, build, .cache, target        ║
║  → Loaded on-demand when user expands directory                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 9. Complete Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE INITIALIZATION TIMELINE                         │
└─────────────────────────────────────────────────────────────────────────────┘

T=0ms    index.html loads
T=1ms    index.tsx executes (imports styles, devtools)
T=5ms    render(() => <App />, root!)
T=10ms   App.tsx mounts (cleanup hooks)
T=15ms   Providers.tsx begins nesting (13 layers)
T=16ms   ColorModeScript + ColorModeProvider (localStorage read)
T=18ms   ThemeProvider (mode signal, isDark memo, theme store)
T=20ms   SettingsProvider (load schemas, init defaults)
T=25ms   SettingsEffects (3 effects: theme sync, reverse sync, fonts)
T=28ms   KeymapProvider (attach to window)
T=30ms   FocusProvider (event listeners)
T=32ms   FontZoomProvider (shortcuts)
T=35ms   FsProvider ◀═══════════════════════════════════════════════════════
         │
         ├─ createFsState() (6 sub-states)
         ├─ createFileCacheController() (IndexedDB async)
         ├─ useFileSelection(), makeTreePrefetch(), useDirectoryLoader()
         │
T=50ms   └─ onMount:
             ├─ restoreHandleCache() → primeFsCache()
             └─ refresh(DEFAULT_SOURCE):
T=60ms           ├─ ensureFs() → getRootDirectory() → createFs()
T=100ms          ├─ buildTree() (skip DEFERRED_SEGMENTS)
T=150ms          ├─ mergeSystemFolder()
T=160ms          ├─ batch { setTreeRoot, setActiveSource, setExpanded }
T=170ms          ├─ treePrefetchClient.init() (worker pool)
T=180ms          ├─ tryRestoreFromCache() (shapeFingerprint check)
T=190ms          ├─ seedTree() (background indexing starts)
T=200ms          ├─ ensureDirLoaded() for expanded paths
T=220ms          └─ selectPath(restorablePath)
                     └─ Triggers file loading chain
T=230ms  LayoutManagerProvider
T=235ms  FontRegistryProvider (resources + Suspense)
T=240ms  CommandPaletteProvider (registry + shortcuts)
T=245ms  UI Components (Toaster, Modal, CommandPalette, [DEV] Devtools)
T=250ms  Router resolves route
T=255ms  Main.tsx mounts (Fs, Terminal, StatusBar)
T=300ms  FIRST PAINT

         ASYNC BACKGROUND:
         ├─ IndexedDB opens (file-cache-v2, prefetch-cache)
         ├─ TreePrefetch workers indexing (ongoing)
         ├─ TreeSitter worker lazy init (on first file)
         ├─ Font resources loading (Suspense)
         └─ Service worker registration
```

---

## Statistics Summary

| Category | Count |
|----------|-------|
| createSignal | 141+ |
| createEffect | 141+ |
| createMemo | 292+ |
| createStore | 15+ major |
| createResource | 6+ |
| createContext | 25+ |
| Workers | 7 types |
| Cache Tiers | 5 |
| Provider Layers | 13 |
| Conditional Branches | 20+ |
| Deferred Segments | 9 |
| Error Recovery Strategies | 4 |

---

*Generated by comprehensive codebase analysis*
