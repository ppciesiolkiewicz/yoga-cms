import { ScoreBadge } from "@/components/ui"

interface DetectedTechnology {
  name: string
  categories: string[]
  version?: string
  confidence?: number
}

interface CostItem {
  item: string
  min: number
  max: number
}

interface TechArtifact {
  platform: string
  detectedTechnologies: DetectedTechnology[]
  costBreakdown: CostItem[]
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
}

interface LighthouseArtifact {
  url?: string
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

function LighthouseScore({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90
      ? "text-green-700"
      : value >= 50
        ? "text-yellow-700"
        : "text-red-700"
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-100 p-3">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="mt-1 text-center text-xs text-gray-500">{label}</span>
    </div>
  )
}

export function TechCard({ tech }: { tech?: TechArtifact }) {
  if (!tech) return null

  return (
    <section id="detect-tech" className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Tech</h2>

      {tech && (
        <>
          {tech.platform && (
            <div className="mb-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Platform</div>
              <div className="text-sm font-medium text-gray-800">{tech.platform}</div>
            </div>
          )}

          {tech.detectedTechnologies.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Detected Technologies
              </div>
              <div className="flex flex-wrap gap-2">
                {tech.detectedTechnologies.map((t, i) => (
                  <span
                    key={i}
                    title={[
                      t.categories.join(", "),
                      t.version ? `v${t.version}` : "",
                      t.confidence != null ? `${Math.round(t.confidence * 100)}% confidence` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    className="cursor-default rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {t.name}
                    {t.version && (
                      <span className="ml-1 text-gray-400">v{t.version}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tech.costBreakdown.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Cost Estimate (monthly)
              </div>
              <div className="space-y-1">
                {tech.costBreakdown.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{c.item}</span>
                    <span className="font-medium text-gray-900">
                      {c.min === c.max
                        ? `$${c.min}`
                        : `$${c.min}–$${c.max}`}
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
                  <span className="text-gray-700">Total</span>
                  <span className="text-gray-900">
                    {tech.totalEstimatedMonthlyCost.min === tech.totalEstimatedMonthlyCost.max
                      ? `${tech.totalEstimatedMonthlyCost.currency}${tech.totalEstimatedMonthlyCost.min}`
                      : `${tech.totalEstimatedMonthlyCost.currency}${tech.totalEstimatedMonthlyCost.min}–${tech.totalEstimatedMonthlyCost.max}`}
                    /mo
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </section>
  )
}

export function LighthouseCard({ lighthouse }: { lighthouse?: LighthouseArtifact }) {
  if (!lighthouse) return null

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Lighthouse</h2>
      {lighthouse.url && (
        <p className="mb-3 text-xs text-gray-500 truncate">{lighthouse.url}</p>
      )}
      <div className="grid grid-cols-4 gap-2">
        <LighthouseScore label="Performance" value={lighthouse.performance} />
        <LighthouseScore label="Accessibility" value={lighthouse.accessibility} />
        <LighthouseScore label="SEO" value={lighthouse.seo} />
        <LighthouseScore label="Best Practices" value={lighthouse.bestPractices} />
      </div>
    </section>
  )
}
