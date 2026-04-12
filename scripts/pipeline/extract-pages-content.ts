import Anthropic from "@anthropic-ai/sdk"
import { newId } from "../db/repo"
import type { Repo } from "../db/repo"
import type { Request, Site, AIQuery } from "../core/types"
import { loadCategoryPages } from "./load-pages"

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

const EXTRACT_FRAMING = `Using the category description above, extract structured records from the page text below.
Return ONLY a JSON object with a "records" key holding an array of objects.
Each object's fields are up to you based on the category description, but keep field names consistent across records within this response.
If no records are found, return { "records": [] }.
No markdown, no code fences.`

interface ExtractResult {
  records: unknown[]
  queryInfo: { prompt: string; response: string } | null
}

async function callExtract(categoryPrompt: string, body: string): Promise<ExtractResult> {
  const system = `${categoryPrompt}\n\n---\n${EXTRACT_FRAMING}`
  const maxAttempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: body }],
      })
      let text = response.content[0].type === "text" ? response.content[0].text : ""
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
      const parsed = JSON.parse(text) as { records?: unknown[] }
      return { records: parsed.records ?? [], queryInfo: { prompt: system, response: text } }
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500 * attempt))
    }
  }
  console.warn(`  ⚠ extract failed: ${lastError}`)
  return { records: [], queryInfo: null }
}

export async function extractPagesContentStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const byCategory: Record<string, unknown[]> = {}
  for (const category of request.categories) {
    const pages = await loadCategoryPages(repo, request, site, category)
    if (pages.length === 0) {
      byCategory[category.id] = []
      continue
    }
    const body = `Category: ${category.name}

${pages.map(p => `URL: ${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`
    const result = await callExtract(category.prompt, body)
    if (result.queryInfo) {
      const query: AIQuery = {
        id: newId("q"),
        requestId: request.id,
        siteId: site.id,
        categoryId: category.id,
        stage: "extract-pages-content",
        model: "claude-sonnet-4-6",
        prompt: result.queryInfo.prompt,
        dataRefs: pages.map(p => p.url),
        response: result.queryInfo.response,
        createdAt: new Date().toISOString(),
      }
      await repo.putQuery(query)
    }
    byCategory[category.id] = result.records
  }
  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "extract-pages-content", name: "extract-pages-content.json" },
    { byCategory },
  )
}
