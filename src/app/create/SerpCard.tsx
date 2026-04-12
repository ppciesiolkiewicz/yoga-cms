"use client"

import type { SerperResponse } from "@/lib/serp-types"
import { Card } from "@/components/ui/Card"
import { Checkbox } from "@/components/ui/Checkbox"
import { Chip } from "@/components/ui/Chip"
import { Collapsible } from "@/components/ui/Collapsible"

export function SerpCard({
  query,
  response,
  selectedUrls,
  onToggleUrl,
  onSearchRelated,
}: {
  query: string
  response: SerperResponse
  selectedUrls: Set<string>
  onToggleUrl: (url: string, title: string, snippet: string) => void
  onSearchRelated: (query: string) => void
}) {
  return (
    <Card className="min-w-[600px] max-w-[600px] flex-shrink-0 overflow-y-auto p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-500">{query}</h3>

      {/* Knowledge Graph */}
      {response.knowledgeGraph && (
        <div className="mb-4 rounded-md border border-gray-100 bg-gray-50 p-3">
          <div className="flex gap-3">
            {response.knowledgeGraph.imageUrl && (
              <img
                src={response.knowledgeGraph.imageUrl}
                alt={response.knowledgeGraph.title ?? ""}
                className="h-16 w-16 rounded object-cover"
              />
            )}
            <div>
              {response.knowledgeGraph.title && (
                <div className="font-medium">{response.knowledgeGraph.title}</div>
              )}
              {response.knowledgeGraph.type && (
                <div className="text-xs text-gray-500">{response.knowledgeGraph.type}</div>
              )}
              {response.knowledgeGraph.description && (
                <div className="mt-1 text-sm text-gray-600">{response.knowledgeGraph.description}</div>
              )}
            </div>
          </div>
          {response.knowledgeGraph.attributes && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {Object.entries(response.knowledgeGraph.attributes).map(([k, v]) => (
                <div key={k}>
                  <dt className="inline font-medium text-gray-500">{k}: </dt>
                  <dd className="inline text-gray-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Organic Results */}
      {response.organic?.map((result) => (
        <div key={result.link} className="mb-3 flex items-start gap-2">
          <div className="pt-0.5">
            <Checkbox
              label=""
              checked={selectedUrls.has(result.link)}
              onCheckedChange={() => onToggleUrl(result.link, result.title, result.snippet)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-green-700 truncate">{result.link}</div>
            <div className="text-sm font-medium text-blue-800">{result.title}</div>
            <div className="text-xs text-gray-600">{result.snippet}</div>
            {result.sitelinks && (
              <div className="mt-1 flex flex-wrap gap-1">
                {result.sitelinks.map((sl) => (
                  <a key={sl.link} href={sl.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    {sl.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* People Also Ask */}
      {response.peopleAlsoAsk && response.peopleAlsoAsk.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">People also ask</div>
          <div className="space-y-1">
            {response.peopleAlsoAsk.map((paa) => (
              <Collapsible
                key={paa.question}
                trigger={<span className="text-sm text-gray-800">{paa.question}</span>}
                className="rounded border border-gray-100 px-3 py-2"
              >
                <div className="mt-2 text-xs text-gray-600">
                  {paa.snippet}
                  {paa.link && (
                    <a href={paa.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                      Source
                    </a>
                  )}
                </div>
              </Collapsible>
            ))}
          </div>
        </div>
      )}

      {/* Top Stories */}
      {response.topStories && response.topStories.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Top stories</div>
          <div className="space-y-2">
            {response.topStories.map((story) => (
              <a key={story.link} href={story.link} target="_blank" rel="noopener noreferrer" className="block text-sm">
                <div className="font-medium text-blue-800 hover:underline">{story.title}</div>
                <div className="text-xs text-gray-500">{story.source}{story.date && ` \u00b7 ${story.date}`}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Images */}
      {response.images && response.images.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Images</div>
          <div className="flex gap-2 overflow-x-auto">
            {response.images.slice(0, 6).map((img) => (
              <a key={img.imageUrl} href={img.link} target="_blank" rel="noopener noreferrer">
                <img src={img.imageUrl} alt={img.title} className="h-20 w-20 rounded object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Related Searches */}
      {response.relatedSearches && response.relatedSearches.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Related searches</div>
          <div className="flex flex-wrap gap-2">
            {response.relatedSearches.map((rs) => (
              <Chip key={rs.query} onClick={() => onSearchRelated(rs.query)}>
                {rs.query}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
