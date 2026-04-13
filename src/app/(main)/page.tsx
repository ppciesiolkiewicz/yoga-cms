import Link from "next/link";
import { Button } from "@/components/ui/Button";

const features = [
  {
    title: "Multi-Category Analysis",
    description:
      "Define custom categories like Home, Contact, or FAQ and analyze each one with tailored prompts.",
    icon: "🗂",
  },
  {
    title: "Tech Detection",
    description:
      "Automatically detect frameworks, CMS platforms, and third-party tools used across sites.",
    icon: "🔍",
  },
  {
    title: "Performance Audits",
    description:
      "Run Lighthouse audits to measure performance, accessibility, and SEO scores.",
    icon: "⚡",
  },
  {
    title: "AI-Powered Insights",
    description:
      "Extract structured content and assess page quality using Claude.",
    icon: "🤖",
  },
];

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Understand any domain,
          <br />
          <span className="text-accent-fg">site by site</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-foreground-secondary">
          WebAnalyzer crawls and evaluates multiple websites in a domain so you
          can compare competitors, spot trends, and research an entire industry
          — all from a single place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/create">Start a new analysis</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/analyses">Browse past analyses</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border-subtle bg-surface-alt py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-semibold text-foreground">
            How it works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border-default bg-surface p-6 shadow-sm"
              >
                <span className="text-2xl">{f.icon}</span>
                <h3 className="mt-3 text-lg font-medium text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm text-foreground-secondary">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-semibold text-foreground">
            Ready to analyze?
          </h2>
          <p className="mt-2 text-foreground-secondary">
            Create an input file with your target sites and categories, then let
            the pipeline do the rest.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/create">Get started</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
