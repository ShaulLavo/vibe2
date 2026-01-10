# Git Repo Persistence + Status Plan

## Goals

- Persist full Git metadata (.git) alongside the working tree.
- Detect Git repos during indexing (not only at clone time).
- Keep .git and working tree in sync with 1:1 Git behavior.
- Show current Git status in the terminal prompt.

## Current State

- Worker clones into a memory FS and only writes the working tree to VFS.
- .git is skipped, so no local Git metadata exists after clone.
- Settings/terminal have no repo awareness.

## Proposed Architecture

- Git data stays in the repo root as .git (1:1 with standard Git).
- A Git repo registry caches repo roots and status metadata keyed by path.
- Status and refs are read via isomorphic-git using VFS (no internal APIs).
- UI tree hides .git by default but it stays on disk for Git operations.

## Plan (Phased)

### Phase 1: Persist .git on Clone

1. Extend the git worker to stream both:
   - working tree files
   - .git directory contents
2. Add a `persistGitDir` flag to clone calls (default true).
3. In `gitService`, write .git files through FsProvider actions so caches stay in sync.
4. Ensure .git stays hidden from the file tree UI (filter, not deletion).

### Phase 2: Detect Repos During Indexing

1. Update `treePrefetch.worker.ts` to detect:
   - `.git` directory
   - `.git` file (worktrees/submodules)
2. Emit repo root metadata (new callback or extend deferred metadata payload).
3. Store repo roots in a Git repo registry keyed by path.
4. Mark nested repo roots so parent repos treat them as opaque subtrees.

### Phase 3: Load + Sync Git Metadata

1. On discovery, resolve gitdir and read:
   - current branch
   - HEAD SHA
2. Listen for FS changes via FsProvider actions and schedule status refreshes.
3. Throttle status refresh to avoid prompt stalling.
4. Use statusMatrix for dirty state; do not walk .git manually.

### Phase 4: Terminal Prompt Integration

1. Add a Git prompt service that:
   - finds the nearest repo root from cwd
   - returns { branch, dirty, ahead, behind } from cache
2. Prompt formatting example: `repo (main*)` or `repo [main*]`.
3. Update prompt asynchronously; never block command execution.

### Phase 5: Nested Repos and Worktrees

1. If a nested .git exists, treat it as a separate repo root.
2. If `.git` is a file, resolve `gitdir:` pointer to the actual metadata path.
3. For submodules:
   - respect `.gitmodules` and `.git` file linking
   - show submodule status as dirty/clean in parent repo (later phase).

## Debugging + Perf

- Use `console.log` with `JSON.stringify(data, null, 2)` for debug.
- Wrap expensive status refreshes with @repo/perf if needed.

## Open Questions

1. Prompt format preference (branch only vs branch + dirty + ahead/behind).
2. Should .git remain fully hidden or optionally visible via a toggle?
3. Cache scope: in-memory only or persisted under `/.system/git-cache`?
