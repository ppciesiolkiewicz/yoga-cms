// scripts/scraper/analyze.ts — analyze CLI
// Stages: tech, lighthouse, content, extract, report.
// Each stage depends only on fetch artifacts under data/raw/<slug>/.
// Classification is an internal cache (data/analysis/<slug>/classification.json),
// auto-generated on first call from content or extract.

import { config } from "dotenv"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { studios } from "./websites-data"
import {
  analyzeTechStage,
  analyzeLighthouseStage,
  analyzeContentStage,
  analyzeExtractStage,
  analyzeReportStage,
  rebuildIndex,
} from "./pipeline/analyze-stages"
import { analysisArtifactExists } from "./pipeline/analysis-io"
import type { StudioEntry } from "./types"
import { existsSync } from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, "../../.env") })

const DATA_DIR = join(__dirname, "../../data")
const REPORTS_DIR = join(DATA_DIR, "reports")

type Stage = "tech" | "lighthouse" | "content" | "extract" | "report" | "all"
const VALID_STAGES: readonly Stage[] = ["tech", "lighthouse", "content", "extract", "report", "all"] as const

interface Args {
  stage: Stage
  studioFilter?: string
  cityFilter?: string
  limit?: number
  force: boolean
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function parseArgsFrom(raw: string[]): Args {
  const out: Args = { stage: "all", force: false }
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]
    if (a === "--stage" && raw[i + 1]) {
      const s = raw[++i] as Stage
      if (!VALID_STAGES.includes(s)) {
        console.error(`Unknown stage "${s}". Valid: ${VALID_STAGES.join(", ")}`)
        process.exit(1)
      }
      out.stage = s
    }
    else if (a === "--studio" && raw[i + 1]) { out.studioFilter = raw[++i] }
    else if (a === "--city" && raw[i + 1]) { out.cityFilter = raw[++i] }
    else if (a === "--limit" && raw[i + 1]) { out.limit = parseInt(raw[++i], 10) }
    else if (a === "--force") { out.force = true }
  }
  return out
}

function filterStudios(args: Args): StudioEntry[] {
  let list = studios
  if (args.studioFilter) {
    list = list.filter(s => s.studioName.toLowerCase().includes(args.studioFilter!.toLowerCase()))
    if (list.length === 0) { console.error(`No studios matching "${args.studioFilter}"`); process.exit(1) }
  }
  if (args.cityFilter) {
    list = list.filter(s => s.city.toLowerCase().includes(args.cityFilter!.toLowerCase()))
    if (list.length === 0) { console.error(`No studios in city "${args.cityFilter}"`); process.exit(1) }
  }
  if (args.limit) list = list.slice(0, args.limit)
  return list
}

async function runStageFor(entry: StudioEntry, stage: Stage, args: Args): Promise<void> {
  const slug = slugify(entry.studioName)
  const shouldRun = (exists: () => boolean) => args.force || !exists()

  type Task = { name: string; run: () => Promise<void> }
  const tasks: Task[] = []

  const addStage = (
    name: string,
    artifact: string,
    fn: () => Promise<void>,
  ): void => {
    if (shouldRun(() => analysisArtifactExists(slug, artifact))) {
      tasks.push({ name, run: fn })
    } else {
      console.log(`  · ${name} cached for ${entry.studioName}`)
    }
  }

  if (stage === "tech" || stage === "all") addStage("tech", "tech.json", () => analyzeTechStage(entry))
  if (stage === "lighthouse" || stage === "all") addStage("lighthouse", "lighthouse.json", () => analyzeLighthouseStage(entry))
  if (stage === "content" || stage === "all") addStage("content", "content.json", () => analyzeContentStage(entry))
  if (stage === "extract" || stage === "all") addStage("extract", "extracted.json", () => analyzeExtractStage(entry))

  if (tasks.length > 0) {
    const results = await Promise.allSettled(tasks.map(t => t.run()))
    let failed = 0
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        failed++
        console.error(`  ✗ ${tasks[i].name} failed for ${entry.studioName}: ${r.reason instanceof Error ? r.reason.message : r.reason}`)
      }
    })
    if (failed > 0 && (stage === "report" || stage === "all")) {
      throw new Error(`${failed} stage(s) failed — skipping report`)
    }
  }

  if (stage === "report" || stage === "all") {
    const reportPath = join(REPORTS_DIR, `${slug}.json`)
    if (args.force || !existsSync(reportPath)) {
      await analyzeReportStage(entry)
    } else {
      console.log(`  · report cached for ${entry.studioName}`)
    }
  }
}

