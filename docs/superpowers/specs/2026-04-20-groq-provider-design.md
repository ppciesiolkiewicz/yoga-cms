# Groq Provider Support — Design Spec

**Date:** 2026-04-20
**Status:** Proposed

## Goal

Add Groq as an alternative LLM provider alongside Anthropic. Every pipeline stage and chat call must be swappable between providers via a central settings file. The UI must clearly surface which provider is in use.

## Non-goals

- Adding a third provider (OpenAI, etc.). Design must not paint us into a corner, but shipping support for a third provider is out of scope.
- Replacing `MODEL_MAP` shorthand with an abstract tier system (`small`/`medium`/`large`). Config uses explicit `provider` + `model`.
- Runtime (UI-editable) settings. `settings.ts` is a TS constant edited in-source.
- Reasoning-model support (e.g. DeepSeek R1). Pipeline stages don't benefit.

## Supported Groq models

Initial set (three models, picked to span a small/medium/large spread analogous to haiku/sonnet/opus):

| Model ID | Tier | Typical use |
|---|---|---|
| `llama-3.1-8b-instant` | small | Classification, light extraction |
| `llama-3.3-70b-versatile` | medium | General content analysis |
| `moonshotai/kimi-k2-instruct` | large | Heavy content reasoning |

Adding more later = add an entry to the chat allowlist + pricing table. No code changes required.

## Architecture

### AI client (`core/ai-client.ts`)

Lives at top-level `core/` (not `scripts/core/`) because it's shared between pipeline code (`scripts/`) and the Next.js chat API (`src/app/api/chat/`). `tsconfig.json` gets a new path alias: `"@core/*": ["./core/*"]`.

A single file exporting an abstract class and two subclasses. Consumers never construct subclasses directly — they call `getClient(provider)`.

```ts
export type Provider = "anthropic" | "groq"

export interface CompleteRequest {
  model: string
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
  maxTokens: number
}

export interface CompleteResponse {
  text: string
  usage: { inputTokens: number; outputTokens: number }
}

export interface StreamEvent {
  type: "text" | "done"
  delta?: string
  usage?: { inputTokens: number; outputTokens: number }
}

export abstract class AIClient {
  abstract readonly provider: Provider
  abstract complete(req: CompleteRequest): Promise<CompleteResponse>
  abstract stream(req: CompleteRequest): AsyncIterable<StreamEvent>
}

class AnthropicClient extends AIClient {
  readonly provider = "anthropic"
  // wraps @anthropic-ai/sdk; passes system + messages straight through
}

class GroqClient extends AIClient {
  readonly provider = "groq"
  // wraps groq-sdk; prepends system as { role: "system", content: system }
  // maps usage.prompt_tokens → inputTokens, completion_tokens → outputTokens
}

let anthropicSingleton: AnthropicClient | null = null
let groqSingleton: GroqClient | null = null

export function getClient(provider: Provider): AIClient {
  // lazy-initialize singleton per provider; validate env var at first use
}
```

Both subclasses live in the same file (`ai-client.ts`). Consumers import only `{ getClient, type Provider, type CompleteRequest }`.

### Settings (`core/settings.ts`)

Lives alongside `core/ai-client.ts` — shared between pipeline and chat.

```ts
import type { Provider } from "./ai-client"

export interface ModelRef {
  provider: Provider
  model: string
}

export const SETTINGS = {
  models: {
    classifyNav:   { provider: "groq",      model: "llama-3.1-8b-instant" },
    extractPages:  { provider: "anthropic", model: "claude-sonnet-4-6" },
    basePromptGen: { provider: "anthropic", model: "claude-sonnet-4-6" },
    chatDefault:   { provider: "anthropic", model: "claude-sonnet-4-6" },
  },
  stageEstimates: {
    classifyNavOutputTokens:  500,
    extractPagesOutputTokens: 1500,
  },
  providers: {
    anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY" },
    groq:      { apiKeyEnv: "GROQ_API_KEY" },
  },
} as const satisfies {
  models: Record<string, ModelRef>
  stageEstimates: Record<string, number>
  providers: Record<Provider, { apiKeyEnv: string }>
}
```

Override precedence for `extract-pages-content`:

