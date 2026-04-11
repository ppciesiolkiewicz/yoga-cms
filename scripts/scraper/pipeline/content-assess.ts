import Anthropic from "@anthropic-ai/sdk"
import type {
  ContentAssessment,
  DropInPageAssessment,
  FetchedPage,
  RetreatPageAssessment,
  TrainingPageAssessment,
} from "../types"

let _anthropic: Anthropic | null = null
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

const DROP_IN_PROMPT = `You judge yoga drop-in class pages.

A visitor wants to answer: "When can I come? How much? Where? What styles?"

Good page:
- Class schedule visible near the top — day, time, style
- Prices clear (single class, class packs, first-time deals)
- Studio address and how to get there
- Easy way to book or just show up
- Short class descriptions, not long philosophy

Bad page:
- Schedule hidden below a long story
- "What is yoga" text on a commercial class page
- Prices missing or "contact us for prices"
- Training and retreat offers mixed in with drop-in classes

SEO (Google) — check:
- Page title names the city and class type (e.g. "Hatha classes in Barcelona")
- Clear H1 matching the title
- LocalBusiness schema with address, phone, hours
- Unique copy, not generic boilerplate
- Images have alt text

Score each page 1-10 twice:
- conversionScore: how well does the page help a visitor book?
- seoScore: how well can Google find and rank the page?

Return only valid JSON. No markdown, no code fences.`

const TRAINING_PROMPT = `You judge yoga teacher training (YTT) pages.

A visitor is deciding: "Should I enroll here, or keep looking?"

Five facts must be near the top, before any story:
- WHEN — dates
- WHERE — place
- PRICE
- WHAT — what you will learn, hours, style
- HOW LONG — days or weeks

Good page:
- All 5 facts visible before any philosophy
- Real curriculum with topics listed
- Teacher names and short bios
- Reviews or past student outcomes
- Clear way to apply or book

Bad page:
- "What is yoga" or philosophy before the price
- "Why choose us" filler sections
- Price or dates hidden far down
- Many different training offers mixed on one page

SEO (Google) — check:
- Title names the course, hours, and city (e.g. "200hr YTT Rishikesh")
- Clear H1 matching the title
- Course schema, FAQ schema if there is a FAQ
- Real curriculum depth — Google rewards this on training pages
- Images with alt text, unique photos

Score each page 1-10 twice:
- conversionScore: how well does it help a visitor decide and enroll?
- seoScore: how well can Google find and rank it?

A training page can score high on both: put price and dates at the top, keep curriculum depth below. Conversion and SEO do not have to fight.

Return only valid JSON. No markdown, no code fences.`

const RETREAT_PROMPT = `You judge yoga retreat pages.

A visitor wants to answer: "Can I go? When? Where? How much? What happens each day?"

Five facts must be near the top, before any story:
- WHEN — dates
- WHERE — place
- PRICE and what it includes
- WHAT — yoga style, activities
- HOW LONG — days

Good page:
- All 5 facts visible before the story
- Real location — town, venue, not just "paradise"
- What is included: room, food, yoga, transfers
- Daily schedule
- Clear way to book

Bad page:
- Dates or price hidden
- Long philosophy before facts
- Stock photos with no real place info
- Several different retreats mixed on one page

SEO (Google) — check:
- Title names the retreat type, place, and month (e.g. "Yoga retreat in Bali, November")
- Clear H1 matching the title
- Event or TouristTrip schema if possible
- Real itinerary text, not filler
- Images with alt text

Score each page 1-10 twice:
- conversionScore: how well does it help a visitor decide and book?
- seoScore: how well can Google find and rank it?

Return only valid JSON. No markdown, no code fences.`

const DROP_IN_SCHEMA = `{
  "pages": [
    {
      "url": "<url>",
      "pageName": "<short descriptive name>",
      "conversionScore": <number 1-10>,
      "seoScore": <number 1-10>,
      "scheduleVisible": <bool>,
      "pricesClear": <bool>,
      "notes": "<string>"
    }
  ]
}`

const TRAINING_SCHEMA = `{
  "pages": [
    {
      "url": "<url>",
      "pageName": "<short descriptive name>",
      "conversionScore": <number 1-10>,
      "seoScore": <number 1-10>,
      "progressiveDisclosure": { "when": <bool>, "where": <bool>, "price": <bool>, "what": <bool>, "howLong": <bool> },
      "keyInfoScrollDepthEstimate": "top" | "middle" | "bottom",
      "fillerContentWarning": <bool>,
      "whyChooseUsWarning": <bool>,
      "notes": "<string>"
    }
  ]
}`

const RETREAT_SCHEMA = `{
  "pages": [
    {
      "url": "<url>",
      "pageName": "<short descriptive name>",
      "conversionScore": <number 1-10>,
      "seoScore": <number 1-10>,
      "progressiveDisclosure": { "when": <bool>, "where": <bool>, "price": <bool>, "what": <bool>, "howLong": <bool> },
      "notes": "<string>"
    }
  ]
}`

