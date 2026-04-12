import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "SERPER_API_KEY not configured" }, { status: 401 })
  }

  const body = await req.json()
  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  const serperBody: Record<string, unknown> = { q: body.query }
  if (body.page) serperBody.page = body.page
  if (body.gl) serperBody.gl = body.gl

  const serperRes = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serperBody),
  })

  const data = await serperRes.json()
  return NextResponse.json(data, { status: serperRes.status })
}
