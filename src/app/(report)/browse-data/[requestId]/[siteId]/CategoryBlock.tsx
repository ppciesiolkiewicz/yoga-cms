import { TechCard, LighthouseCard } from "./TechCard"
import { RecordRenderer } from "@/components/RecordRenderer"
import { Tooltip, StatusBadge, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui"

interface QueryInfo {
  id: string
  stage: string
  categoryId?: string
  prompt: string
  dataRefs: string[]
  model: string
}

type TaskStatus = "pending" | "running" | "completed" | "failed" | "not-requested"

interface TechArtifact {
  platform: string
  detectedTechnologies: Array<{ name: string; categories: string[]; version?: string; confidence?: number }>
  costBreakdown: Array<{ item: string; min: number; max: number }>
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
}

interface LighthouseArtifact {
  url?: string
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

interface Props {
  categoryId: string
  categoryName: string
  extraInfo: string
  classifiedUrls: string[]
  extractedRecords: unknown[]
  queries?: QueryInfo[]
  tech?: TechArtifact
  lighthouse?: LighthouseArtifact
  progress?: Record<string, TaskStatus>
}


function progressSummaryIcon(progress: Record<string, TaskStatus>): { icon: string; color: string } {
  const statuses = Object.values(progress)
  if (statuses.some(s => s === "failed")) return { icon: "\u2716", color: "text-red-500" }
  if (statuses.some(s => s === "running")) return { icon: "\u25CB", color: "text-blue-500 animate-pulse" }
  if (statuses.every(s => s === "completed" || s === "not-requested")) return { icon: "\u2714", color: "text-green-500" }
  return { icon: "\u25CB", color: "text-gray-400" }
}

function ProgressIcon({ progress }: { progress: Record<string, TaskStatus> }) {
  const { icon, color } = progressSummaryIcon(progress)
  const tooltipContent = (
    <div className="space-y-1">
      {Object.entries(progress).map(([task, status]) => (
        <div key={task} className="flex items-center gap-2">
          <StatusBadge status={status as TaskStatus} />
          <span>{task.replace(/-/g, " ")}</span>
        </div>
      ))}
    </div>
  )

  return (
    <Tooltip content={tooltipContent} side="left">
      <span className={`cursor-default text-lg ${color}`} aria-label="Pipeline progress">
        {icon}
      </span>
    </Tooltip>
  )
}

function QueryDetails({ query }: { query: QueryInfo }) {
  return (
    <Accordion className="mt-2 text-xs">
      <AccordionItem value="query">
        <AccordionTrigger className="text-xs text-blue-600 hover:underline py-1">
          <span>View AI query</span>
        </AccordionTrigger>
        <AccordionContent className="mt-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
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
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function getRecordHeader(record: unknown, index: number): { title: string; url: string } {
  if (typeof record !== "object" || record === null) return { title: `Record ${index + 1}`, url: "" }
  const obj = record as Record<string, unknown>

  let title = `Record ${index + 1}`
  for (const key of ["pageName", "name", "title", "studioName", "label"]) {
    if (typeof obj[key] === "string" && obj[key]) { title = obj[key] as string; break }
  }

  const url = typeof obj.url === "string" ? obj.url : ""
  return { title, url }
}

function ExtractedRecordCard({ record, index }: { record: unknown; index: number }) {
  const { title, url } = getRecordHeader(record, index)
  const recordObj = (typeof record === "object" && record !== null) ? record as Record<string, unknown> : {}

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-base font-semibold text-gray-900">{title}</div>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-sm text-blue-600 hover:underline truncate">
                {url}
              </a>
            )}
          </div>
        </div>
        <div className="mt-3">
          <RecordRenderer record={recordObj} />
        </div>
      </div>
      <Accordion className="border-t border-gray-100">
        <AccordionItem value="json">
          <AccordionTrigger className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700">
            <span>View raw JSON</span>
          </AccordionTrigger>
          <AccordionContent>
            <pre className="overflow-x-auto border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-700">
              {JSON.stringify(record, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export default function CategoryBlock(props: Props) {
  const extractQuery = props.queries?.find(q => q.stage === "extract-pages-content") ?? null

  return (
    <section
      id={`category-${props.categoryId}`}
      className="mb-6 rounded-lg border border-gray-200 bg-white p-6"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{props.categoryName}</h2>
          {props.extraInfo && (
            <p className="mt-1 text-sm text-gray-500">{props.extraInfo}</p>
          )}
        </div>
        {props.progress && <ProgressIcon progress={props.progress} />}
      </div>

      <TechCard tech={props.tech} />
      <LighthouseCard lighthouse={props.lighthouse} />

      {props.extractedRecords.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Page Analysis ({props.extractedRecords.length})
            </div>
          </div>
          {extractQuery && <QueryDetails query={extractQuery} />}
          <div className="mt-2 space-y-3">
            {props.extractedRecords.map((record, i) => (
              <ExtractedRecordCard key={i} record={record} index={i} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
