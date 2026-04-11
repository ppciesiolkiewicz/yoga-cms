import Anthropic from "@anthropic-ai/sdk"
import type { StudioOverrides } from "../types"

let _anthropic: Anthropic | null = null
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

const SYSTEM = `You classify links from a yoga studio website homepage into exactly these buckets:
- dropIns: single-session classes, schedules, timetables, class prices, walk-in classes
- trainings: multi-day courses, teacher trainings (TTC, YTT, 200hr, 300hr), certifications, immersions, programs that run over several days at the studio. Any page titled "Course", "Certification", "Program", or "Immersion" belongs here — even non-yoga ones like sound healing courses, meditation programs, pranayama courses.
- retreats: multi-day immersive stays away from the studio (abroad, in nature, residential retreats)
- contact: contact page, about-with-contact, location page
- other: everything else (home, blog, shop, gallery, generic philosophy, generic about)

Rules:
- "Course" / "Certification" / "Program" / "Immersion" in the label → trainings, not dropIns.
- "Retreat" in the label → retreats.
- Only classify as dropIns if it is clearly about regular/recurring classes or the studio schedule.
- Use labels as the primary signal, URLs as fallback.

Return ONLY a JSON object: { "dropIns": ["url"], "trainings": ["url"], "retreats": ["url"], "contact": "url" | null, "other": ["url"] }.
Cap dropIns, trainings, retreats at 5 URLs each. contact is a single URL or null. Prefer the most informative page when you have to choose.`

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
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    })
    let text = response.content[0].type === "text" ? response.content[0].text : ""
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
    const parsed = JSON.parse(text) as ClassifiedLinks & { other?: unknown }
    return {
      dropIns: Array.isArray(parsed.dropIns) ? parsed.dropIns.slice(0, 5) : [],
      trainings: Array.isArray(parsed.trainings) ? parsed.trainings.slice(0, 5) : [],
      retreats: Array.isArray(parsed.retreats) ? parsed.retreats.slice(0, 5) : [],
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
    else if (/training|ytt|ttc|200[-\s]?hour|300[-\s]?hour|teacher|course|certification|immersion|program/.test(hay)) push(out.trainings, href, 5)
    else if (/retreat/.test(hay)) push(out.retreats, href, 5)
    else if (/schedule|class(es)?|timetable|price|drop[-\s]?in/.test(hay)) push(out.dropIns, href, 5)
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
