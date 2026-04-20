"use client"

import { TechCard, LighthouseCard } from "./TechCard"
import { Tooltip, ScoreBadge, StatusBadge, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui"
import { RecordRenderer } from "@/components/RecordRenderer"
import { ScopeActions } from "@/components/ScopeActions"
import { slugify } from "@/lib/utils"

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
  requestId: string
  siteId: string
  categoryId: string
  categoryName: string
  extraInfo: string
  classifiedUrls: string[]
  contentPages: PageAssessment[]
  extractedRecords: unknown[]
  queries?: QueryInfo[]
  tech?: TechArtifact
  lighthouse?: LighthouseArtifact
  progress?: Record<string, TaskStatus>
  tourAnchor?: boolean
}


function progressSummaryIcon(progress: Record<string, TaskStatus>): { icon: string; color: string } {
  const statuses = Object.values(progress)
  if (statuses.some(s => s === "failed")) return { icon: "\u2716", color: "text-error" }
  if (statuses.some(s => s === "running")) return { icon: "\u25CB", color: "text-accent-fg animate-pulse" }
  if (statuses.every(s => s === "completed" || s === "not-requested")) return { icon: "\u2714", color: "text-success" }
  return { icon: "\u25CB", color: "text-foreground-faint" }
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
        <AccordionTrigger className="text-xs text-accent-fg hover:underline py-1">
          <span>View AI query</span>
        </AccordionTrigger>
        <AccordionContent className="mt-2 space-y-2 rounded border border-border-default bg-surface-alt p-3">
          <div>
            <span className="font-semibold text-foreground-secondary">Model:</span> {query.model}
          </div>
          <div>
            <span className="font-semibold text-foreground-secondary">Prompt:</span>
            <pre className="mt-1 whitespace-pre-wrap text-foreground-secondary">{query.prompt}</pre>
          </div>
          {query.dataRefs.length > 0 && (
            <div>
              <span className="font-semibold text-foreground-secondary">Data ({query.dataRefs.length} pages):</span>
              <ul className="mt-1 text-foreground-secondary">
                {query.dataRefs.map(ref => <li key={ref} className="truncate">{ref}</li>)}
              </ul>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function getRecordSummary(record: unknown, index: number): { title: string; url: string; pageLabel: string; badges: string[] } {
  if (typeof record !== "object" || record === null) return { title: `Record ${index + 1}`, url: "", pageLabel: "", badges: [] }
  const obj = record as Record<string, unknown>

  // Find a good title from common keys
  let title = `Record ${index + 1}`
  for (const key of ["name", "title", "studioName", "pageName", "label"]) {
    if (typeof obj[key] === "string" && obj[key]) { title = obj[key] as string; break }
  }

  const url = typeof obj.url === "string" ? obj.url : ""

  // Page label from pageType or pageName, capitalized
  let pageLabel = ""
  for (const key of ["pageType", "pageName", "type"]) {
    if (typeof obj[key] === "string" && obj[key]) {
      pageLabel = (obj[key] as string).replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      break
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

  return { title, url, pageLabel, badges: badges.slice(0, 5) }
}

function ExtractedRecordCard({ record, index }: { record: unknown; index: number }) {
  const { title, url, pageLabel } = getRecordSummary(record, index)
  const isObject = typeof record === "object" && record !== null

  return (
    <div className="rounded-lg border border-border-default bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-foreground-muted">Page</span>
      </div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm text-accent-fg hover:underline truncate">
          {pageLabel ? `${pageLabel} \u2014 ${url}` : url}
        </a>
      )}

      {isObject && (
        <div className="mt-3">
          <RecordRenderer record={record as Record<string, unknown>} />
        </div>
      )}

      <Accordion className="mt-3 border-t border-border-subtle">
        <AccordionItem value="json">
          <AccordionTrigger className="py-2 text-xs text-foreground-muted hover:text-foreground-secondary">
            <span>View raw JSON</span>
          </AccordionTrigger>
          <AccordionContent>
            <pre className="overflow-x-auto rounded bg-surface-alt px-3 py-2 text-xs text-foreground-secondary">
              {JSON.stringify(record, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export default function CategoryBlock(props: Props) {
  const contentQuery = props.queries?.find(q => q.stage === "assess-pages") ?? null
  const extractQuery = props.queries?.find(q => q.stage === "extract-pages-content") ?? null
  const isEmpty =
    !props.tech &&
    !props.lighthouse &&
    props.contentPages.length === 0 &&
    props.extractedRecords.length === 0

  return (
    <section
      id={`category-${slugify(props.categoryName)}`}
      {...(props.tourAnchor ? { "data-tour": "site-category" } : {})}
      className="mb-6 rounded-lg border border-border-default bg-surface p-6"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-foreground">
              <a href={`#category-${slugify(props.categoryName)}`} className="hover:text-accent-fg transition-colors">
                {props.categoryName}
              </a>
            </h2>
            <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-foreground-muted">Category</span>
          </div>
          {props.extraInfo && (
            <p className="mt-1 text-sm text-foreground-muted">
              <span className="text-xs font-semibold">Classification prompt:</span> {props.extraInfo}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div {...(props.tourAnchor ? { "data-tour": "site-category-actions" } : {})}>
            <ScopeActions
              scope={{
                kind: "category",
                requestId: props.requestId,
                categoryId: props.categoryId,
              }}
            />
          </div>
          {props.progress && <ProgressIcon progress={props.progress} />}
        </div>
      </div>

      <TechCard tech={props.tech} />
      <LighthouseCard lighthouse={props.lighthouse} />

      {isEmpty && (
        <p className="text-sm text-foreground-muted">
          No data was found for this category.
        </p>
      )}


      {props.contentPages.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Content Assessment
          </div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Analyzed pages</h3>
          {contentQuery && <QueryDetails query={contentQuery} />}
          <div className="space-y-3">
            {props.contentPages.map(p => (
              <div
                key={p.url}
                className="rounded-lg border border-border-subtle bg-surface-alt p-3"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground hover:underline text-sm"
                  >
                    {p.pageName}
                  </a>
                  <span className="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-foreground-muted">Page</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs text-foreground-muted">Conv</span>
                    <ScoreBadge score={p.conversionScore} />
                    <span className="ml-1 text-xs text-foreground-muted">SEO</span>
                    <ScoreBadge score={p.seoScore} />
                  </div>
                </div>
                {p.notes && (
                  <p className="mt-1 text-xs text-foreground-secondary">{p.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {props.extractedRecords.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Analyzed pages</h3>
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
