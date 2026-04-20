import { NextResponse } from "next/server"
import { decodeScope, decodeTiers } from "../../../../scripts/analysis-context/scope-codec"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import { getRepo, resetRepoForTests } from "../../../lib/repo-server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scopeRaw = url.searchParams.get("scope") ?? ""
  const tiersRaw = url.searchParams.get("tiers") ?? ""
  try {
    const scope = decodeScope(scopeRaw)
    const tiers = decodeTiers(tiersRaw)
    if (process.env.NODE_ENV === "test") resetRepoForTests()
    const ctx = await buildAnalysisContext(getRepo(), scope, tiers)
    return NextResponse.json(ctx)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
