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
          <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs text-gray-800">
            {JSON.stringify(props.extractedRecords, null, 2)}
          </pre>
        </div>
      )}
    </section>
  )
}
