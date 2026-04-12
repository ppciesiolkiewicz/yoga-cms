import Link from "next/link"
import { getRepo } from "@/lib/repo-server"

export const dynamic = "force-dynamic"

export default async function BrowseDataPage() {
  const requests = (await getRepo().listRequests())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (requests.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold">Browse Analysis Requests</h1>
        <p className="mt-4 text-gray-600">
          No requests yet. Run <code className="rounded bg-gray-100 px-2 py-1">npm run analyze -- --input data/inputs/yoga.json</code>.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-blue-600 hover:underline">&larr; Home</Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Browse Analysis Requests</h1>
        <p className="text-sm text-gray-500">{requests.length} request(s)</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Display name</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-center">Sites</th>
              <th className="px-4 py-3 text-center">Categories</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/browse-data/${req.id}`} className="font-medium text-blue-600 hover:underline">
                    {req.displayName ?? req.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{new Date(req.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">{req.siteCount}</td>
                <td className="px-4 py-3 text-center">{req.categoryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
