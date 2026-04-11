import Anthropic from "@anthropic-ai/sdk"
import type { StudioOverrides } from "../types"

let _anthropic: Anthropic | null = null
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

const SYSTEM = `You classify links from a yoga studio website homepage into exactly these buckets:
- dropIns: schedule, classes, prices, timetable
- trainings: teacher trainings (TTC, 200hr, 300hr, YTT, etc.)
- retreats: retreats, workshops over multiple days away from the studio
- contact: contact, about-us-with-contact, location
- other: everything else (home, blog, shop, gallery, philosophy, about generic, etc.)

Return ONLY a JSON object: { "dropIns": ["url"], "trainings": ["url"], "retreats": ["url"], "contact": "url" | null, "other": ["url"] }.
Cap dropIns, trainings, retreats at 3 URLs each. contact is a single URL or null. Prefer the most informative page when you have to choose. Use the labels as primary signal, URLs as fallback.`

export interface ClassifiedLinks {
  dropIns: string[]
  trainings: string[]
  retreats: string[]
  contact: string | null
}

export async function classifyLinks(
  studioName: string,
  website: string,
  links: Array<{ label: string; href: string }>,
): Promise<ClassifiedLinks> {
  if (links.length === 0) {
    return { dropIns: [], trainings: [], retreats: [], contact: null }
  }

  const userMessage = `Studio: "${studioName}" (${website})

Homepage links:
${links.map(l => `- "${l.label}" -> ${l.href}`).join("\n")}

Classify into JSON as instructed.`

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    })
    let text = response.content[0].type === "text" ? response.content[0].text : ""
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
    const parsed = JSON.parse(text) as ClassifiedLinks & { other?: unknown }
    return {
      dropIns: Array.isArray(parsed.dropIns) ? parsed.dropIns.slice(0, 3) : [],
      trainings: Array.isArray(parsed.trainings) ? parsed.trainings.slice(0, 3) : [],
      retreats: Array.isArray(parsed.retreats) ? parsed.retreats.slice(0, 3) : [],
      contact: typeof parsed.contact === "string" ? parsed.contact : null,
    }
  } catch {
    return classifyByKeyword(links)
  }
}

function classifyByKeyword(links: Array<{ label: string; href: string }>): ClassifiedLinks {
  const out: ClassifiedLinks = { dropIns: [], trainings: [], retreats: [], contact: null }
  const seen = new Set<string>()
  const push = (arr: string[], href: string, cap: number) => {
    if (seen.has(href) || arr.length >= cap) return
    arr.push(href)
    seen.add(href)
  }
  for (const { label, href } of links) {
    const hay = `${label} ${href}`.toLowerCase()
    if (!out.contact && /contact|reach|email|location/.test(hay)) out.contact = href
    else if (/training|ytt|ttc|200[-\s]?hour|300[-\s]?hour|teacher/.test(hay)) push(out.trainings, href, 3)
    else if (/retreat|workshop/.test(hay)) push(out.retreats, href, 3)
    else if (/schedule|class(es)?|timetable|price|drop[-\s]?in/.test(hay)) push(out.dropIns, href, 3)
  }
  return out
}

export function fromOverrides(overrides: StudioOverrides): ClassifiedLinks {
  return {
    dropIns: overrides.dropIns ?? [],
    trainings: overrides.trainings ?? [],
    retreats: overrides.retreats ?? [],
    contact: overrides.contact ?? null,
  }
}
