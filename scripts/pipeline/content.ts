import Anthropic from "@anthropic-ai/sdk"
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"
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

async function callAssess(categoryPrompt: string, body: string): Promise<PageAssessment[]> {
  const maxAttempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `${categoryPrompt}\n\n---\n${ASSESS_FRAMING}`,
        messages: [{ role: "user", content: body }],
      })
      let text = response.content[0].type === "text" ? response.content[0].text : ""
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
      const parsed = JSON.parse(text) as { pages?: PageAssessment[] }
      return parsed.pages ?? []
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500 * attempt))
    }
  }
  console.warn(`  ⚠ content assess failed: ${lastError}`)
  return []
}

export async function contentStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const results: CategoryAssessment[] = []
  for (const category of request.categories) {
    const pages = await loadCategoryPages(repo, request, site, category)
    if (pages.length === 0) {
      results.push({ categoryId: category.id, categoryName: category.name, pages: [] })
      continue
    }
    const body = `Category: ${category.name}

${pages.map(p => `${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`
    const assessed = await callAssess(category.prompt, body)
    results.push({ categoryId: category.id, categoryName: category.name, pages: assessed })
  }
  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "content", name: "content.json" },
    { categories: results },
  )
}
