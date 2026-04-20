"use client"

import Link from "next/link"
import { Tooltip } from "@/components/ui"

type RequestStatus = "pending" | "processing" | "complete" | "rejected"

interface AnalysisRow {
  id: string
  displayName?: string
  createdAt: string
  siteCount: number
  categoryCount: number
  status: RequestStatus
  chatCount: number
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  complete: "Complete",
  rejected: "Rejected",
}

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: "bg-warning-subtle text-warning",
  processing: "bg-accent-subtle text-accent-fg",
  complete: "bg-success-subtle text-success",
  rejected: "bg-error-subtle text-error",
}

const STATUS_TOOLTIP: Record<RequestStatus, string> = {
  pending: "Quote — awaiting processing",
  processing: "Processing — analysis in progress",
  complete: "Order — analysis complete",
  rejected: "Rejected — analysis failed",
}

function Row({ req }: { req: AnalysisRow }) {
  return (
    <tr className="hover:bg-surface-alt">
      <td className="px-4 py-3">
        <Link
          href={`/analyses/${req.id}`}
          className="font-medium text-accent-fg hover:underline"
        >
          {req.displayName ?? req.id}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Tooltip content={STATUS_TOOLTIP[req.status]}>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[req.status]}`}
          >
            {STATUS_LABEL[req.status]}
          </span>
        </Tooltip>
      </td>
      <td className="px-4 py-3 text-foreground-secondary">
        {new Date(req.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-center">{req.siteCount}</td>
      <td className="px-4 py-3 text-center">{req.categoryCount}</td>
      <td className="px-4 py-3 text-center">{req.chatCount}</td>
    </tr>
  )
}

export function AnalysesTable({ requests }: { requests: AnalysisRow[] }) {
  const completed = requests.filter(
    (r) => r.status === "complete" || r.status === "rejected",
  )
  const pending = requests.filter(
    (r) => r.status === "pending" || r.status === "processing",
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-alt text-xs uppercase text-foreground-muted">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-center">Sites</th>
            <th className="px-4 py-3 text-center">Categories</th>
            <th className="px-4 py-3 text-center">Questions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divide-default">
          {completed.map((req) => (
            <Row key={req.id} req={req} />
          ))}
        </tbody>
        {pending.length > 0 && (
          <>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border-strong" />
                    <span className="text-xs font-medium uppercase tracking-wide text-foreground-faint">
                      Pending
                    </span>
                    <div className="h-px flex-1 bg-border-strong" />
                  </div>
                </td>
              </tr>
            </tbody>
            <tbody className="divide-y divide-divide-default">
              {pending.map((req) => (
                <Row key={req.id} req={req} />
              ))}
            </tbody>
          </>
        )}
      </table>
    </div>
  )
}
