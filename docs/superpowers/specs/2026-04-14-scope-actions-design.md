# Scope Actions — Copy & Chat for Category / Site / Request

**Date:** 2026-04-14
**Status:** Design approved, pending implementation plan.
**Branch / worktree:** `feature/scope-actions` at `.worktrees/scope-actions`

## Problem

Report users viewing an analysis need two things:

1. Copy the data underlying a category, site, or the entire request to use in external tools.
2. Open a chat about that same slice, backed by a Claude model, to ask questions grounded in the analysis output.

Today neither is possible without manually opening `data/db/` JSON files.

## Goals

- Every category block, site page, and request page surfaces a pair of actions: Copy and Chat.
- Both actions operate on three scopes, determined by insertion point:
  - **Category** — one category on one site
  - **Site** — one site, all categories
  - **Request** — all sites, all categories
- Copy offers three tiers: **Report** (just `build-report.json`), **Content** (just `extract-pages-content`), **Configure** (modal with granular toggles + live JSON preview).
- Chat offers the same three tiers as a pre-open picker. Once chat starts, context is locked.
- Chats persist per scope under `data/db/` so the user can resume.
- Only Claude models (Opus 4.6, Sonnet 4.6, Haiku 4.5) are offered.

## Non-goals

- No OpenAI / Gemini / other-provider integration in this iteration.
- No mid-conversation context switching.
- No download-as-file button (copy-only for this iteration).
- No cross-request context (each chat is bound to a single scope within one request).

## Architecture

### New module — `scripts/analysis-context.ts`

Single source of truth for turning `(scope, tiers) → JSON payload`. Shared by the copy UI, the Configure modal preview, and the chat context builder.

**Exports:**

```ts
export type AnalysisContextScope =
  | { kind: 'request'; requestId: string }
  | { kind: 'site'; requestId: string; siteId: string }
  | { kind: 'category'; requestId: string; siteId: string; categoryId: string };

export type AnalysisContextTiers = {
  report?: boolean;
  extractedContent?: boolean;
  tech?: boolean;
  lighthouse?: boolean;
  rawPages?: boolean;
  input?: boolean;
  progress?: boolean;
};

export type AnalysisContext = {
  scope: AnalysisContextScope;
  tiers: AnalysisContextTiers;
  json: Record<string, unknown>;
  bytes: number;
  missing: string[]; // artifact keys unavailable for this scope
};

export function buildAnalysisContext(
  repo: Repo,
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers
): Promise<AnalysisContext>;

export function buildReportContext(repo: Repo, scope: AnalysisContextScope): Promise<AnalysisContext>;
export function buildExtractedContentContext(repo: Repo, scope: AnalysisContextScope): Promise<AnalysisContext>;

export function chunkAnalysisContext(ctx: AnalysisContext, maxBytes?: number): string[];
```

Default chunk budget: **150 KB** per chunk. Never splits mid-key — chunks at top-level object entries of `json`, falling back to per-page subdivision if a single entry exceeds budget.

### New module — `scripts/chat.ts`

Wraps the Anthropic SDK. Not called directly from React — only from the `/api/chat` route.

```ts
export const SUPPORTED_CHAT_MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
] as const;

export async function* streamScopedChat(params: {
  model: string;
  context: AnalysisContext;
  history: ChatMessage[];
  userMessage: string;
}): AsyncIterable<ChatStreamEvent>;
```

Context delivery strategy when `chunkAnalysisContext` returns N > 1 chunks:

1. Prepend system message:
   > "Analysis context for {scope description} is delivered across {N} consecutive messages. Reply with `ok` after each until you receive `END-OF-CONTEXT`, then answer normally."
2. Send N user messages, each `"Context part k/N:\n\n<chunk>"`, with prefilled assistant replies `"ok"` for all but the last.
3. Send `"END-OF-CONTEXT"` user message, assistant replies `"ok"`.
4. Append user's real question.

For single-chunk payloads, inline into the system prompt directly — no preamble.

### New API routes

- `GET /api/compose?scope=<scope>&tiers=<tiers>` — returns `AnalysisContext` JSON for copy and modal preview. Scope/tiers serialized as compact query params. Supports `AbortSignal` on the server side by wiring `request.signal` through `Repo` reads.
- `POST /api/chat` — body `{ scope, tiers, model, chatId?, userMessage }`. If `chatId` omitted, creates new chat. Builds context once, streams response via SSE, persists user + assistant messages via `Repo`.

### Repo extensions (`scripts/db/repo.ts`)

New methods, storage at `data/db/requests/<requestId>/chats/<scopeKey>/<chatId>.json`:

```ts
listScopedChats(scope: AnalysisContextScope): ChatMeta[];
getScopedChat(scope, chatId): ChatRecord;
createScopedChat(scope, meta: { model, tiers, title }): ChatRecord;
appendScopedChatMessage(scope, chatId, msg: ChatMessage): void;
```

