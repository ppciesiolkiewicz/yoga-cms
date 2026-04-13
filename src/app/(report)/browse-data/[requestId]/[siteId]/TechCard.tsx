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
      ? "text-success"
      : value >= 50
        ? "text-warning"
        : "text-error"
  return (
    <div className="flex flex-col items-center rounded-lg border border-border-subtle p-3">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="mt-1 text-center text-xs text-foreground-muted">{label}</span>
    </div>
  )
}

export function TechCard({ tech }: { tech?: TechArtifact }) {
  if (!tech) return null

  return (
    <section id="detect-tech" className="mb-6 rounded-lg border border-border-default bg-surface p-6">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Tech</h2>

      {tech && (
        <>
          {tech.platform && (
            <div className="mb-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Platform</div>
              <div className="text-sm font-medium text-foreground">{tech.platform}</div>
            </div>
          )}

          {tech.detectedTechnologies.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
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
                    className="cursor-default rounded-full border border-border-default bg-surface-alt px-3 py-1 text-xs font-medium text-foreground-secondary hover:bg-surface-raised"
                  >
                    {t.name}
                    {t.version && (
                      <span className="ml-1 text-foreground-faint">v{t.version}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tech.costBreakdown.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                Cost Estimate (monthly)
              </div>
              <div className="space-y-1">
                {tech.costBreakdown.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-foreground-secondary">{c.item}</span>
                    <span className="font-medium text-foreground">
                      {c.min === c.max
                        ? `$${c.min}`
                        : `$${c.min}–$${c.max}`}
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2 text-sm font-semibold">
                  <span className="text-foreground-secondary">Total</span>
                  <span className="text-foreground">
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
    <section className="mb-6 rounded-lg border border-border-default bg-surface p-6">
      <h2 className="mb-4 text-xl font-semibold text-foreground">Lighthouse</h2>
      {lighthouse.url && (
        <p className="mb-3 text-xs text-foreground-muted truncate">{lighthouse.url}</p>
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
