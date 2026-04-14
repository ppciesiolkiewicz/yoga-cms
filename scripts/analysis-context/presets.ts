import type { Repo } from "../db/repo"
import type { AnalysisContext, AnalysisContextScope } from "./types"
import { buildAnalysisContext } from "./build"

export function buildReportContext(repo: Repo, scope: AnalysisContextScope): Promise<AnalysisContext> {
  return buildAnalysisContext(repo, scope, { report: true })
}

export function buildExtractedContentContext(repo: Repo, scope: AnalysisContextScope): Promise<AnalysisContext> {
  return buildAnalysisContext(repo, scope, { extractedContent: true })
}
