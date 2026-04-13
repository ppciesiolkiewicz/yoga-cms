import { Badge } from "./shadcn/badge"

const statusStyles: Record<string, string> = {
  completed: "bg-success-subtle text-success",
  running: "bg-accent-subtle text-accent-fg animate-pulse",
  pending: "bg-surface-raised text-foreground-secondary",
  failed: "bg-error-subtle text-error",
  "not-requested": "bg-surface-alt text-foreground-faint",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={`border-transparent ${statusStyles[status] ?? statusStyles.pending}`}>
      {status}
    </Badge>
  )
}
