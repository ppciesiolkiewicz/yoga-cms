import Link from "next/link";
import { getRepo } from "@/lib/repo-server";
import { AnalysesTable } from "./AnalysesTable";

export const dynamic = "force-dynamic";

export default async function AnalysesPage() {
  const requests = (await getRepo().listRequests()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  if (requests.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold text-foreground">Past Analyses</h1>
        <p className="mt-4 text-foreground-secondary">
          No analyses yet. Run{" "}
          <code className="rounded bg-surface-raised px-2 py-1">
            npm run analyze -- --input data/inputs/yoga.json
          </code>{" "}
          or{" "}
          <Link href="/create" className="text-accent-fg hover:underline">
            create one
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Past Analyses</h1>
        <p className="text-sm text-foreground-muted">
          {requests.length} {requests.length === 1 ? "analysis" : "analyses"}
        </p>
      </div>

      <AnalysesTable requests={requests} />

      <div className="mt-6">
        <Link
          href="/create"
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-foreground-on-accent hover:bg-accent-hover"
        >
          Create new analysis
        </Link>
      </div>
    </main>
  );
}
