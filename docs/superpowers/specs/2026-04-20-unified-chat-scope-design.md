# Unified chat scope and shared drawer

Date: 2026-04-20

## Summary

Rework the chat system around a single shared drawer and a fully-enumerated context shape. Scope becomes an explicit list of site×category pairs — no implicit "all", no scope kinds. Chat buttons (request / site / category) are preset shortcuts; all of them open the same drawer, which shows one scope-agnostic history list per request. Once a chat has at least one message, its context is frozen. Existing chat data is wiped on rollout.

## Motivation

Today's model has three concerns tangled together:
1. Scope is a discriminated union (`request | site | category`) with implicit aggregation inside each kind.
2. Chat history is scope-filtered — each button surfaces only chats that match, making prior conversations hard to find.
3. Buttons both preset context and filter history, which means picking context and browsing history are coupled.

This rework:
- Makes scope fully explicit so the UI and future DB migration can reason about exact context without implicit defaults.
- Makes chat history independent of the button clicked, so every chat is one click away.
- Treats preset buttons as shortcuts into a Configure modal, not separate navigation destinations.

## Non-goals

- No change to the Copy button's position, presets, or visual behavior — only its internal scope shape updates.
- No migration of existing chat data. All `data/db/*/chats/` contents are deleted on rollout (user-approved; dev-local data).
- No cross-request history (each analysis has its own list).
- No reuse of a locked chat's scope as a template for a new chat (create a new chat from a preset button instead).

## Design

### 1. Scope shape

```ts
export type AnalysisContextScope = {
  requestId: string
  contextElements: { siteId: string; categoryId: string }[]
}
```

- Replaces the current discriminated union (`request | site | category`).
- `contextElements` is fully enumerated. Empty array is a valid state but produces no context data; the Configure UI requires ≥1 element before enabling "Start chat" / "Copy".
- Frozen per chat: when a chat is created, its scope is stored in the `ChatRecord`. Subsequent additions of sites or categories to the request do not affect existing chats.
- No `kind` discriminator. No implicit "all".

### 2. Chat storage and IDs

- Path: `data/db/{requestId}/chats/{chatId}.json`. Flat — no scope subdirectories.
- `chatId` = `crypto.randomUUID()` (UUID v4). Existing ID schema for requests/sites is unchanged. Only chats migrate to UUIDs.
- `ChatRecord` adds `scope: AnalysisContextScope` (snapshot at creation).
- Pre-merge cleanup: `rm -rf data/db/*/chats/`. No migration of old records.

Repo API (new surface):

```ts
class Repo {
  createChat(requestId: string, init: { scope: AnalysisContextScope; model: string; tiers: AnalysisContextTiers; title: string }): Promise<ChatRecord>
  getChat(requestId: string, chatId: string): Promise<ChatRecord>
  listChats(requestId: string): Promise<ChatMeta[]>
  appendChatMessage(requestId: string, chatId: string, msg: ChatMessage): Promise<void>
}
```

Old scope-keyed methods (`createScopedChat`, `getScopedChat`, `listScopedChats`, `appendScopedChatMessage`) are deleted.

`Repo.countChats(requestId)` (introduced earlier for the "Questions" column) still works — it already walks `chats/**/*.json` and the flatter layout produces correct counts.

### 3. Drawer UI

One shared `ChatDrawer` instance per report page. All preset buttons open it; none of them render their own drawer instance.

Layout (within the existing `<Sheet>`):

- **Header bar**
  - Title "Chat"
  - `Configure` button — opens the Configure modal
  - `New chat` button — clears active chat, resets to draft state, preselects the last-used preset or the button-preset if the drawer was opened via a button click with a preset
  - Model picker (existing `<Select>`)
- **Body (two panes)**
  - Left pane (history list): all chats for the current request, scope-agnostic, most recent first. Rows show title + relative date + tier badges (same component currently used as `ChatHistoryMenu`, now always-listed rather than a dropdown).
  - Right pane (active chat): messages + composer. Same layout as today's drawer body.

**Draft vs active chat:** a *draft* is the pending state before the first message is sent — scope + tiers are configured but no `ChatRecord` exists yet. *Active* = the currently selected persisted chat with ≥0 messages.

