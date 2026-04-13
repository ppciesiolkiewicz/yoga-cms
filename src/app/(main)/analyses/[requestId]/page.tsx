import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/repo-server";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Tooltip,
} from "@/components/ui";
import type { Order, OrderLineItem } from "../../../../../scripts/core/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ requestId: string }>;
}

type CostBucket = "scraping" | "ai" | "service";

function bucketFor(li: OrderLineItem): CostBucket {
  if (li.stage === "service-fee") return "service";
  if (li.stage === "fetch-home" || li.stage === "fetch-pages") return "scraping";
  return "ai";
}

const BUCKET_LABEL: Record<CostBucket, string> = {
  scraping: "Web scraping & data collection",
  ai: "AI content analysis",
  service: "Platform fee",
};

const BUCKET_DESC: Record<CostBucket, string> = {
  scraping: "Fetching homepage and subpages via Firecrawl",
  ai: "Navigation classification and content extraction via Claude",
  service: "Per-page service charge",
};

function fmt(n: number) {
  return `$${n.toFixed(4)}`;
}

function CostBreakdown({ order }: { order: Order }) {
  const estimated: Record<CostBucket, number> = { scraping: 0, ai: 0, service: 0 };
  const actual: Record<CostBucket, number> = { scraping: 0, ai: 0, service: 0 };

  for (const site of order.sites) {
    for (const li of site.lineItems) {
      const key = bucketFor(li);
      estimated[key] += li.estimatedCost;
      actual[key] += li.actualCost ?? li.estimatedCost;
    }
  }

  const buckets: CostBucket[] = ["scraping", "ai", "service"];
  const totalEstimated = buckets.reduce((s, k) => s + estimated[k], 0);
  const totalActual = buckets.reduce((s, k) => s + actual[k], 0);
  const diff = totalActual - totalEstimated;
  const savedMoney = diff < -0.00005;
  const overBudget = diff > 0.00005;

  return (
    <section className="mb-8 rounded-lg border border-border-default bg-surface">
      <Accordion>
        <AccordionItem value="price-breakdown">
          <AccordionTrigger className="px-5 py-4 text-foreground">
            <div className="flex items-baseline gap-3 text-left">
              <span className="text-lg font-semibold">Price Breakdown</span>
              <span className="text-sm tabular-nums text-foreground-secondary">
                {fmt(totalActual)}
              </span>
              {(savedMoney || overBudget) && (
                <span
                  className={`text-xs ${
                    savedMoney
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {savedMoney
                    ? `${fmt(Math.abs(diff))} under quote`
                    : `${fmt(diff)} over quote`}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="border-t border-border-default px-5 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-foreground-muted">
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((key) => (
                    <tr key={key} className="border-t border-border-default">
                      <td className="py-3">
                        <div className="font-medium text-foreground">{BUCKET_LABEL[key]}</div>
                        <div className="text-xs text-foreground-muted">{BUCKET_DESC[key]}</div>
                      </td>
                      <td className="py-3 text-right align-top">
                        <Tooltip content={`Quoted: ${fmt(estimated[key])}`}>
                          <span className="tabular-nums text-foreground-secondary cursor-default">
                            {fmt(actual[key])}
                          </span>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border-strong">
                    <td className="pt-4 pb-2 font-semibold text-foreground">
                      Total
                    </td>
                    <td className="pt-4 pb-2 text-right">
                      <Tooltip content={`Quoted: ${fmt(totalEstimated)}`}>
                        <span className="font-semibold tabular-nums text-foreground cursor-default">
                          {fmt(totalActual)}
                        </span>
                      </Tooltip>
                    </td>
                  </tr>
                  {(savedMoney || overBudget) && (
                    <tr>
                      <td colSpan={2} className="pb-1 text-right">
                        <span
                          className={`text-xs ${
                            savedMoney
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {savedMoney
                            ? `You paid ${fmt(Math.abs(diff))} less than quoted`
                            : `You paid ${fmt(diff)} more than quoted`}
                        </span>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

export default async function RequestDetailPage({ params }: Params) {
  const { requestId } = await params;
  const repo = getRepo();
  let request;
  try {
    request = await repo.getRequest(requestId);
  } catch {
    notFound();
  }
  const order = await repo.getOrder(requestId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/analyses"
        className="text-sm text-accent-fg hover:underline"
      >
        &larr; All Analyses
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground">
          {request.displayName ?? request.id}
        </h1>
        <p className="text-sm text-foreground-muted">
          {new Date(request.createdAt).toLocaleString()} ·{" "}
          {request.sites.length} site(s) · {request.categories.length} categor
          {request.categories.length === 1 ? "y" : "ies"}
        </p>
      </div>

      <section className="mb-8 rounded-lg border border-border-default bg-surface">
        <Accordion>
          <AccordionItem value="configuration">
            <AccordionTrigger className="px-4 py-3 text-lg font-semibold text-foreground">
              <span>Analysis Configuration</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y divide-divide-default px-4 pb-4">
                {request.categories.map((c) => (
                  <div key={c.id} className="py-3 first:pt-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {c.name}
                      </span>
                      {c.wappalyzer && (
                        <span className="rounded-full border border-badge-purple-border bg-badge-purple px-2 py-0.5 text-xs text-badge-purple-fg">
                          wappalyzer
                        </span>
                      )}
                      {c.lighthouse && (
                        <span className="rounded-full border border-badge-orange-border bg-badge-orange px-2 py-0.5 text-xs text-badge-orange-fg">
                          lighthouse
                        </span>
                      )}
                    </div>
                    {c.extraInfo && (
                      <p className="mt-1 text-sm text-foreground-secondary">
                        {c.extraInfo}
                      </p>
                    )}
                    <Accordion className="mt-2">
                      <AccordionItem value={`prompt-${c.id}`}>
                        <AccordionTrigger className="text-xs text-accent-fg hover:underline py-1">
                          <span>View prompt</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="mt-1 whitespace-pre-wrap rounded border border-border-default bg-surface-alt p-3 text-xs text-foreground-secondary">
                            {c.prompt}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {order && <CostBreakdown order={order} />}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-foreground">Analyzed Sites</h2>
        <ul className="divide-y divide-divide-default rounded-lg border border-border-default bg-surface">
          {request.sites.map((s) => (
            <li key={s.id} className="px-4 py-3 hover:bg-surface-alt">
              <Link
                href={`/analyses/${request.id}/${s.id}`}
                className="font-medium text-accent-fg hover:underline"
              >
                {String(s.meta?.name ?? s.url)}
              </Link>
              <div className="text-xs text-foreground-muted">{s.url}</div>
              {s.meta &&
                Object.keys(s.meta).filter((k) => k !== "name").length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(s.meta)
                      .filter(([k]) => k !== "name")
                      .map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-foreground-secondary"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                  </div>
                )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
