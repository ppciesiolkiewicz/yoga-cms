import { Badge } from "./shadcn/badge"

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-success-subtle text-success"
      : score >= 5
        ? "bg-warning-subtle text-warning"
        : "bg-error-subtle text-error"
  return (
    <Badge variant="outline" className={`border-transparent ${color}`}>
      {score}/10
    </Badge>
  )
}
