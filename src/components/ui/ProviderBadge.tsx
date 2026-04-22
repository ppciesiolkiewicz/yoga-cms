import { Badge } from "./shadcn/badge"
import type { Provider } from "../../../core/ai-client"

type Props = {
  provider: Provider
  className?: string
}

const LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  groq: "Groq",
}

const TONES: Record<Provider, string> = {
  anthropic: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  groq: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
}

export function ProviderBadge({ provider, className = "" }: Props) {
  return (
    <Badge variant="outline" className={`${TONES[provider]} ${className}`}>
      {LABELS[provider]}
    </Badge>
  )
}
