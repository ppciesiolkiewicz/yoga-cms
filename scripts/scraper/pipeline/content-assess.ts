import Anthropic from "@anthropic-ai/sdk"
import type { ContentAssessment, FetchedPage } from "../types"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are an expert at evaluating yoga studio website content. You assess whether the content serves potential customers effectively.

Key principles:
- Pages with less text convert better (14.3% vs 11.1% for verbose pages)
- Multiple offers on one page reduce conversions by 266%
- Landing pages with minimal text have 34% higher conversions
- Addressing buyer fears/objections increases conversion by ~80%
- Average attention span is 47 seconds — key info must be immediate

For training/retreat pages, check "progressive disclosure" — the five questions must be answered upfront, before any philosophy or filler content:
1. WHEN — dates clearly visible near the top
2. WHERE — location stated early
3. PRICE — price visible without scrolling past filler
4. WHAT — what the training actually covers
5. HOW LONG — duration stated early

Red flags:
- "What is yoga?" content on a page targeting people who already practice yoga
- "Why choose us?" sections (signals insecurity, delays useful information)
- Key information (price, dates) buried below the 40% scroll depth mark
- Philosophy essays before practical details
- Multiple unrelated offers on one page

For drop-in class pages:
- Schedule should be immediately visible and well-organized
- Prices should be clear
- Class descriptions should be concise

Score each page 1-10 where:
- 9-10: Key info immediate, clean layout, no filler
- 7-8: Key info findable but could be better positioned
- 5-6: Some filler content, key info requires scrolling
- 3-4: Significant filler, key info buried
- 1-2: Key info nearly impossible to find, excessive philosophy/filler

Return ONLY valid JSON. No markdown, no code fences.`

export async function assessContent(
  studioName: string,
  dropInPages: FetchedPage[],
  trainingPages: FetchedPage[],
  retreatPages: FetchedPage[]
): Promise<ContentAssessment> {
  const allPages = [
    ...dropInPages.map(p => ({ ...p, type: "drop-in" as const })),
    ...trainingPages.map(p => ({ ...p, type: "training" as const })),
    ...retreatPages.map(p => ({ ...p, type: "retreat" as const })),
  ]

  if (allPages.length === 0) {
    return {
      overallScore: 0,
      summary: "No pages available for assessment.",
      dropInPresentation: null,
      trainingPages: [],
      retreatPages: [],
    }
  }

  const pagesDescription = allPages
    .map(p => `[${p.type.toUpperCase()}] ${p.url}\n${p.text.slice(0, 3000)}`)
    .join("\n\n---\n\n")

  const userPrompt = `Assess the content quality of "${studioName}" website pages.

${pagesDescription}

Return a JSON object with this exact structure:
{
  "overallScore": <number 1-10>,
  "summary": "<2-3 sentences>",
  "dropInPresentation": { "score": <number>, "notes": "<string>" } or null if no drop-in pages,
  "trainingPages": [
    {
      "url": "<url>",
      "pageName": "<descriptive name>",
      "score": <number 1-10>,
      "progressiveDisclosure": { "when": <bool>, "where": <bool>, "price": <bool>, "what": <bool>, "howLong": <bool> },
      "keyInfoScrollDepthEstimate": "top" | "middle" | "bottom",
      "fillerContentWarning": <bool>,
      "whyChooseUsWarning": <bool>,
      "notes": "<string>"
    }
  ],
  "retreatPages": [
    {
      "url": "<url>",
      "pageName": "<descriptive name>",
      "score": <number 1-10>,
      "progressiveDisclosure": { "when": <bool>, "where": <bool>, "price": <bool>, "what": <bool>, "howLong": <bool> },
      "notes": "<string>"
    }
  ]
}`

  console.log(`  Assessing content with Claude API...`)

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    let text = response.content[0].type === "text" ? response.content[0].text : ""
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()

    return JSON.parse(text) as ContentAssessment
  } catch (error) {
    console.warn(`  ⚠ Content assessment failed: ${error}`)
    return {
      overallScore: 0,
      summary: "Assessment failed.",
      dropInPresentation: null,
      trainingPages: [],
      retreatPages: [],
    }
  }
}
