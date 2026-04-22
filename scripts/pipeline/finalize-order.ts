import type { Repo } from "../db/repo"
import type { Request, Order, AIQuery } from "../core/types"
import type { PricingConfig } from "../quote/pricing"
import { lookupModelPricing } from "../quote/pricing"

function tokenCost(
  query: AIQuery,
  config: { inputPer1kTokens: number; outputPer1kTokens: number },
): { inputTokens: number; outputTokens: number; cost: number } {
  const inputTokens = query.usage?.inputTokens ?? Math.ceil(query.prompt.length / 4)
  const outputTokens = query.usage?.outputTokens ?? Math.ceil(query.response.length / 4)
  const cost =
    (inputTokens / 1000) * config.inputPer1kTokens +
    (outputTokens / 1000) * config.outputPer1kTokens
  return { inputTokens, outputTokens, cost }
}

export async function finalizeOrder(
  repo: Repo,
  request: Request,
  pricing: PricingConfig,
): Promise<void> {
  const order = await repo.getJson<Order>({
    requestId: request.id, stage: "order", name: "order.json",
  })

  for (const orderSite of order.sites) {
    const queries = await repo.getQueries(request.id, orderSite.siteId)

    // Group AI queries by stage
    const queryByStage: Record<string, AIQuery[]> = {}
    for (const q of queries) {
      ;(queryByStage[q.stage] ??= []).push(q)
    }

    // Get actual page count
    let actualPageCount = orderSite.pageCount
    try {
      const index = await repo.getJson<{ pages: Array<{ status: string }> }>({
        requestId: request.id, siteId: orderSite.siteId, stage: "fetch-pages", name: "index.json",
      })
      actualPageCount = index.pages.filter(p => p.status === "ok").length
    } catch {
      // use estimated count
    }

    for (const li of orderSite.lineItems) {
      if (li.stage === "service-fee") {
        li.actualQuantity = actualPageCount
        li.actualCost = actualPageCount * li.unitCost
      } else if (li.stage === "fetch-pages") {
        li.actualQuantity = actualPageCount
        li.actualCost = actualPageCount * li.unitCost
      } else if (li.stage === "extract-pages-content") {
        const stageQueries = queryByStage[li.stage] ?? []
        let totalInputTokens = 0
        let totalCost = 0
        for (const q of stageQueries) {
          const aiConfig = lookupModelPricing(pricing, q.provider, q.model)
          const result = tokenCost(q, aiConfig)
          totalInputTokens += result.inputTokens + result.outputTokens
          totalCost += result.cost
        }
        li.actualQuantity = totalInputTokens
        li.actualCost = totalCost
      } else if (li.stage === "run-lighthouse" || li.stage === "detect-tech") {
        // Fixed cost stages — actual = estimated
        li.actualQuantity = li.quantity
        li.actualCost = li.estimatedCost
      } else if (li.stage === "estimate-content") {
        li.actualQuantity = li.quantity
        li.actualCost = li.estimatedCost
      }
    }
  }

  order.status = "completed"
  order.completedAt = new Date().toISOString()
  order.totalActualCost = order.sites.reduce(
    (total, s) => total + s.lineItems.reduce((st, li) => st + (li.actualCost ?? li.estimatedCost), 0),
    0,
  )

  await repo.putJson(
    { requestId: request.id, stage: "order", name: "order.json" },
    order,
  )
}
