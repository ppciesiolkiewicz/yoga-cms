import Anthropic from "@anthropic-ai/sdk"
import type { Repo } from "../db/repo"
import type { Request, Site, Category } from "../core/types"
import type { NavLink } from "./extract-nav"

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

const PER_CATEGORY_CAP = 5

function buildSystemPrompt(categories: Category[]): string {
  const bullets = categories
    .map(c => `- "${c.name}": ${c.extraInfo}`)
    .join("\n")
  return `You classify links from a website homepage into buckets. The buckets are:
${bullets}
- "other": everything else

Return ONLY a JSON object with one key per bucket name. Each value is an array of
matched URLs (use the exact href from the input), except "other" which you may omit.
Cap each named bucket at ${PER_CATEGORY_CAP} URLs. Prefer the most informative URL
when forced to choose. Use labels as the primary signal, URLs as fallback.`
}

export async function classify(repo: Repo, request: Request, site: Site): Promise<void> {
  const navBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "extract-nav", name: "nav-links.json",
  })
  const nav = JSON.parse(navBuf.toString("utf8")) as { links: NavLink[] }

  const byCategory: Record<string, string[]> = {}
  for (const c of request.categories) byCategory[c.id] = []

  if (nav.links.length === 0) {
    await repo.putJson(
      { requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json" },
      { byCategory },
    )
    return
  }

  const system = buildSystemPrompt(request.categories)
  const userMessage = `Site: ${site.url}

Homepage links:
${nav.links.map(l => `- "${l.label}" -> ${l.href}`).join("\n")}

Classify into JSON as instructed. Bucket names to use: ${request.categories.map(c => `"${c.name}"`).join(", ")}.`

  const response = await client().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userMessage }],
  })
  let text = response.content[0].type === "text" ? response.content[0].text : ""
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()

  const parsed = JSON.parse(text) as Record<string, unknown>
  for (const category of request.categories) {
    const raw = parsed[category.name]
    if (Array.isArray(raw)) {
      byCategory[category.id] = raw
        .filter((u): u is string => typeof u === "string")
        .slice(0, PER_CATEGORY_CAP)
    }
  }

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json" },
    { byCategory },
  )
}
