# View Mode Feature

## Goal

Implement a **view mode system** for file tabs. Files can have multiple view modes (e.g., JSON editor vs UI view). Same file opens in different modes as separate tabs.

## Key Files

- `apps/web/src/fs/components/SelectedFilePanel.tsx` - renders editor/settings based on view state
- `apps/web/src/fs/components/Tabs.tsx` - tab bar component
- `apps/web/src/fs/hooks/useSettingsViewState.ts` - current settings view toggle (`isJsonView` signal)
- `apps/web/src/fs/hooks/useSelectedFileTabs.ts` - tab state management
- `apps/web/src/fs/context/FsContext.tsx` - FS context with selected path
- `apps/web/src/command-palette/builtinCommands.ts` - settings commands

## Implementation

1. **Extend tab state** to include `viewMode` alongside `path` (e.g., `{ path: string, viewMode: 'editor' | 'ui' | 'binary' }`)
2. **Add view mode toggle button** - small, slick button in tab bar or editor header to switch modes for current file
3. **Settings file**:
   - `editor` mode → JSON editor (default)
   - `ui` mode → SettingsTab component
4. **Binary files**:
   - `editor` mode → hex/text view
   - `binary` mode → BinaryFileViewer component
5. **Commands**: "Open Settings" and "Open Settings (UI)" open same file in different view modes as separate tabs

## Current State

- Settings already has `SettingsTab` (UI) and regular editor (JSON) - currently toggled via `isJsonView` signal
- `BinaryFileViewer` component exists but is commented out in `SelectedFilePanel.tsx`
