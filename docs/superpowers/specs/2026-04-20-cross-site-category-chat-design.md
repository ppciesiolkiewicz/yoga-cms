# Cross-site category scope, richer chat history, analyses chat count

Date: 2026-04-20

## Summary

Three related UX changes across the analysis report pages:

1. The **category** scope in `ScopeActions` becomes request-wide: a category action (Copy/Chat) gathers data for that category across all sites in the analysis, not just the current site.
2. The **"Resume chat" dropdown** in `ChatDrawer` gets richer rows — title + relative date + tier chips — so previous chats are identifiable at a glance. Filter remains scoped to the current action's scope.
3. The **Past Analyses** table gains a **Questions** column showing the number of chat threads associated with each analysis.

## Motivation

- Users want to reason about a category (e.g. "pricing") across every site in the analysis without opening each site page individually. Today the category button is scoped to one site, which doesn't match the question they're asking.
- The current `<Select placeholder="Resume chat">` only shows the chat title. Users cannot tell which tiers a previous chat used, or how old it is.
- From the analyses index, there is no signal of which analyses have accumulated follow-up conversations.

## Non-goals

- No migration of existing per-site category chats to the new key. Old chats stay on disk, silently orphaned.
- No UI for filtering chats across scopes (e.g. showing site-scoped chats inside the category drawer). Scope-filtered list as today.
- No scope-kind chip in the dropdown, since every row matches the current button's scope by construction.

## Design

### 1. Category scope is cross-site

#### Type change

`scripts/analysis-context/types.ts`:

```ts
export type AnalysisContextScope =
  | { kind: "request"; requestId: string }
  | { kind: "site"; requestId: string; siteId: string }
  | { kind: "category"; requestId: string; categoryId: string; siteIds?: string[] }
```

`siteIds` is optional. Omitted → all sites in the request. The field exists for future UI but is not wired to any chooser in this change; callers today will not pass it.

#### Context builder

`scripts/analysis-context/build.ts`, category branch:

```ts
if (scope.kind === "category") {
  const req = await repo.getRequest(scope.requestId)
  const siteIds = scope.siteIds ?? req.sites.map(s => s.id)
  const bySite: Record<string, unknown> = {}
  for (const siteId of siteIds) {
    bySite[siteId] = await forCategory(
      repo, scope.requestId, siteId, scope.categoryId, tiers, missing
    )
  }
  json = { sites: bySite }
  if (tiers.input) json.input = req
}
```

`forCategory` is unchanged. Output shape for a category scope now mirrors the site-by-site shape used by the request scope, keyed by `siteId`.

#### Scope codec

`scripts/analysis-context/scope-codec.ts`:

- `encodeScope({ kind: "category", requestId, categoryId })` → `cat:{requestId}:{categoryId}`
- `decodeScope` accepts the 3-segment form `cat:{requestId}:{categoryId}`. The legacy 4-segment form (`cat:{req}:{site}:{cat}`) is **not** accepted. URLs or chat directories that used it become invalid and are ignored.
- `scopeKey({ kind: "category", ... })` → `cat-{categoryId}` (previously `site-{siteId}-cat-{categoryId}`).
- `siteIds` is not encoded in this change. If `siteIds` is present, callers must not rely on it surviving a codec roundtrip. (Currently no caller passes it.)

#### Scope labels

`src/components/ScopeActions/lib/scopeLabel.ts`:

- `scopeDescription({ kind: "category" })` → `"this category across all sites in this analysis"`
- `scopeShortLabel` unchanged (`"category"`).

#### Callers

`src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx:220-227`:

```tsx
<ScopeActions
  scope={{
    kind: "category",
    requestId: props.requestId,
    categoryId: props.categoryId,
  }}
/>
```

Drop `siteId` from the scope prop. The button still renders on each site page, but every render of the same `(requestId, categoryId)` refers to the same logical scope, and chat history is shared across site pages.

Grep for other call sites that construct a `"category"` scope — only `CategoryBlock` should produce them. If any other call site exists, drop `siteId` there too.

#### Storage impact

Chats for category scope will be written to `data/db/{requestId}/chats/cat-{categoryId}/`. Pre-existing directories under `chats/site-{siteId}-cat-{categoryId}/` remain on disk but will not be listed or resumable through the UI.

### 2. Richer previous-chats dropdown

`src/components/ScopeActions/components/ChatDrawer.tsx`.

Replace the `Select`-based `"Resume chat"` control with a `DropdownMenu` popover. Each row renders:

