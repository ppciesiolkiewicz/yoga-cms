interface NavLink {
  label: string
  href: string
}

interface ExtractNavArtifact {
  links: NavLink[]
}

export function NavigationCard({ nav }: { nav?: ExtractNavArtifact }) {
  if (!nav || nav.links.length === 0) return null

  return (
    <section id="navigation" className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Navigation</h2>
      <div className="flex flex-wrap gap-2">
        {nav.links.map((link, i) => (
          <a
            key={i}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  )
}