1. `category.provider` + `category.model` from input JSON (if both present)
2. else `SETTINGS.models.extractPages`

All other stages read directly from `SETTINGS.models.*`.

## Input schema change

`CategoryInput` in `scripts/core/types.ts`:

- `provider: "anthropic" | "groq"` — new required field
- `model: string` — becomes raw model ID (e.g. `"claude-sonnet-4-6"`, `"llama-3.3-70b-versatile"`). No more `"haiku"`/`"sonnet"`/`"opus"` shorthand.

`scripts/core/models.ts` (the old `MODEL_MAP` file) is deleted. Every existing input file gets migrated in the same commit — no dual-read compatibility code.

`data/inputs/yoga.json` migration: every category's `model: "sonnet"` becomes `provider: "anthropic"`, `model: "claude-sonnet-4-6"`.

## Pricing restructure

`scripts/quote/pricing.json` — provider-indexed:

```json
{
  "anthropic": {
    "claude-haiku-4-5":  { "inputPer1kTokens": 0.001, "outputPer1kTokens": 0.005 },
    "claude-sonnet-4-6": { "inputPer1kTokens": 0.003, "outputPer1kTokens": 0.015 },
    "claude-opus-4-6":   { "inputPer1kTokens": 0.015, "outputPer1kTokens": 0.075 }
  },
  "groq": {
    "llama-3.1-8b-instant":        { "inputPer1kTokens": 0.00005, "outputPer1kTokens": 0.00008 },
    "llama-3.3-70b-versatile":     { "inputPer1kTokens": 0.00059, "outputPer1kTokens": 0.00079 },
    "moonshotai/kimi-k2-instruct": { "inputPer1kTokens": 0.001,   "outputPer1kTokens": 0.003 }
  }
}
```

Stage-specific estimates (`estimatedOutputTokens`, lighthouse/wappalyzer flat costs) move out of `pricing.json` — into `settings.ts` for token estimates, into a new `SETTINGS.serviceCosts` block for flat fees if needed.

Quote generator looks up `pricing[resolvedProvider][resolvedModel]` for each stage, using the same resolution rules as the pipeline.

## AIQuery record

`scripts/core/types.ts` — extend `AIQuery`:

```ts
export interface AIQuery {
  // ...existing fields
  provider: Provider   // new
  model: string        // already exists
}
```

All three call sites (classify-nav, extract-pages-content, chat) write the resolved provider alongside model.

## Chat

### `scripts/chat/models.ts`

Allowlist restructures to tagged entries:

```ts
export interface ChatModel {
  id: string           // API model ID
  label: string        // "Claude Sonnet 4.6"
  provider: Provider
}

export const SUPPORTED_CHAT_MODELS: ChatModel[] = [
  { id: "claude-opus-4-6",               label: "Claude Opus 4.6",   provider: "anthropic" },
  { id: "claude-sonnet-4-6",             label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001",     label: "Claude Haiku 4.5",  provider: "anthropic" },
  { id: "llama-3.1-8b-instant",          label: "Llama 3.1 8B",      provider: "groq"      },
  { id: "llama-3.3-70b-versatile",       label: "Llama 3.3 70B",     provider: "groq"      },
  { id: "moonshotai/kimi-k2-instruct",   label: "Kimi K2",           provider: "groq"      },
]

export function getChatModel(id: string): ChatModel | undefined
export function isSupportedModel(id: string): boolean
```

### `scripts/chat/stream.ts`

Resolves provider from model ID via allowlist, calls `getClient(provider).stream(...)`. Drops direct `@anthropic-ai/sdk` dependency.

### `/api/chat`

Looks up model in allowlist. If unknown → 400. If known → extracts provider and passes to stream.

### ChatDrawer UI

Model picker becomes a grouped dropdown (Radix Select or shadcn `Select`):

```
Anthropic
  Claude Opus 4.6
  Claude Sonnet 4.6
  Claude Haiku 4.5
Groq
  Llama 3.1 8B
  Llama 3.3 70B
  Kimi K2
```

Headers are `<SelectGroup>` / `<SelectLabel>` from shadcn.

### Chat history list

