interface NavLink {
  label: string
  href: string
}

interface CategoryInfo {
  id: string
  name: string
}

interface Props {
  nav?: { links: NavLink[] }
  classify?: { byCategory: Record<string, string[]> }
  categories: CategoryInfo[]
}

const CATEGORY_COLORS = [
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-yellow-100 text-yellow-700 border-yellow-200",
]

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`.replace(/\/$/, "").toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

export function NavigationCard({ nav, classify, categories }: Props) {
  if (!nav || nav.links.length === 0) return null

  // Build URL → category mapping
  const urlToCategory = new Map<string, CategoryInfo>()
  if (classify) {
    for (const cat of categories) {
      const urls = classify.byCategory[cat.id] ?? []
      for (const url of urls) {
        urlToCategory.set(normalizeUrl(url), cat)
      }
    }
  }

  const colorMap = new Map<string, string>()
  categories.forEach((cat, i) => {
    colorMap.set(cat.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length])
  })

  // Split: categorized first, then uncategorized
  const categorized: Array<NavLink & { category: CategoryInfo }> = []
  const uncategorized: NavLink[] = []

  for (const link of nav.links) {
    const cat = urlToCategory.get(normalizeUrl(link.href))
    if (cat) {
      categorized.push({ ...link, category: cat })
    } else {
      uncategorized.push(link)
    }
  }

  return (
    <section id="navigation" className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">
        Navigation ({nav.links.length})
      </h2>

      {categorized.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Categorized
          </div>
          <div className="flex flex-wrap gap-2">
            {categorized.map((link, i) => {
              const color = colorMap.get(link.category.id) ?? CATEGORY_COLORS[0]
              return (
                <a
                  key={i}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:opacity-80 ${color}`}
                >
                  <span className="opacity-60">{link.category.name}</span>
                  <span className="opacity-40">·</span>
                  {link.label}
                </a>
              )
            })}
          </div>
        </div>
      )}

      {uncategorized.length > 0 && (
        <div>
          {categorized.length > 0 && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Other
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {uncategorized.map((link, i) => (
              <a
                key={i}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
