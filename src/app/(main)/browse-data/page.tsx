import Link from "next/link"
import { getRepo } from "@/lib/repo-server"

export const dynamic = "force-dynamic"

export default async function BrowseDataPage() {
  const requests = (await getRepo().listRequests())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (requests.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold">Past Analyses</h1>
        <p className="mt-4 text-foreground-secondary">
          No analyses yet. Run <code className="rounded bg-surface-raised px-2 py-1">npm run analyze -- --input data/inputs/yoga.json</code> or <Link href="/create" className="text-accent-fg hover:underline">create one</Link>.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-accent-fg hover:underline">&larr; Home</Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Past Analyses</h1>
        <p className="text-sm text-foreground-muted">{requests.length} {requests.length === 1 ? "analysis" : "analyses"}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-default">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-alt text-xs uppercase text-foreground-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-center">Sites</th>
              <th className="px-4 py-3 text-center">Categories</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-surface-alt">
                <td className="px-4 py-3">
                  <Link href={`/browse-data/${req.id}`} className="font-medium text-accent-fg hover:underline">
                    {req.displayName ?? req.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground-secondary">{new Date(req.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">{req.siteCount}</td>
                <td className="px-4 py-3 text-center">{req.categoryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <Link href="/create" className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-foreground-on-accent hover:bg-accent-hover">
          Create new analysis
        </Link>
      </div>
    </main>
  )
}
