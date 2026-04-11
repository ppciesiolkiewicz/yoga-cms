import Anthropic from "@anthropic-ai/sdk"
import type { DropInClass, Training, Retreat, ContactInfo, FetchedPage } from "../types"

let _anthropic: Anthropic | null = null
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

async function callClaude(system: string, userMessage: string): Promise<string> {
  const maxAttempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await getClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: userMessage }],
      })
      const text = response.content[0].type === "text" ? response.content[0].text : ""
      return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1500 * attempt))
      }
    }
  }
  throw lastError
}

export async function extractDropInClasses(pages: FetchedPage[], studioName: string): Promise<DropInClass[]> {
  if (pages.length === 0) return []
  console.log(`  Extracting drop-in classes...`)
  const text = pages.map(p => p.markdown).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract drop-in yoga class information. Return ONLY a JSON array. Each object: { "className": "string", "style": "string (e.g. Hatha, Vinyasa)", "schedule": "string (human-readable, e.g. Mon-Fri 7:00-8:30)", "price": "string or null (e.g. 500 INR)" }. If no classes found, return [].`,
      `Extract drop-in classes from "${studioName}":\n\n${text.slice(0, 12000)}`
    )
    return JSON.parse(result) as DropInClass[]
  } catch {
    console.warn(`  ⚠ Failed to extract drop-in classes`)
    return []
  }
}

export async function extractTrainings(pages: FetchedPage[], studioName: string): Promise<Training[]> {
  if (pages.length === 0) return []
  console.log(`  Extracting trainings...`)
  const text = pages.map(p => `URL: ${p.url}\n${p.markdown}`).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract yoga training/TTC information. Return ONLY a JSON array. Each object: { "name": "string", "type": "string (e.g. 200hr YTT, Yin TTC)", "price": "string or null", "dates": ["string"] or null, "duration": "string or null (e.g. 28 days)", "certification": "string or null (e.g. 200hr RYT)" }. If no trainings found, return [].`,
      `Extract training programs from "${studioName}":\n\n${text.slice(0, 12000)}`
    )
    return JSON.parse(result) as Training[]
  } catch {
    console.warn(`  ⚠ Failed to extract trainings`)
    return []
  }
}

export async function extractRetreats(pages: FetchedPage[], studioName: string): Promise<Retreat[]> {
  if (pages.length === 0) return []
  console.log(`  Extracting retreats...`)
  const text = pages.map(p => `URL: ${p.url}\n${p.markdown}`).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract yoga retreat information. Return ONLY a JSON array. Each object: { "name": "string", "price": "string or null", "dates": ["string"] or null, "duration": "string or null", "description": "string or null (1-2 sentences)" }. If no retreats found, return [].`,
      `Extract retreats from "${studioName}":\n\n${text.slice(0, 12000)}`
    )
    return JSON.parse(result) as Retreat[]
  } catch {
    console.warn(`  ⚠ Failed to extract retreats`)
    return []
  }
}

export async function extractContactInfo(pages: FetchedPage[], studioName: string): Promise<ContactInfo> {
  if (pages.length === 0) return {}
  console.log(`  Extracting contact info...`)
  const text = pages.map(p => p.markdown).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract contact information. Return ONLY a JSON object: { "email": "string or null", "phone": "string or null", "whatsapp": "string or null", "instagram": "string or null", "facebook": "string or null", "address": "string or null" }. Only include fields you find.`,
      `Extract contact info from "${studioName}":\n\n${text.slice(0, 8000)}`
    )
    return JSON.parse(result) as ContactInfo
  } catch {
    console.warn(`  ⚠ Failed to extract contact info`)
    return {}
  }
}