Each row shows `<ProviderBadge provider={model.provider} />` next to the model name.

## UI: ProviderBadge

New atom: `src/components/ui/ProviderBadge.tsx`

- Built on existing `Chip` atom
- Props: `{ provider: "anthropic" | "groq"; size?: "sm" | "md" }`
- Color convention:
  - Anthropic: existing "brand" orange (reuse project token)
  - Groq: green (Tailwind `emerald-*`)
- Exported via `src/components/ui/index.ts`

Used in:

- Chat history list (next to model name)
- Analyses detail rows (category's configured model)
- Quote view (each line item)
- Category config display (if/when surfaced in UI)

## Pipeline call-site changes

### `scripts/pipeline/classify-nav.ts`

```ts
import { getClient } from "@core/ai-client"
import { SETTINGS } from "@core/settings"

const { provider, model } = SETTINGS.models.classifyNav
const client = getClient(provider)
const res = await client.complete({ model, system, messages, maxTokens: 1024 })
```

`AIQuery` record writes `provider` + `model`.

### `scripts/pipeline/extract-pages-content.ts`

```ts
const { provider, model } = category.provider && category.model
  ? { provider: category.provider, model: category.model }
  : SETTINGS.models.extractPages
const client = getClient(provider)
```

Retry logic (3 attempts, exponential backoff) stays unchanged — wraps `client.complete(...)`.

### `scripts/core/base-prompt.ts`

```ts
const { provider, model } = SETTINGS.models.basePromptGen
const client = getClient(provider)
```

### `scripts/chat/stream.ts`

```ts
const chatModel = getChatModel(params.model)
if (!chatModel) throw new Error(`Unsupported model: ${params.model}`)
const client = getClient(chatModel.provider)
for await (const evt of client.stream({ model: chatModel.id, ... })) { ... }
```

## Environment & startup validation

`.env` adds `GROQ_API_KEY`.

New utility `core/validate-env.ts`:

```ts
export function requireApiKeysFor(providers: Provider[]): void {
  const missing: string[] = []
  for (const p of providers) {
    const env = SETTINGS.providers[p].apiKeyEnv
    if (!process.env[env]) missing.push(env)
  }
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(", ")}`)
}
```

- **CLI (`scripts/cli/analyze.ts`)**: on startup, walks the resolved run config (settings + every category), collects the unique set of providers that will actually be called, and validates their keys. Fails fast with a message listing every missing key.
- **`/api/chat`**: on each request, validates the single provider needed for the requested model. Returns 400 with a clear message if its key is missing.

## Dependencies

`package.json` adds `groq-sdk` (latest stable).

`@anthropic-ai/sdk` stays.

## Testing

Per existing project convention (vitest):

- **Unit: `ai-client.test.ts`** — mock both SDKs, verify:
  - Anthropic request shape is passed through
  - Groq `system` is prepended to `messages`
  - Groq usage mapping (`prompt_tokens` → `inputTokens`)
  - `getClient` singleton behavior
- **Unit: `settings.test.ts`** — verify type satisfaction (compile-time), verify every referenced model exists in pricing
- **Unit: `validate-env.test.ts`** — missing-key detection
- **Integration: `extract-pages-content.test.ts`** — verify override precedence (category wins over settings)
- **Integration: `quote.test.ts`** — verify pricing lookup across both providers

No live API calls in tests. Mock `groq-sdk` and `@anthropic-ai/sdk` at module level.

## Migration checklist

- [ ] Delete `scripts/core/models.ts` (`MODEL_MAP`)
- [ ] Migrate `data/inputs/yoga.json` to new schema (explicit provider + raw model ID)
- [ ] Restructure `scripts/quote/pricing.json`
- [ ] All call sites reference the new client
- [ ] `.env.example` updated with `GROQ_API_KEY`
- [ ] README / CLAUDE.md updated to reflect new config shape

## Out of scope / future work

- Per-provider rate limiting / retry strategies (Groq has different limits; current 3-retry backoff is good enough to start)
- Streaming for non-chat stages (pipeline doesn't need it)
- Provider auto-fallback (Groq down → Anthropic). Complicates cost accounting; skip.
- UI for editing `settings.ts` at runtime. In-source TS only.
