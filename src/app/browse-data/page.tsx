import Link from "next/link"
import { getAllStudioSummaries } from "@/lib/data"

export const dynamic = "force-dynamic"

export default function BrowseDataPage() {
  const studios = getAllStudioSummaries().sort((a, b) => a.city.localeCompare(b.city))

  if (studios.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold">Browse Studio Data</h1>
        <p className="mt-4 text-gray-600">
          No data yet. Run <code className="rounded bg-gray-100 px-2 py-1">npm run scrape</code> to scrape studios.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Browse Studio Data</h1>
        <p className="text-sm text-gray-500">
          {studios.length} studios
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Studio</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3 text-center">Content Score</th>
              <th className="px-4 py-3 text-center">Lighthouse</th>
              <th className="px-4 py-3 text-right">Est. Cost/mo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {studios.map(studio => (
              <tr key={studio.slug} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/browse-data/${studio.slug}`} className="font-medium text-blue-600 hover:underline">
                    {studio.studioName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{studio.city}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{studio.platform}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreBadge score={studio.overallContentScore} />
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreBadge score={studio.lighthousePerformance} max={100} />
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  ${studio.estimatedMonthlyCost.min}-{studio.estimatedMonthlyCost.max}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function ScoreBadge({ score, max = 10 }: { score: number; max?: number }) {
  const pct = max === 100 ? score : score * 10
  const color = pct >= 70 ? "bg-green-100 text-green-800" : pct >= 40 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score}{max === 100 ? "" : "/10"}
    </span>
  )
}
