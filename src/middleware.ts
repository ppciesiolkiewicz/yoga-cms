import { NextResponse, type NextRequest } from "next/server";

const USERNAME = process.env.BASIC_AUTH_USER ?? "admin";
const PASSWORD = process.env.BASIC_AUTH_PASS ?? "dharamshala6";

export function middleware(req: NextRequest) {
  const header = req.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const idx = decoded.indexOf(":");
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user === USERNAME && pass === PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="yoga-cms"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
