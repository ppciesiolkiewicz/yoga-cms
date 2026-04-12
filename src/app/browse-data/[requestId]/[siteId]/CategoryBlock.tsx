import { ScoreBadge } from "./TechCard"

interface PageAssessment {
  url: string
  pageName: string
  conversionScore: number
  seoScore: number
  notes: string
}

interface QueryInfo {
  id: string
  stage: string
  categoryId?: string
  prompt: string
  dataRefs: string[]
  model: string
}

interface Props {
  categoryId: string
  categoryName: string
  extraInfo: string
  classifiedUrls: string[]
  contentPages: PageAssessment[]
  extractedRecords: unknown[]
  queries?: QueryInfo[]
}

function QueryDetails({ query }: { query: QueryInfo }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-blue-600 hover:underline">View AI query</summary>
      <div className="mt-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
        <div>
          <span className="font-semibold text-gray-700">Model:</span> {query.model}
        </div>
        <div>
          <span className="font-semibold text-gray-700">Prompt:</span>
          <pre className="mt-1 whitespace-pre-wrap text-gray-600">{query.prompt}</pre>
        </div>
        {query.dataRefs.length > 0 && (
          <div>
            <span className="font-semibold text-gray-700">Data ({query.dataRefs.length} pages):</span>
            <ul className="mt-1 text-gray-600">
              {query.dataRefs.map(ref => <li key={ref} className="truncate">{ref}</li>)}
            </ul>
          </div>
        )}
      </div>
    </details>
  )
}

function getRecordSummary(record: unknown, index: number): { title: string; subtitle: string; badges: string[] } {
  if (typeof record !== "object" || record === null) return { title: `Record ${index + 1}`, subtitle: "", badges: [] }
  const obj = record as Record<string, unknown>

  // Find a good title from common keys
  let title = `Record ${index + 1}`
  for (const key of ["name", "title", "studioName", "pageName", "label"]) {
    if (typeof obj[key] === "string" && obj[key]) { title = obj[key] as string; break }
  }

  // Subtitle: url or first short string that isn't the title
  let subtitle = ""
  if (typeof obj.url === "string") {
    subtitle = obj.url
  } else {
    for (const [, val] of Object.entries(obj)) {
      if (typeof val === "string" && val !== title && val.length > 0 && val.length < 100) {
        subtitle = val; break
      }
    }
  }

  // Collect tags from short arrays of strings
  const badges: string[] = []
  for (const [, val] of Object.entries(obj)) {
    if (Array.isArray(val) && val.length > 0 && val.length <= 8 && val.every(v => typeof v === "string")) {
      badges.push(...(val as string[]).slice(0, 5))
      if (badges.length >= 5) break
    }
  }

  return { title, subtitle, badges: badges.slice(0, 5) }
}

function ExtractedRecordCard({ record, index, categoryName, extraInfo }: { record: unknown; index: number; categoryName: string; extraInfo: string }) {
  const { title, subtitle, badges } = getRecordSummary(record, index)

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3">
        <div className="text-base font-semibold text-gray-900">{title}</div>
        {subtitle && (
          subtitle.startsWith("http") ? (
            <a href={subtitle} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-sm text-blue-600 hover:underline truncate">
              {subtitle}
            </a>
          ) : (
            <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>
          )
        )}
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium text-gray-600">category:</span> {categoryName.toLowerCase()}
        </div>
        {extraInfo && (
          <div className="text-xs text-gray-400">{extraInfo}</div>
        )}
        {badges.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {badges.map((b, i) => (
              <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{b}</span>
            ))}
          </div>
        )}
      </div>
      <details className="border-t border-gray-100">
        <summary className="cursor-pointer select-none px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700">
          View raw JSON
        </summary>
        <pre className="overflow-x-auto border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-700">
          {JSON.stringify(record, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default function CategoryBlock(props: Props) {
  const contentQuery = props.queries?.find(q => q.stage === "content") ?? null
  const extractQuery = props.queries?.find(q => q.stage === "extract") ?? null

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
          {contentQuery && <QueryDetails query={contentQuery} />}
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
            Extracted Data ({props.extractedRecords.length})
          </div>
          {extractQuery && <QueryDetails query={extractQuery} />}
          <div className="mt-2 space-y-2">
            {props.extractedRecords.map((record, i) => (
              <ExtractedRecordCard key={i} record={record} index={i} categoryName={props.categoryName} extraInfo={props.extraInfo} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
