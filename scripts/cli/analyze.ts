import { readFileSync } from "fs"
import { resolve } from "path"
import { config } from "dotenv"
import { runAnalysis } from "../core/run"
import type { AnalyzeInput, RunOptions, StageName } from "../core/types"

config()

const HELP = `npm run analyze -- --input <path> [--concurrency N] [--stages a,b,c] [--force]

Reads an AnalyzeInput JSON file and runs the generic analysis pipeline.
Every run creates a new request under data/db/requests/<id>/.

Required:
  --input <path>       path to an AnalyzeInput JSON file

Optional:
  --concurrency N      run N sites in parallel (default 1)
  --stages a,b,c       only run the named stages (comma-separated)
  --force              re-run stages even if artifacts exist (reserved)
  -h, --help           show help
`

interface CliArgs {
  input?: string
  concurrency?: number
  stages?: StageName[]
  force?: boolean
  help?: boolean
}

function parseArgs(raw: string[]): CliArgs {
  const out: CliArgs = {}
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]
    if (a === "--input" && raw[i + 1]) out.input = raw[++i]
    else if (a === "--concurrency" && raw[i + 1]) out.concurrency = parseInt(raw[++i], 10)
    else if (a === "--stages" && raw[i + 1]) out.stages = raw[++i].split(",") as StageName[]
    else if (a === "--force") out.force = true
    else if (a === "-h" || a === "--help") out.help = true
  }
  return out
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.input) {
    process.stdout.write(HELP)
    if (!args.help) process.exit(1)
    return
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is required")
    process.exit(1)
  }

  const path = resolve(args.input)
  const input = JSON.parse(readFileSync(path, "utf8")) as AnalyzeInput

  const opts: RunOptions = {
    concurrency: args.concurrency,
    stages: args.stages,
    force: args.force,
  }

  const id = await runAnalysis(input, opts)
  console.log(`\nDone. Request id: ${id}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
