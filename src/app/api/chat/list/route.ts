import { NextResponse } from "next/server"
import { decodeScope } from "../../../../../scripts/analysis-context/scope-codec"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scopeRaw = url.searchParams.get("scope") ?? ""
  try {
    const scope = decodeScope(scopeRaw)
    const metas = await getRepo().listScopedChats(scope)
    return NextResponse.json(metas)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
