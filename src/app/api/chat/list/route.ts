import { NextResponse } from "next/server"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestId = url.searchParams.get("requestId") ?? ""
  if (!requestId) return NextResponse.json({ error: "missing requestId" }, { status: 400 })
  try {
    const metas = await getRepo().listChats(requestId)
    return NextResponse.json(metas)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