- **Title** — `ChatMeta.title` (already derived server-side from the first user message). Truncate visually at one line.
- **Relative date** — computed client-side from `ChatMeta.createdAt`. Format examples: `"just now"`, `"14m ago"`, `"3h ago"`, `"2d ago"`. Use a small helper (or `Intl.RelativeTimeFormat`); no new deps.
- **Tier chips** — one tiny chip per `true` tier in `ChatMeta.tiers`. Chip label is the tier's short name (`Report`, `Content`, `Tech`, `Lighthouse`, `Raw`, `Input`, `Progress`). Order follows `TIER_CODES` in `scope-codec.ts` for consistency with other tier UIs.

Layout per row (approximate):

```
Title of this chat (truncated)           2h ago
[Report] [Content]
```

Trigger button shows `"Resume chat"` or the current chat's title when a chat is active. Empty state (no previous chats): render no trigger (same as today — the condition `chats.length > 0` still gates visibility).

No API change. `/api/chat/list` already returns `ChatMeta[]` including `tiers`.

Behavior:
- Clicking a row calls existing `resumeChat(id)`.
- Filter remains scope-matched (backed by `listScopedChats(scope)`).
- `"New chat"` button behavior unchanged.

### 3. Questions column on Past Analyses

#### Repo

`scripts/db/repo.ts`: add

```ts
async countChats(requestId: string): Promise<number> {
  const dir = join(requestDir(this.root, requestId), "chats")
  if (!(await this.store.exists(dir))) return 0
  // Sum .json files across all scope subdirectories.
  let count = 0
  for (const sub of await this.store.listDirs(dir)) {
    const files = await this.store.listFiles(join(dir, sub))
    count += files.filter(f => f.endsWith(".json")).length
  }
  return count
}
```

Use whatever directory-listing primitives `store` already exposes (`readDir`, `listDirs`, etc.). If none exist, add the minimum needed primitive alongside this method. Do not reach into `fs` directly from `repo.ts` — keep the `store` boundary.

Extend `listRequests` to include `chatCount`:

```ts
async listRequests(): Promise<RequestIndexEntry[]> {
  // ...load entries as today...
  return Promise.all(
    entries.map(async e => ({
      ...e,
      status: await this.deriveStatus(e.id),
      chatCount: await this.countChats(e.id),
    }))
  )
}
```

Add `chatCount: number` to `RequestIndexEntry` (the in-memory return shape, not the stored index).

#### UI

`src/app/(main)/analyses/AnalysesTable.tsx`:

- Add `chatCount: number` to `AnalysisRow`.
- Add `<th className="px-4 py-3 text-center">Questions</th>` after the Categories header.
- Add `<td className="px-4 py-3 text-center">{req.chatCount}</td>` after the Categories cell.
- Update the Pending divider row `colSpan={5}` → `colSpan={6}`.

No change to `src/app/(main)/analyses/page.tsx` (it already passes through whatever `listRequests` returns).

## Data flow

Category Copy/Chat action → `useAnalysisContext(scope, tiers)` → `/api/analysis-context` → `buildAnalysisContext` walks all sites in the request and aggregates per-site category data → caller receives `{ sites: { [siteId]: {report, extractedContent, tech, ...} } }`.

Chat list for category scope → `/api/chat/list?scope=cat:{req}:{cat}` → `repo.listScopedChats(scope)` → reads `data/db/{req}/chats/cat-{cat}/*.json` → returns `ChatMeta[]` with `title`, `createdAt`, `model`, `tiers`.

Analyses index → `listRequests()` → per-entry `countChats(id)` → directory walk under `data/db/{id}/chats/**/*.json`.

## Error handling

- Missing chat directory on `countChats` → `0`. Does not throw.
- Legacy 4-segment `cat:…` scope encountered in a chat URL → `decodeScope` throws, same behaviour as any other malformed scope. Caller code already handles decode failure via standard error path.
- Empty `siteIds` (explicit `[]` passed to category scope) → produces `{ sites: {} }`. Not a bug; just no data.

## Testing

- Unit: `scope-codec` roundtrip for the new 3-segment category form; rejection of the legacy 4-segment form.
- Unit: `buildAnalysisContext` with a category scope across a request that has multiple sites — asserts `sites` keyed output and that `forCategory` was invoked once per site.
- Unit: `Repo.countChats` with a requestId that has zero, one, and multiple chat subdirs (mixed `.json`/non-json).
- Integration: `/api/chat/list` returns matching chats for the new category scope; unmatched legacy chats are not surfaced.
- Manual: on a report page with multiple sites, open the category chat button on site A, start a chat; open the same category on site B, verify the chat is resumable from the dropdown.
- Manual: Past Analyses table shows a Questions column whose count reflects threads under `chats/**/*.json`.

## Rollout

Single merge. Dev-local data only; accept orphaned legacy category chats.
