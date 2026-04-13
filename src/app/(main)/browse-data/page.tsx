import Link from "next/link"
import { getRepo } from "@/lib/repo-server"
import type { RequestStatus } from "../../../scripts/core/types"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  complete: "Complete",
  rejected: "Rejected",
}

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
}

export default async function BrowseDataPage() {
  const requests = (await getRepo().listRequests())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (requests.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold">Past Analyses</h1>
        <p className="mt-4 text-gray-600">
          No analyses yet. Run <code className="rounded bg-gray-100 px-2 py-1">npm run analyze -- --input data/inputs/yoga.json</code> or <Link href="/create" className="text-blue-600 hover:underline">create one</Link>.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-blue-600 hover:underline">&larr; Home</Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Past Analyses</h1>
        <p className="text-sm text-gray-500">{requests.length} {requests.length === 1 ? "analysis" : "analyses"}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-center">Sites</th>
              <th className="px-4 py-3 text-center">Categories</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.map(req => {
              const status = req.status
              return (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/browse-data/${req.id}`} className="font-medium text-blue-600 hover:underline">
                      {req.displayName ?? req.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(req.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">{req.siteCount}</td>
                  <td className="px-4 py-3 text-center">{req.categoryCount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <Link href="/create" className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Create new analysis
        </Link>
      </div>
    </main>
  )
}
