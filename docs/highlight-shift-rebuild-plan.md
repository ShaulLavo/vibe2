# Highlight Shift Rebuild Plan

## Background

We recently added `lineId` to solve a different bug, but it had a huge unexpected benefit:
**Editing a line no longer affects any other lines**.

Because line identity is now stable via `lineId`, we can **completely drop the complex global offset/shifting logic**. The only shifting that might be needed is simple **per-line column adjustments** when editing within a line, but even that is optional—we can just wait for the next highlight snapshot.

## Current State

### What we have now (overcomplicated):

- `highlightOffset?: Accessor<HighlightOffsets | undefined>` - tracks pending edit deltas
- `mapRangeToOldOffsets()` - maps new positions back to old positions
- `toShiftOffsets()` - calculates shift amounts per line
- `applyShiftToSegments()` - shifts segment boundaries
- `applyOffsetToSegments()` / `applyOffsetsToHighlight()` - complex offset application
- Spatial index with chunk buckets for lookup performance
- Multi-layer caching: `highlightCache`, `dirtyHighlightCache`, `precomputedCache`
- Intersection detection logic to decide when to apply offsets

### Why this is overkill with `lineId`:

With stable line identity:

1. **Non-edited lines**: Their highlights are indexed by `lineId`—never need shifting
2. **Edited lines**: They get new highlights from tree-sitter quickly; we can show stale highlights briefly or blank

The entire "global offset dance" was designed for a world where inserting/deleting text in line 5 shifted all highlights for lines 6+ by a delta. **That's no longer true**.

---

## Simplified Plan

### Goal

Replace the complex offset-shifting pipeline with a simple **lineId-keyed cache** that:

1. Keeps highlights stable for non-edited lines (via `lineId` lookup)
2. Shows last-known-good highlights for edited lines until the next snapshot
3. Removes all global offset tracking and shifting logic

### Design

#### 1. Data Flow (Simplified)

```
Tree-sitter snapshot arrives
         ↓
precomputeSegments(lineEntries, highlights)
         ↓
lineSegmentsByLineId: Map<lineId, LineHighlightSegment[]>
         ↓
getLineHighlights(lineEntry) → lookup by lineId → return cached segments
```

#### 2. Key Changes to `createLineHighlights.ts`

**Remove:**

- [ ] `highlightOffset` option entirely
- [ ] `getValidatedOffsets()`
- [ ] `toShiftOffsets()`
- [ ] `applyShiftToSegments()`
- [ ] `dirtyHighlightCache` (no more "dirty" state)
- [ ] `validatedOffsetsRef`, `lastOffsetsRef`
- [ ] Intersection detection logic (`hasIntersectingOffsets`)
- [ ] The `mapRangeToOldOffsets` calls and old-coordinate lookups
- [ ] Complex conditional paths based on `hasOffsets`

**Simplify:**

- [ ] `precomputedSegments` → becomes the **primary** path (not fallback)
- [ ] `getLineHighlights(entry)` → simple `lineId` lookup with fallback to index
- [ ] Keep spatial index only if we need lazy per-line computation for visible lines

**Keep (simplified):**

- [ ] `lineSegmentsByLineId: Map<lineId, LineHighlightSegment[]>` - the cache
- [ ] LRU eviction for memory bounds
- [ ] `mergeLineSegments()` for combining syntax + error highlights

#### 3. New `getLineHighlights` Logic

```typescript
const getLineHighlights = (entry: LineEntry): LineHighlightSegment[] => {
	const lineId = entry.lineId > 0 ? entry.lineId : entry.index

	// Check cache first
	const cached = lineSegmentsByLineId.get(lineId)
	if (cached) {
		return cached
	}

	// Fallback: compute from snapshot for this line
	// (This happens first render or after cache eviction)
	const segments = computeSegmentsForLine(entry)
	lineSegmentsByLineId.set(lineId, segments)
	return segments
}
```

#### 4. Snapshot Refresh

When tree-sitter delivers a new snapshot:

1. Rebuild `lineSegmentsByLineId` from scratch (or selectively update changed lines)
2. All lines automatically get fresh highlights on next render
3. No shifting, no offsets, no complex state management

