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
import { SitesSidebar } from "../[siteId]/SitesSidebar";
import { ChatDrawerProvider } from "@/components/ScopeActions/components/ChatDrawerProvider";
import type { Order, OrderLineItem, Request } from "../../../../../../scripts/core/types";

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
    <section className="rounded-lg border border-border-default bg-surface">
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

interface ResultFile {
  request: {
    id: string;
    displayName?: string;
    categories: Array<{ id: string; name: string; extraInfo: string }>;
    sites: Array<{ id: string; url: string; meta?: Record<string, unknown> }>;
  };
  sites: Array<{
    siteId: string;
    url: string;
    artifacts: Record<string, unknown>;
  }>;
}

interface TechArtifact {
  platform: string;
}

interface LighthouseArtifact {
  performance: number;
  accessibility: number;
  seo: number;
}

interface ExtractArtifact {
  records: unknown[];
}

type CategoryProgress = Record<string, string>;

export default async function InformationPage({ params }: Params) {
  const { requestId } = await params;
  const repo = getRepo();

  let request: Request & { status: string };
  try {
    request = await repo.getRequest(requestId);
  } catch {
    notFound();
    // unreachable, but satisfies TS control flow
    throw new Error("not found");
  }
  const order = await repo.getOrder(requestId);

  // Build sidebar data from result.json
  let sidebarSites: Array<{
    id: string;
    url: string;
    name: string;
    platform?: string;
    lighthouse?: { performance: number; accessibility: number; seo: number };
    overallStatus: "pending" | "running" | "completed" | "failed";
    recordCount: number;
    meta: Record<string, unknown>;
  }> = [];

  try {
    const result = await repo.getJson<ResultFile>({
      requestId,
      stage: "",
      name: "result.json",
    });
    sidebarSites = result.request.sites.map((s) => {
      const siteData = result.sites.find((rs) => rs.siteId === s.id);
      const siteTechMap = (siteData?.artifacts["detect-tech"] ?? {}) as Record<string, TechArtifact>;
      const siteLhMap = (siteData?.artifacts["run-lighthouse"] ?? {}) as Record<string, LighthouseArtifact>;
      const siteProgressMap = (siteData?.artifacts["progress"] ?? {}) as Record<string, CategoryProgress>;

      const firstTech = Object.values(siteTechMap)[0];
      const firstLh = Object.values(siteLhMap)[0];

      const allStatuses = Object.values(siteProgressMap).flatMap((cp) => Object.values(cp));
      const hasFailed = allStatuses.some((st) => st === "failed");
      const hasRunning = allStatuses.some((st) => st === "running");
      const allDone = allStatuses.length === 0 || allStatuses.every((st) => st === "completed" || st === "not-requested");
      const overallStatus = hasFailed ? "failed" as const : hasRunning ? "running" as const : allDone ? "completed" as const : "pending" as const;

      const siteExtractMap = (siteData?.artifacts["extract-pages-content"] ?? {}) as Record<string, ExtractArtifact>;
      const recordCount = Object.values(siteExtractMap).reduce((sum, e) => sum + (e.records?.length ?? 0), 0);
      const meta = s.meta ?? {};

      return {
        id: s.id,
        url: s.url,
        name: String(s.meta?.name ?? s.url),
        platform: firstTech?.platform,
        lighthouse: firstLh ? { performance: firstLh.performance, accessibility: firstLh.accessibility, seo: firstLh.seo } : undefined,
        overallStatus,
        recordCount,
        meta: Object.fromEntries(Object.entries(meta).filter(([k]) => k !== "name")),
      };
    });
  } catch {
    // result.json may not exist yet — show sidebar with basic info
    sidebarSites = request.sites.map((s) => ({
      id: s.id,
      url: s.url,
      name: String(s.meta?.name ?? s.url),
      overallStatus: "pending" as const,
      recordCount: 0,
      meta: Object.fromEntries(Object.entries(s.meta ?? {}).filter(([k]) => k !== "name")),
    }));
  }

  const displayName = request.displayName ?? requestId;

  return (
    <ChatDrawerProvider requestId={requestId}>
      <SitesSidebar
        request={request}
        requestId={requestId}
        displayName={displayName}
        sites={sidebarSites}
        currentSiteId="__information__"
      />

      <main className="ml-65 min-h-screen bg-surface-alt px-8 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              {request.displayName ?? request.id}
            </h1>
            <p className="text-sm text-foreground-muted">
              {new Date(request.createdAt).toLocaleString()} ·{" "}
              {request.sites.length} site(s) · {request.categories.length} categor
              {request.categories.length === 1 ? "y" : "ies"}
            </p>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg border border-border-default bg-surface">
              <Accordion>
                <AccordionItem value="configuration">
                  <AccordionTrigger className="px-5 py-4 text-foreground">
                    <span className="text-lg font-semibold">Analysis Configuration</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="divide-y divide-divide-default border-t border-border-default px-5 pb-4">
                      {request.categories.map((c) => (
                        <div key={c.id} className="py-3 first:pt-3">
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

            <section className="rounded-lg border border-border-default bg-surface">
              <h2 className="px-5 py-4 text-lg font-semibold text-foreground">Analyzed Sites</h2>
              <ul className="divide-y divide-border-default border-t border-border-default">
                {request.sites.map((s) => {
                  const orderSite = order?.sites.find((os) => os.siteId === s.id);
                  const pageCount = orderSite?.pageCount;
                  const categoryNames = request.categories.map((c) => c.name);
                  const tooltipContent = (
                    <div className="space-y-1">
                      {pageCount != null && <div>{pageCount} page{pageCount === 1 ? "" : "s"} analyzed</div>}
                      <div>Categories: {categoryNames.join(", ")}</div>
                    </div>
                  );
                  return (
                    <li key={s.id}>
                      <Tooltip content={tooltipContent}>
                        <Link
                          href={`/analyses/${request.id}/${s.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-alt transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-accent-fg">
                              {String(s.meta?.name ?? s.url)}
                            </span>
                            <div className="mt-0.5 text-xs text-foreground-muted truncate">{s.url}</div>
                            {s.meta &&
                              Object.keys(s.meta).filter((k) => k !== "name").length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
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
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-sm text-foreground-secondary">
                            {pageCount != null && (
                              <span className="tabular-nums">
                                {pageCount} {pageCount === 1 ? "page" : "pages"}
                              </span>
                            )}
                            <span className="tabular-nums">
                              {categoryNames.length} {categoryNames.length === 1 ? "category" : "categories"}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-muted"><polyline points="9 18 15 12 9 6" /></svg>
                          </div>
                        </Link>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      </main>
    </ChatDrawerProvider>
  );
}