`scopeKey` canonicalisation: `all` for request, `site-<siteId>` for site, `site-<siteId>-cat-<categoryId>` for category.

### UI components

All under `src/components/ScopeActions/`:

```
ScopeActions/
  index.ts
  ScopeActions.tsx            # public: renders CopyMenu + ChatMenu side-by-side
  components/
    CopyMenu.tsx              # dropdown: Report | Content | Configure
    ChatMenu.tsx              # dropdown: Report | Content | Configure → opens ChatDrawer
    ComposeModal.tsx          # 4 toggles + textarea preview + Copy/Start-chat button
    ChatDrawer.tsx            # right-side drawer, chats list, active chat, streaming input
  lib/
    useAnalysisContext.ts     # debounced client hook calling /api/compose
    scopeLabel.ts             # "Restaurant finder / homepage" etc.
```

`ScopeActions` accepts `{ scope: AnalysisContextScope }` and nothing else. All data flows through API routes.

### Insertion points

- `src/app/(report)/analyses/[requestId]/page.tsx` — top header, request scope.
- `src/app/(report)/analyses/[requestId]/[siteId]/SitesSidebar.tsx` — sidebar footer, request scope.
- `src/app/(report)/analyses/[requestId]/[siteId]/PageNav.tsx` — under the floating right nav, site scope.
- `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx` — each category block header, category scope.

## Data flow

### Copy (Report / Content preset)

1. Click → `useAnalysisContext` fires `/api/compose?scope=…&tiers=report` (or `…=content`).
2. Server runs `buildReportContext` / `buildExtractedContentContext`.
3. Client writes `JSON.stringify(ctx.json, null, 2)` to clipboard; shows toast with byte count.

### Copy (Configure)

1. Click → `ComposeModal` opens with all toggles off.
2. Each toggle change debounced 250 ms; fires `/api/compose` with current tier mask.
3. Previous in-flight request aborted via `AbortController`.
4. Textarea renders returned JSON; header shows size and `missing[]` as grayed disabled toggles.
5. Copy button writes to clipboard.

### Chat (new chat)

1. Click Chat → tier picker (Report / Content / Configure).
2. Configure reuses `ComposeModal` in chat mode (button label "Start chat").
3. Client calls `POST /api/chat` with `{ scope, tiers, model, userMessage }` — first user message required.
4. Server: `createScopedChat` → `buildAnalysisContext` → `streamScopedChat` → SSE stream.
5. Drawer renders streaming tokens. On stream end, `appendScopedChatMessage` persists final assistant message.

### Chat (resume)

1. Opening drawer on a scope with existing chats → `listScopedChats` → chat list + "New chat".
2. Selecting chat → `getScopedChat` replays messages. Model and tiers are locked (shown as read-only chips).

## Error handling

- **Artifact missing for scope** — omit from JSON, report in `missing[]`. Modal grays toggle with tooltip "not yet generated".
- **`ANTHROPIC_API_KEY` unset** — `/api/chat` returns 500; drawer shows inline remediation.
- **Context exceeds model window after chunking** — `/api/chat` returns 413 `{ error, bytes, limit }`; drawer instructs narrowing.
- **Clipboard API unavailable** — fallback to hidden-textarea `execCommand('copy')`.
- **Concurrent compose requests** — abort previous via `AbortController`.
- **Chat stream interrupted** — persist partial assistant message with `truncated: true`; drawer offers retry.

## Testing

- `scripts/analysis-context.test.ts` — every scope kind × every tier toggle combination; missing-artifact path; chunk splitter boundary cases (single-key-too-large, empty scope, exactly-at-budget).
- `scripts/chat.test.ts` — mocked Anthropic client: verify preamble wording when N > 1, single-chunk inline path, model passthrough. No network.
- `src/app/api/compose/route.test.ts` — query-param parsing, 400 on malformed scope, response shape.
- UI components: smoke-render tests only. Golden-path manual verification checklist:
  - Copy Report from category → clipboard contains only that category's slice.
  - Configure toggles live-update textarea.
  - Chat from site with Configure → modal → drawer opens with streaming response.
  - Close/reopen drawer → existing chat resumes with history.

## Implementation notes

- Scope query-param format: `scope=cat:<req>:<site>:<cat>` / `scope=site:<req>:<site>` / `scope=req:<req>`. Tiers: `tiers=r,c,t,l,p,i,pr` single-letter mask.
- `useAnalysisContext` returns `{ data, bytes, missing, loading, error }`.
- `ComposeModal` textarea is read-only. Copy button disabled until first successful response.
- `ChatDrawer` uses shadcn `Sheet` component (add via `npx shadcn@latest add sheet` if absent).
- Model selector is a shadcn `Select` inside the ChatMenu tier picker (not inside the drawer).
