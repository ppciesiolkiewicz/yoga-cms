import { readdirSync, existsSync, mkdirSync, renameSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, "..", "data")
const DEST = join(DATA, "reports-v1")

if (!existsSync(DATA)) {
  console.error("data/ directory not found")
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })

let moved = 0
for (const file of readdirSync(DATA)) {
  if (!file.endsWith(".json")) continue
  if (file === "index.json") continue
  const src = join(DATA, file)
  const dst = join(DEST, file)
  if (existsSync(dst)) {
    console.log(`skip ${file} (already in reports-v1/)`)
    continue
  }
  renameSync(src, dst)
  moved++
  console.log(`moved ${file}`)
}

console.log(`done: ${moved} file(s) archived to data/reports-v1/`)
