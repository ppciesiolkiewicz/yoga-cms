import { newId } from "../db/repo";
import type { Repo } from "../db/repo";
import type { Request, Site, Category, AIQuery } from "../core/types";
import { loadCategoryPages } from "./load-pages";
import { getClient } from "../../core/ai-client";
import { parseLlmJson } from "./parse-llm-json";

const EXTRACT_FRAMING = `You are analyzing web pages for the category described above.
For each page provided below, extract one record.
Follow the JSON schema from the category description exactly.

## Required fields (always include)
- "url": the page URL
- "pageName": short human-readable page name
- "summary": 1-2 sentence plain-language overview

## Field naming conventions (follow strictly)
- Scores: name ends with "Score", value is a number 1-10 (e.g. "conversionScore": 7)
- Booleans: name starts with "has"/"is" or ends with "Visible" (e.g. "pricingVisible": true)
- Short text: "notes", "description" — 1-2 sentences max
- Tags/lists: arrays of short strings (e.g. "classStyles": ["Hatha", "Vinyasa"])
- Plain strings: everything else (e.g. "price": "€15 drop-in")

Return a JSON object: { "records": [<one record per page>] }.
No markdown, no code fences.`;

interface ExtractResult {
  records: unknown[];
  queryInfo: { prompt: string; response: string; usage: { inputTokens: number; outputTokens: number } } | null;
}

async function callExtract(
  category: Category,
  body: string,
): Promise<ExtractResult> {
  const system = `${category.prompt}\n\n---\n${EXTRACT_FRAMING}`;
  const { provider, model } = category
  const client = getClient(provider)
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.complete({
        model,
        maxTokens: 4096,
        system,
        messages: [{ role: "user", content: body }],
      });
      const text = response.text.trim();
      const parsed = parseLlmJson<{ records?: unknown[] }>(text);
      return {
        records: parsed.records ?? [],
        queryInfo: {
          prompt: system,
          response: text,
          usage: response.usage,
        },
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts)
        await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.warn(`  ⚠ extract failed: ${lastError}`);
  return { records: [], queryInfo: null };
}

export async function extractPagesContentForCategory(
  repo: Repo,
  request: Request,
  site: Site,
  category: Category,
): Promise<void> {
  const pages = await loadCategoryPages(repo, request, site, category);
  if (pages.length === 0) {
    await repo.putJson(
      {
        requestId: request.id,
        siteId: site.id,
        stage: "extract-pages-content",
        name: `${category.id}.json`,
      },
      { categoryId: category.id, records: [] },
    );
    return;
  }

  const body = `Category: ${category.name}\n\n${pages.map((p) => `URL: ${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`;
  const result = await callExtract(category, body);

  if (result.queryInfo) {
    const { provider, model } = category
    const query: AIQuery = {
      id: newId("q"),
      requestId: request.id,
      siteId: site.id,
      categoryId: category.id,
      stage: "extract-pages-content",
      provider,
      model,
      prompt: result.queryInfo.prompt,
      dataRefs: pages.map((p) => p.url),
      response: result.queryInfo.response,
      usage: result.queryInfo.usage,
      createdAt: new Date().toISOString(),
    };
    await repo.putQuery(query);
  }

  await repo.putJson(
    {
      requestId: request.id,
      siteId: site.id,
      stage: "extract-pages-content",
      name: `${category.id}.json`,
    },
    { categoryId: category.id, records: result.records },
  );
}
