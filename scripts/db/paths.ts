import { join } from "path"
import type { ArtifactRef } from "../core/types"

export function dbRoot(dataDir: string): string {
  return join(dataDir, "db")
}

export function requestDir(root: string, requestId: string): string {
  return join(root, "requests", requestId)
}

export function siteDir(root: string, requestId: string, siteId: string): string {
  return join(requestDir(root, requestId), "sites", siteId)
}

export function refToPath(root: string, ref: ArtifactRef): string {
  const base = ref.siteId
    ? siteDir(root, ref.requestId, ref.siteId)
    : requestDir(root, ref.requestId)
  return join(base, ref.stage, ref.name)
}
