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

interface PageAssessment {
  url: string
  pageName: string
  conversionScore: number
  seoScore: number
  notes: string
}

interface CategoryAssessment {
  categoryId: string
  categoryName: string
  pages: PageAssessment[]
}

const ASSESS_FRAMING = `You judge web pages for a business website in the category described below.

Score each page 1-10 twice:
- conversionScore: how well does the page help a visitor take the next step (book, buy, contact, enroll)?
- seoScore: how well can a search engine find and rank the page? Check title, H1, schema, image alt text, unique copy.

Return only valid JSON with this shape:
{
  "pages": [
    { "url": "<url>", "pageName": "<short name>", "conversionScore": <1-10>, "seoScore": <1-10>, "notes": "<one sentence>" }
  ]
}
No markdown, no code fences.`

interface AssessResult {
  pages: PageAssessment[]
  queryInfo: { prompt: string; response: string } | null
}

async function callAssess(categoryPrompt: string, body: string): Promise<AssessResult> {
  const system = `${categoryPrompt}\n\n---\n${ASSESS_FRAMING}`
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
      const parsed = JSON.parse(text) as { pages?: PageAssessment[] }
      return { pages: parsed.pages ?? [], queryInfo: { prompt: system, response: text } }
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500 * attempt))
    }
  }
  console.warn(`  ⚠ content assess failed: ${lastError}`)
  return { pages: [], queryInfo: null }
}

export async function assessPagesStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const results: CategoryAssessment[] = []
  for (const category of request.categories) {
    const pages = await loadCategoryPages(repo, request, site, category)
    if (pages.length === 0) {
      results.push({ categoryId: category.id, categoryName: category.name, pages: [] })
      continue
    }
    const body = `Category: ${category.name}

${pages.map(p => `${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`
    const result = await callAssess(category.prompt, body)
    if (result.queryInfo) {
      const query: AIQuery = {
        id: newId("q"),
        requestId: request.id,
        siteId: site.id,
        categoryId: category.id,
        stage: "assess-pages",
        model: "claude-sonnet-4-6",
        prompt: result.queryInfo.prompt,
        dataRefs: pages.map(p => p.url),
        response: result.queryInfo.response,
        createdAt: new Date().toISOString(),
      }
      await repo.putQuery(query)
    }
    results.push({ categoryId: category.id, categoryName: category.name, pages: result.pages })
  }
  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "assess-pages", name: "assess-pages.json" },
    { categories: results },
  )
}
