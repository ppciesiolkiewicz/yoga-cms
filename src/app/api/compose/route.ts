import { NextResponse } from "next/server"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"
import { getRepo, resetRepoForTests } from "../../../lib/repo-server"

type Body = { scope: AnalysisContextScope; tiers: AnalysisContextTiers }

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
  if (!body?.scope?.requestId) {
    return NextResponse.json({ error: "missing requestId" }, { status: 400 })
  }
  if (process.env.NODE_ENV === "test") resetRepoForTests()
  try {
    const ctx = await buildAnalysisContext(getRepo(), body.scope, body.tiers ?? {})
    return NextResponse.json(ctx)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