Preset click behavior (unified rule, no special cases):
- Clicking any preset button **always** opens the drawer and starts a new draft seeded with that button's preset (scope + tiers). The previously active chat becomes deselected but is persisted and reachable via the left history pane.
- No confirmation prompt. Losing a draft (which has no messages) is cheap; losing an active chat is impossible because it was already persisted.

### 4. Configure modal

Replaces today's `ComposeModal` flow for chat. Copy still uses a structurally identical modal (separate instance — different footer action) so the two flows stay parallel.

Contents:
- **Scope picker**: a site×category matrix. Rows = sites, columns = categories. Cells = checkboxes representing `{siteId, categoryId}` pairs. Row and column headers include "select all in row/col" checkboxes; corner cell selects everything.
- **Tier picker**: existing toggles (Report, Content, Tech, Lighthouse, Raw pages, Input, Progress). Missing-for-scope tiers remain toggleable with a strikethrough (keeps the current UX behavior added in commit `5ed41b0`).
- **Live preview**: byte count + pretty JSON pane driven by `useAnalysisContext` against `POST /api/compose`. Matches today.
- **Footer**:
  - Chat mode: `Start chat` (enabled when ≥1 contextElement and ≥1 tier). Cancels with `Close`.
  - Copy mode: `Copy JSON` (same enable rule).
- **Read-only mode**: when the active chat in the drawer has ≥1 message, opening Configure shows the matrix + tier toggles all disabled. Footer shows `Close` only. Intent: users can still see what context this conversation runs on.

### 5. API

All endpoints below live under `src/app/api/`.

- `POST /api/compose` — body `{ scope, tiers }`. Returns `AnalysisContext`. The old `GET /api/compose?scope=…&tiers=…` is deleted.
- `GET /api/chat/list?requestId=X` — returns `ChatMeta[]` for that request. Scope no longer in the query.
- `GET /api/chat/get?requestId=X&chatId=Y` — returns `ChatRecord`. Scope no longer in the query.
- `POST /api/chat` — body `{ requestId, chatId?, model, userMessage, scope?, tiers? }`.
  - New chat: `chatId` absent → `scope` and `tiers` required; server creates via `Repo.createChat` and returns the generated chatId on the stream's first event.
  - Existing chat: `chatId` present → `scope`/`tiers` ignored server-side (locked by the stored record).

Client:
- `useAnalysisContext(scope, tiers)` — now issues POST with a JSON body instead of building a query string.
- `ChatDrawer` — fetches history once per open via `GET /api/chat/list?requestId=…`.
- `ChatHistoryMenu` — no longer used as a dropdown; its row renderer is extracted into a `ChatHistoryRow` component consumed by the new always-listed left pane. If the dropdown component has no other consumers after the change, delete it.

### 6. Codec retirement

Delete:
- `scripts/analysis-context/scope-codec.ts`
- `scripts/analysis-context/scope-codec.test.ts`
- All call sites that import `encodeScope` / `decodeScope` / `scopeKey` / `encodeTiers` / `decodeTiers`.

Grep surfaces today (must be purged):
- `scripts/db/repo.ts` — `scopeKey` used in chat-dir path; replaced by flat path.
- `src/components/ScopeActions/lib/useAnalysisContext.ts` — `encodeScope` + `encodeTiers` for GET; switches to POST.
- `src/components/ScopeActions/components/ChatDrawer.tsx` — same.
- `src/app/api/compose/route.ts`, `src/app/api/chat/list/route.ts`, `src/app/api/chat/get/route.ts` — `decodeScope` / `decodeTiers`; switch to body / direct query.

After the change, no file references the codec. If `scope-codec.ts` still has callers, the refactor is incomplete.

### 7. Button presets

Locations unchanged — three preset buttons:
- Request (SitesSidebar): `contextElements` = all sites × all categories.
- Site (PageNav): `contextElements` = that site × all categories.
- Category (CategoryBlock): `contextElements` = all sites × that category.

