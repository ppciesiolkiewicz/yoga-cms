import { SETTINGS } from "./settings"
import type { Provider } from "./ai-client"

export function requireApiKeysFor(providers: Provider[]): void {
  const unique = Array.from(new Set(providers))
  const missing: string[] = []
  for (const p of unique) {
    const env = SETTINGS.providers[p].apiKeyEnv
    if (!process.env[env]) missing.push(env)
  }
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`)
  }
}
