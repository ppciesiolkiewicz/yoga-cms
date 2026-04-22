import { NextResponse } from "next/server"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestId = url.searchParams.get("requestId") ?? ""
  const chatId = url.searchParams.get("chatId") ?? ""
  if (!requestId || !chatId)
    return NextResponse.json({ error: "missing requestId or chatId" }, { status: 400 })
  try {
    const record = await getRepo().getChat(requestId, chatId)
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