Each button's internal dropdown keeps its three-item menu:
- `Report` — preset tiers `{ report: true }`, opens drawer with draft.
- `Content` (or "Extracted content" on the category button's default) — preset tiers `{ extractedContent: true }`, opens drawer with draft.
- `Configure…` — opens Configure modal directly with the preset `contextElements` and an empty tier set.

Copy buttons mirror the same three-item menu but trigger the Copy modal / copy action instead of the drawer.

## Data flow

New chat: button click → drawer opens → preset loaded into Configure state → user confirms → `POST /api/chat` with `{requestId, scope, tiers, model, userMessage}` → server calls `Repo.createChat` to persist `scope` + `tiers` + metadata, then streams the assistant reply. Subsequent messages POST with `{requestId, chatId, userMessage}` only.

History: drawer open → `GET /api/chat/list?requestId=X` → left pane renders rows → click → `GET /api/chat/get?requestId=X&chatId=Y` → right pane populates.

Context assembly: Configure modal tier/matrix changes → `useAnalysisContext({scope, tiers})` → `POST /api/compose` with JSON body → server runs `buildAnalysisContext(repo, scope, tiers)` → returns `AnalysisContext`.

`buildAnalysisContext` body (rewritten):

```ts
export async function buildAnalysisContext(
  repo: Repo,
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers,
): Promise<AnalysisContext> {
  const missing: string[] = []
  const req = await repo.getRequest(scope.requestId)
  const sites: Record<string, Record<string, unknown>> = {}
  for (const { siteId, categoryId } of scope.contextElements) {
    const perCat = await forCategory(repo, scope.requestId, siteId, categoryId, tiers, missing)
    sites[siteId] = sites[siteId] ?? {}
    sites[siteId][categoryId] = perCat
  }
  const json: Record<string, unknown> = { sites }
  if (tiers.input) json.input = req
  const bytes = Buffer.byteLength(JSON.stringify(json))
  return { scope, tiers, json, bytes, missing: Array.from(new Set(missing)) }
}
```

`forCategory` / `forSite` / `addRawPages` helpers keep their existing signatures. `forSite` is now unused by `buildAnalysisContext` but remains exported for any future non-scoped callers — mark it `@internal` if nothing references it after grep.

## Error handling

- Empty `contextElements` on `POST /api/compose` → return `{ json: { sites: {} }, bytes: N, missing: [] }`. UI disables "Start chat" so the empty case shouldn't reach the server, but the server must not crash either.
- `POST /api/chat` with a new chat and empty `scope.contextElements` → 400.
- `POST /api/chat` with a `chatId` that doesn't exist → 404.
- Any scope referencing unknown `siteId` or `categoryId` (e.g. the request was edited between modal open and submit) → skip that pair in the builder and push the pair's composite key into `missing`. Do not error.

## Testing

- Unit: `buildAnalysisContext` with empty, single-pair, and multi-pair `contextElements`. Confirm matrix-shaped output `{ sites: { [siteId]: { [categoryId]: …} } }` and top-level `input` when tier set.
- Unit: `Repo.createChat`, `listChats`, `getChat`, `appendChatMessage` over the new flat path.
- Unit: new chats get a UUID-formatted id (regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`).
- Integration: `POST /api/compose` accepts JSON body and rejects bodies missing `requestId`.
- Integration: `POST /api/chat` new-chat path persists scope and tiers, returns a chatId via stream event.
- Integration: `POST /api/chat` resume path ignores client-sent scope/tiers.
- Manual: each preset button opens the same drawer; history list shows all chats regardless of button clicked; Configure modal enters read-only mode after the first message.

## Rollout

Single merge on the feature branch. Steps in commit order:

1. New scope type + rewrite `buildAnalysisContext`; update `compose` route to POST body; update `useAnalysisContext` to POST.
2. Repo scope-agnostic chat methods + UUID ids + delete old scoped chat methods. Cleanup step: `rm -rf data/db/*/chats/` on the host machine before running the server (user-approved).
3. New `/api/chat/list`, `/api/chat/get`, `/api/chat` request-scoped API surface. Delete codec.
4. Drawer UI refactor: shared drawer, left history pane, draft/preset state machine.
5. Configure modal with site×category matrix + read-only mode.
6. Preset wiring (SitesSidebar, PageNav, CategoryBlock) to emit the new `contextElements`.

Each step should keep the repo buildable. Type errors during intermediate commits are permitted only within the commit that lands the next step that fixes them — same pattern as the prior cross-site refactor.
