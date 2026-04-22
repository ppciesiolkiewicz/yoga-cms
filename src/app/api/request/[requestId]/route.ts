import { NextResponse } from "next/server"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  try {
    const r = await getRepo().getRequest(requestId)
    return NextResponse.json(r)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not found" },
      { status: 404 },
    )
  }
}