async function callClaude<T>(systemPrompt: string, userPrompt: string, label: string, retryHint: string): Promise<T> {
  const maxAttempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await getClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      })
      let text = response.content[0].type === "text" ? response.content[0].text : ""
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
      return JSON.parse(text) as T
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        const delay = 1500 * attempt
        console.warn(`  ⚠ ${label} attempt ${attempt} failed (${error instanceof Error ? error.message : error}); retrying in ${delay}ms`)
        console.warn(`    retry full stage: ${retryHint}`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

function buildUserPrompt(studioName: string, pages: FetchedPage[], schema: string): string {
  const pagesDescription = pages
    .map(p => `${p.url}\n${p.markdown.slice(0, 12000)}`)
    .join("\n\n---\n\n")
  return `Assess these "${studioName}" pages.

${pagesDescription}

Return a JSON object with this exact structure:
${schema}`
}

async function assessDropIn(studioName: string, pages: FetchedPage[], retryHint: string): Promise<DropInPageAssessment[]> {
  if (pages.length === 0) return []
  try {
    const result = await callClaude<{ pages: DropInPageAssessment[] }>(
      DROP_IN_PROMPT,
      buildUserPrompt(studioName, pages, DROP_IN_SCHEMA),
      "Drop-in assessment",
      retryHint,
    )
    return result.pages ?? []
  } catch (error) {
    console.warn(`  ⚠ Drop-in assessment failed: ${error}`)
    return []
  }
}

async function assessTraining(studioName: string, pages: FetchedPage[], retryHint: string): Promise<TrainingPageAssessment[]> {
  if (pages.length === 0) return []
  try {
    const result = await callClaude<{ pages: TrainingPageAssessment[] }>(
      TRAINING_PROMPT,
      buildUserPrompt(studioName, pages, TRAINING_SCHEMA),
      "Training assessment",
      retryHint,
    )
    return result.pages ?? []
  } catch (error) {
    console.warn(`  ⚠ Training assessment failed: ${error}`)
    return []
  }
}

async function assessRetreat(studioName: string, pages: FetchedPage[], retryHint: string): Promise<RetreatPageAssessment[]> {
  if (pages.length === 0) return []
  try {
    const result = await callClaude<{ pages: RetreatPageAssessment[] }>(
      RETREAT_PROMPT,
      buildUserPrompt(studioName, pages, RETREAT_SCHEMA),
      "Retreat assessment",
      retryHint,
    )
    return result.pages ?? []
  } catch (error) {
    console.warn(`  ⚠ Retreat assessment failed: ${error}`)
    return []
  }
}

function pageAvg(p: { conversionScore: number; seoScore: number }): number {
  return (p.conversionScore + p.seoScore) / 2
}

function computeOverall(
  dropIn: DropInPageAssessment[],
  training: TrainingPageAssessment[],
  retreat: RetreatPageAssessment[],
): number {
  const all = [...dropIn, ...training, ...retreat]
  if (all.length === 0) return 0
  const sum = all.reduce((acc, p) => acc + pageAvg(p), 0)
  return Math.round((sum / all.length) * 10) / 10
}

function buildSummary(
  studioName: string,
  dropIn: DropInPageAssessment[],
  training: TrainingPageAssessment[],
  retreat: RetreatPageAssessment[],
): string {
  const parts: string[] = []
  if (dropIn.length > 0) parts.push(`${dropIn.length} drop-in`)
  if (training.length > 0) parts.push(`${training.length} training`)
  if (retreat.length > 0) parts.push(`${retreat.length} retreat`)
  if (parts.length === 0) return `No pages assessed for ${studioName}.`
  return `Assessed ${parts.join(", ")} page(s) for ${studioName}.`
}

export async function assessContent(
  studioName: string,
  dropInPages: FetchedPage[],
  trainingPages: FetchedPage[],
  retreatPages: FetchedPage[],
  retryHint: string,
): Promise<ContentAssessment> {
  if (dropInPages.length === 0 && trainingPages.length === 0 && retreatPages.length === 0) {
    return {
      overallScore: 0,
      summary: "No pages available for assessment.",
      dropInPages: [],
      trainingPages: [],
      retreatPages: [],
    }
  }

  console.log(`  Assessing content with Claude API (per-type)...`)

  const [dropIn, training, retreat] = await Promise.all([
    assessDropIn(studioName, dropInPages, retryHint),
    assessTraining(studioName, trainingPages, retryHint),
    assessRetreat(studioName, retreatPages, retryHint),
  ])

  return {
    overallScore: computeOverall(dropIn, training, retreat),
    summary: buildSummary(studioName, dropIn, training, retreat),
    dropInPages: dropIn,
    trainingPages: training,
    retreatPages: retreat,
  }
}