const HELP_TEXT = `npm run analyze — process fetch artifacts into a final report

USAGE
  npm run analyze -- [options]

Each stage depends only on fetch artifacts (data/raw/<slug>/). Stages do not
depend on each other. Report is the aggregator: it reads the others.

STAGES
  tech         Detect the site's platform and third-party tools with
               wappalyzer on the homepage HTML. Identifies CMS, booking
               systems, analytics, chat, ecommerce; estimates monthly tool
               costs; derives a Features summary (booking, newsletter, blog,
               multi-language, add-ons).
               Writes: tech.json

  lighthouse   Run Lighthouse against the homepage (PageSpeed Insights API).
               Returns four scores: Performance, Accessibility, Best
               Practices, SEO.
               Writes: lighthouse.json

  content      Score each classified page on TWO dimensions using Claude:
                 • conversionScore (1-10) — can a visitor act on this page?
                   checks key info position, filler, buried CTAs
                 • seoScore (1-10) — can search engines rank it? checks title,
                   H1, schema, image alts, keyword targeting
               Judgment only — does not extract facts.
               Writes: content.json

  extract      Pull structured data out of classified pages using Claude:
                 offers, programs, events, contact info. Pure extraction —
                 no scoring.
               Writes: extracted.json

  report       Assemble the final report by combining fetch artifacts + all
               analyze outputs. Writes per-studio report and rebuilds the
               cross-studio index.
               Writes: data/reports/<slug>.json, data/index.json

  all          Run tech → lighthouse → content → extract → report (default).

OPTIONS
  --stage STAGE   tech | lighthouse | content | extract | report | all
  --studio NAME   filter by studio name substring
  --city CITY     filter by city substring
  --limit N       take only the first N matching studios
  --force         re-run stage even if its artifact exists
  -h, --help      show this help

ARTIFACTS (data/analysis/<slug>/)
  tech.json, lighthouse.json, content.json, extracted.json
  classification.json   lazy cache for the link classifier, auto-generated
                        on first content/extract run. Delete to force
                        re-classification.

REQUIRES
  ANTHROPIC_API_KEY     for content + extract (and classification)
  raw fetch artifacts   run \`npm run fetch\` first

EXAMPLES
  npm run analyze -- --studio "Arogya Yoga School"
  npm run analyze -- --stage content --force
  npm run analyze -- --stage report   # re-assemble from existing artifacts
`

function printHelp(): void {
  process.stdout.write(HELP_TEXT)
}

function hasHelpFlag(raw: string[]): boolean {
  return raw.includes("--help") || raw.includes("-h")
}

export async function runAnalyze(argv: string[] = process.argv.slice(2)): Promise<void> {
  if (hasHelpFlag(argv)) {
    printHelp()
    return
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required")
    process.exit(1)
  }
  const args = parseArgsFrom(argv)
  const list = filterStudios(args)
  console.log(`analyze stage=${args.stage} — ${list.length} studio(s) in scope`)

  for (const entry of list) {
    try {
      await runStageFor(entry, args.stage, args)
    } catch (error) {
      console.error(`  ✗ analyze failed for ${entry.studioName}: ${error instanceof Error ? error.message : error}`)
    }
  }

  if (args.stage === "report" || args.stage === "all") {
    rebuildIndex()
  }
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("analyze.ts")
if (isDirectRun) {
  runAnalyze().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
