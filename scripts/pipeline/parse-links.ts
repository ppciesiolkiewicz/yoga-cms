import * as cheerio from "cheerio"
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"

const NOISE_PATH_PATTERNS = [
  /^\/?privacy/i, /^\/?terms/i, /^\/?cookie/i, /^\/?impressum/i,
  /^\/?legal/i, /^\/?login/i, /^\/?register/i, /^\/?account/i,
  /^\/?cart/i, /^\/?checkout/i, /^\/?wp-admin/i, /^\/?feed/i,
  /\.(pdf|zip|jpg|jpeg|png|gif|svg|webp|ico)$/i,
]

function isNoise(u: URL): boolean {
  return NOISE_PATH_PATTERNS.some(p => p.test(u.pathname))
}

function labelFromPath(u: URL): string {
  const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean)
  if (parts.length === 0) return "home"
  return parts[parts.length - 1].replace(/[-_]/g, " ")
}

export interface NavLink { label: string; href: string }

export async function parseLinks(repo: Repo, request: Request, site: Site): Promise<void> {
  const homeHtmlBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "fetch-home", name: "home.html",
  })
  const html = homeHtmlBuf.toString("utf8")
  const base = new URL(site.url)
  const $ = cheerio.load(html)
  const seen = new Set<string>([site.url])
  const links: NavLink[] = []

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    let u: URL
    try { u = new URL(href, site.url) } catch { return }
    if (u.hostname !== base.hostname) return
    const key = `${u.origin}${u.pathname}`.replace(/\/$/, "")
    if (seen.has(key)) return
    if (isNoise(u)) return
    seen.add(key)
    const text = $(el).text().replace(/\s+/g, " ").trim()
    links.push({ label: text || labelFromPath(u), href: u.href })
  })

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "parse-links", name: "nav-links.json" },
    { links },
  )
}
