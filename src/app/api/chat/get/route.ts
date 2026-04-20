import { NextResponse } from "next/server"
import { decodeScope } from "../../../../../scripts/analysis-context/scope-codec"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scopeRaw = url.searchParams.get("scope") ?? ""
  const chatId = url.searchParams.get("chatId") ?? ""
  try {
    const scope = decodeScope(scopeRaw)
    const record = await getRepo().getScopedChat(scope, chatId)
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
