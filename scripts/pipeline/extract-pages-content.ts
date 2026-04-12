import Anthropic from "@anthropic-ai/sdk"
import { newId } from "../db/repo"
import type { Repo } from "../db/repo"
import type { Request, Site, Category, AIQuery } from "../core/types"
import { loadCategoryPages } from "./load-pages"

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

const EXTRACT_FRAMING = `You are analyzing web pages for the category described above.
For each page provided below, extract one record.
If the category description specifies a JSON schema, follow it exactly.
Otherwise, return fields you find relevant based on the category description.
Every record must always include "url" (the page URL) and "summary" (1-2 sentence plain-language overview of the page).
Fields ending in "Score" must be numbers from 1 to 10.
Return a JSON object: { "records": [<one record per page>] }.
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

export async function extractPagesContentForCategory(repo: Repo, request: Request, site: Site, category: Category): Promise<void> {
  const pages = await loadCategoryPages(repo, request, site, category)
  if (pages.length === 0) {
    await repo.putJson(
      { requestId: request.id, siteId: site.id, stage: "extract-pages-content", name: `${category.id}.json` },
      { categoryId: category.id, records: [] },
    )
    return
  }

  const body = `Category: ${category.name}\n\n${pages.map(p => `URL: ${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`
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

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "extract-pages-content", name: `${category.id}.json` },
    { categoryId: category.id, records: result.records },
  )
}
