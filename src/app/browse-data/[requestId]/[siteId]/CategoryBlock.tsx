interface PageAssessment {
  url: string
  pageName: string
  conversionScore: number
  seoScore: number
  notes: string
}

interface Props {
  categoryName: string
  extraInfo: string
  classifiedUrls: string[]
  contentPages: PageAssessment[]
  extractedRecords: unknown[]
}

export default function CategoryBlock(props: Props) {
  return (
    <section className="mb-8 rounded border border-gray-200 p-4">
      <h3 className="text-xl font-semibold">{props.categoryName}</h3>
      <p className="mb-4 text-sm text-gray-500">{props.extraInfo}</p>

      {props.classifiedUrls.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Classified URLs</div>
          <ul className="text-sm">
            {props.classifiedUrls.map(u => <li key={u} className="truncate">{u}</li>)}
          </ul>
        </div>
      )}

      {props.contentPages.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Content assessment</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500">
              <th className="py-1">Page</th><th className="py-1 text-center">Conv</th><th className="py-1 text-center">SEO</th><th className="py-1">Notes</th>
            </tr></thead>
            <tbody>
              {props.contentPages.map(p => (
                <tr key={p.url} className="border-t border-gray-100">
                  <td className="py-1 font-medium">{p.pageName}</td>
                  <td className="py-1 text-center">{p.conversionScore}</td>
                  <td className="py-1 text-center">{p.seoScore}</td>
                  <td className="py-1 text-gray-600">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {props.extractedRecords.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Extracted records</div>
          <pre className="overflow-auto rounded bg-gray-50 p-2 text-xs">
            {JSON.stringify(props.extractedRecords, null, 2)}
          </pre>
        </div>
      )}
    </section>
  )
}
