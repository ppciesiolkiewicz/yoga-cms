import { getClient } from "../../core/ai-client"
import { SETTINGS } from "../../core/settings"

export const BASE_PROMPT = `You help build prompts for a site-analysis pipeline.
Each prompt describes a *category* of pages on a website. The analysis pipeline
uses the prompt in two places:

1. Content assessment — score each page 1-10 on conversionScore (can a visitor act)
   and seoScore (can search engines rank it). The prompt should describe what a good
   page of this category looks like and what a bad one looks like.

2. Data extraction — pull structured records from pages matching the category.
   The prompt should name the fields that matter.

Given the category name and extra info below, write a single prompt (plain text,
no preamble, no headings beyond what helps a language model) that covers both uses.

Category name: {categoryName}
Extra info: {extraInfo}

Write the prompt now.`

export function buildBasePromptMessage(categoryName: string, extraInfo: string): string {
  return BASE_PROMPT
    .replace("{categoryName}", categoryName)
    .replace("{extraInfo}", extraInfo)
}

export async function generatePrompt(categoryName: string, extraInfo: string): Promise<string> {
  const { provider, model } = SETTINGS.models.basePromptGen
  const client = getClient(provider)
  const res = await client.complete({
    model,
    maxTokens: 1024,
    system: "",
    messages: [{ role: "user", content: buildBasePromptMessage(categoryName, extraInfo) }],
  })
  return res.text.trim()
}
