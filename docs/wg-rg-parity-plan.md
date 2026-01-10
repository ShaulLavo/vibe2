# wg vs rg CLI Parity Plan

This plan targets full CLI parity for the `wg` command (just-bash adapter) with ripgrep (`rg`), while keeping strict performance goals and adding regex support. It focuses on literal path usage, streaming output, and low-latency UX in the web terminal.

## Principles

- Prefer literal, resolved paths whenever possible (avoid path globbing when a literal path is provided).
- Keep performance as a first-class requirement (streaming, minimal allocations, small critical paths).
- Add regex support without regressing literal search performance (fast path for fixed strings).
- Keep behavior aligned with `rg` semantics and exit codes.
- Instrument expensive operations and expose debug logs for tuning.

## Parity Gaps Summary

- Regex support (default regex, `-F` fixed strings, `-P` PCRE if feasible).
- CLI flag mismatches (notably `-n` meaning max results instead of line numbers).
- Ignore logic (.gitignore/.ignore/.rgignore, git info/exclude, global ignores).
- Glob semantics (full gitignore-style globs, path-aware matching).
- Binary handling (`--binary`, `-a/--text`, `--no-mmap` analogs as applicable).
- Encoding handling (`--encoding`, BOM sniffing, `--no-encoding` equivalent).
- Output formatting (context blocks, `--heading`, `--line-number`, `--column`).
- Replacement output (`--replace`, capture groups).
- Type system (`--type-list`, `--type-add`, `--type-not`, `--type all`).
- Config file support (`RIPGREP_CONFIG_PATH`, `--no-config`).
- Preprocessors (`--pre`, `--pre-glob`).
- Archive/zip search (`-z/--search-zip`) if in scope for browser FS.

## Implementation Plan

### 1) CLI Contract & Help

- Define a compatibility matrix for each `rg` flag: supported, partial, unsupported.
- Align `wg` CLI flags with `rg` semantics.
- Fix `-n` to match `rg` (line numbers) and move max-results to `-m/--max-count`.
- Update `wg --help` output to mirror `rg`'s option groupings and descriptions.
- Add warnings for unsupported flags instead of silent acceptance.

### 2) Path Handling & Search Scope

- Prefer literal paths when given (explicit file or directory) before recursion.
- Make path resolution consistent between the shell adapter and the FS layer.
- Ensure paths shown in output are literal/relative to search root (match `rg`).
- Support `--files` and `--files-without-match` parity.

### 3) Regex Engine Integration

- Add a regex engine suitable for browser/Bun runtime:
  - Fast path for fixed-string search (current byte matcher) when `-F` or no regex needed.
  - Regex path for default behavior, with Unicode support parity where feasible.
- Define compilation cache keyed by pattern + flags (case, unicode, multiline).
- Respect `-S/--smart-case`, `-i/--ignore-case`, `-U/--multiline`.
- Ensure `-o/--only-matching` uses regex capture spans when regex is enabled.

### 4) Ignore & Glob Semantics

- Implement full gitignore-style glob matching (path-aware, `**`, `!` negations).
- Load ignore sources:
  - `.gitignore`, `.ignore`, `.rgignore`.
  - Git info/exclude and global excludes if accessible in the browser sandbox.
- Implement `--no-ignore`, `-u/--unrestricted` stacking semantics.
- Support `--hidden` and integrate with ignore logic.

### 5) Type Filters

- Expand type definitions to match `rg --type-list` for common types.
- Add `--type-add` and `--type-clear` in session scope.
- Implement `--type all` and `--type-not` semantics.
- Type filters must be path-aware, not just filename suffix.

### 6) Output Formatting & Context

- Implement `--line-number`, `--column`, `--heading`, `--color` options.
- Emit context blocks with separators and line prefixes consistent with `rg`.
- Support `--max-columns` and `--max-columns-preview`.
- Ensure match highlighting aligns with regex spans.

### 7) Binary & Encoding Behavior

- Add `--text` and `--binary` modes with explicit behavior.
- Add encoding handling (`--encoding`), BOM sniffing, and `--encoding none`.
- Keep a fast path for UTF-8/plain text.

### 8) Replacement Output

- Implement `--replace` using regex captures.
- Support named captures and `$1`-style references.
- Ensure `--replace` integrates with `--only-matching`.

### 9) Preprocessors & Archives (If in Scope)

- Add `--pre` and `--pre-glob` hooks for per-file transformation.
- If feasible, add archive search (`-z/--search-zip`) with streaming.

### 10) Performance & Observability

- Keep worker-based streaming; avoid full enumeration when possible.
- Use chunked regex scanning with overlap aware of multiline patterns.
- Add caches for ignore rules and compiled regexes.
- Instrument:
  - file enumeration
  - pattern compilation
  - per-file scan time
  - bytes scanned
- Add optional debug logging toggles (per existing logger utilities).

### 11) Tests & Fixture Parity

- Add unit tests for:
  - regex features (`\w`, groups, unicode, multiline)
  - ignore rules and globs
  - output formatting
  - exit codes
- Add fixture repos matching `rg` examples and compare outputs.
- Keep tests deterministic and fast.

## Open Questions / Decisions Needed

- Which regex engine is acceptable in browser runtime (size/perf tradeoff)?
- Is full `rg` ignore stack feasible in browser FS (global git excludes, etc.)?
- Do we need archive search and preprocessors in the web client?
- How strict should output parity be (colors, headings, context separators)?

## Suggested Milestones

- M1: CLI flag parity + help output + exit codes.
- M2: Regex engine + fixed-string fast path + basic output parity.
- M3: Ignore/glob/type parity.
- M4: Context/replace/encoding/binary parity.
- M5: Preprocessors/archives (if in scope) + perf tuning + tests.
