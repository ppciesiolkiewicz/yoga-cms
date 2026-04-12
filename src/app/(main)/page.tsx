import Link from "next/link";

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
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Understand any domain,
          <br />
          <span className="text-blue-600">site by site</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
          Site Analyzer crawls and evaluates multiple websites in a domain so you
          can compare competitors, spot trends, and research an entire industry
          — all from a single input file.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/create"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 transition-colors"
          >
            Start a new analysis
          </Link>
          <Link
            href="/browse-data"
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Browse past analyses
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-semibold text-gray-900">
            How it works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <span className="text-2xl">{f.icon}</span>
                <h3 className="mt-3 text-lg font-medium text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            Ready to analyze?
          </h2>
          <p className="mt-2 text-gray-600">
            Create an input file with your target sites and categories, then let
            the pipeline do the rest.
          </p>
          <Link
            href="/create"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-700 transition-colors"
          >
            Get started
          </Link>
        </div>
      </section>
    </main>
  );
}
