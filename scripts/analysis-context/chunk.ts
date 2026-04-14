import type { AnalysisContext } from "./types"

const DEFAULT_MAX_BYTES = 150_000

export function chunkAnalysisContext(ctx: AnalysisContext, maxBytes: number = DEFAULT_MAX_BYTES): string[] {
  const full = JSON.stringify(ctx.json)
  if (Buffer.byteLength(full) <= maxBytes) return [full]

  const entries = Object.entries(ctx.json)
  const chunks: string[] = []
  let current: Record<string, unknown> = {}
  let currentSize = 2 // "{}"

  for (const [k, v] of entries) {
    const piece = JSON.stringify({ [k]: v })
    const pieceSize = Buffer.byteLength(piece)
    if (pieceSize > maxBytes) {
      if (Object.keys(current).length > 0) {
        chunks.push(JSON.stringify(current))
        current = {}
        currentSize = 2
      }
      chunks.push(piece)
      continue
    }
    if (currentSize + pieceSize > maxBytes && Object.keys(current).length > 0) {
      chunks.push(JSON.stringify(current))
      current = {}
      currentSize = 2
    }
    current[k] = v
    currentSize = Buffer.byteLength(JSON.stringify(current))
  }
  if (Object.keys(current).length > 0) chunks.push(JSON.stringify(current))
  return chunks
}