### What Happens During Editing

| Scenario             | Behavior                                                        |
| -------------------- | --------------------------------------------------------------- |
| User types in line 5 | Line 5 shows stale highlights until next snapshot (acceptable)  |
| User inserts newline | New line has no cached segments → shows blank or computes fresh |
| User deletes newline | Merged line uses one of the original line's cached segments     |
| Tree-sitter update   | All lines refresh from new snapshot via `lineId`                |

### Optional: Per-Line Heuristics (Phase 2)

If we want the edited line to stay highlighted during typing, we can add simple **per-line** heuristics later:

```typescript
// When editing within a line, shift column offsets locally
const adjustSegmentsForEdit = (
	segments: LineHighlightSegment[],
	editColumn: number,
	charDelta: number
): LineHighlightSegment[] => {
	return segments
		.map((seg) => ({
			...seg,
			start: seg.start >= editColumn ? seg.start + charDelta : seg.start,
			end: seg.end > editColumn ? seg.end + charDelta : seg.end,
		}))
		.filter((seg) => seg.end > seg.start)
}
```

This is **much simpler** than global offset tracking because:

- It's per-line only
- It uses column offsets (0 to lineLength), not global document offsets
- It only needs to handle insert/delete within that specific line

---

## Implementation Steps

### Phase 1: Remove Global Offset Logic (This PR)

1. **Remove offset option and callers**
   - [ ] Remove `highlightOffset` from `CreateLineHighlightsOptions`
   - [ ] Remove `highlightOffset` from `TextEditorViewProps`
   - [ ] Remove `setHighlightOffsets` calls from input handlers

2. **Simplify `createLineHighlights.ts`**
   - [ ] Remove `getValidatedOffsets`, `toShiftOffsets`, `applyShiftToSegments`
   - [ ] Remove all offset-related conditionals
   - [ ] Simplify to: cache lookup → compute if needed

3. **Remove utility functions from `highlights.ts`**
   - [ ] Remove `mapRangeToOldOffsets`, `mapRangeToOldOffset`, `mapBoundaryToOld`
   - [ ] Remove `applyOffsetToSegments`, `applyOffsetsToHighlight`
   - [ ] Remove `HighlightShiftOffset` type

4. **Update tests**
   - [ ] Update `createLineHighlights.test.ts` - remove offset-related tests
   - [ ] Update `LineRow.highlightOffsets.browser.test.tsx` - focus on stability

### Phase 2: Optional Per-Line Polish (Future)

1. Add simple per-line column shifting for edited lines (if needed)
2. Add tests for single-line edit heuristics
3. Tune UX for typing experience

---

## Files to Modify

| File                                        | Changes                                     |
| ------------------------------------------- | ------------------------------------------- |
| `createLineHighlights.ts`                   | Major simplification - remove offset logic  |
| `createLineHighlights.test.ts`              | Remove offset tests, add simple cache tests |
| `highlights.ts`                             | Remove offset utilities                     |
| `types.ts`                                  | Remove `HighlightOffsets` type if unused    |
| `TextEditorView.tsx`                        | Remove `highlightOffset` prop               |
| `createTextEditorInput.ts`                  | Remove `setHighlightOffsets` calls          |
| `LineRow.highlightOffsets.browser.test.tsx` | Simplify or rename/restructure              |

---

## Risks & Mitigations

| Risk                                       | Mitigation                                       |
| ------------------------------------------ | ------------------------------------------------ |
| Edited line briefly shows stale highlights | Acceptable UX; tree-sitter is fast enough        |
| Line flashes blank on newline insert       | Compute highlights eagerly for new lines         |
| Cache memory on large files                | Keep LRU eviction (already exists)               |
| Breaking existing behavior                 | Comprehensive test coverage before removing code |

---

## Success Criteria

- [ ] All existing highlight tests pass (after updating for new design)
- [ ] Highlights remain stable on non-edited lines
- [ ] No visible regression in typing feel on TS/JS files
- [ ] Codebase is ~200-300 lines lighter (remove offset complexity)
- [ ] Much easier to reason about highlight pipeline
