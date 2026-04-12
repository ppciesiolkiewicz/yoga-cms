import { ScoreBadge } from "./TechCard"

interface PageAssessment {
  url: string
  pageName: string
  conversionScore: number
  seoScore: number
  notes: string
}

interface Props {
  categoryId: string
  categoryName: string
  extraInfo: string
  classifiedUrls: string[]
  contentPages: PageAssessment[]
  extractedRecords: unknown[]
}

export default function CategoryBlock(props: Props) {
  return (
    <section
      id={`category-${props.categoryId}`}
      className="mb-6 rounded-lg border border-gray-200 bg-white p-6"
    >
      <h2 className="text-xl font-semibold text-gray-900">{props.categoryName}</h2>
      {props.extraInfo && (
        <p className="mt-1 mb-4 text-sm text-gray-500">{props.extraInfo}</p>
      )}

      {props.classifiedUrls.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Classified URLs
          </div>
          <ul className="space-y-1">
            {props.classifiedUrls.map(u => (
              <li key={u}>
                <a
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate block"
                >
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.contentPages.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Content Assessment
          </div>
          <div className="space-y-3">
            {props.contentPages.map(p => (
              <div
                key={p.url}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gray-900 hover:underline text-sm"
                  >
                    {p.pageName}
                  </a>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs text-gray-500">Conv</span>
                    <ScoreBadge score={p.conversionScore} />
                    <span className="ml-1 text-xs text-gray-500">SEO</span>
                    <ScoreBadge score={p.seoScore} />
                  </div>
                </div>
                {p.notes && (
                  <p className="mt-1 text-xs text-gray-600">{p.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {props.extractedRecords.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Extracted Data
          </div>
          <div className="space-y-3">
            {props.extractedRecords.map((record, i) => {
              if (!record || typeof record !== "object") {
                return (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                    {String(record)}
                  </div>
                )
              }
              const entries = Object.entries(record as Record<string, unknown>)
              return (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {entries.map(([key, value]) => (
                      <>
                        <dt key={`dt-${key}`} className="text-xs font-medium capitalize text-gray-500">
                          {key.replace(/_/g, " ")}
                        </dt>
                        <dd key={`dd-${key}`} className="text-xs text-gray-800">
                          {Array.isArray(value)
                            ? value.join(", ")
                            : value == null
                              ? <span className="text-gray-400">—</span>
                              : String(value)}
                        </dd>
                      </>
                    ))}
                  </dl>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
