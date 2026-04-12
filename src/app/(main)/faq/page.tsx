"use client"

import { Collapsible } from "@/components/ui/Collapsible"

const faqs = [
  {
    question: "Do I need to be a domain expert to use this?",
    answer:
      "Not at all. A handful of keywords is enough to get started. Search for terms you associate with the space, pick the sites that look relevant, and the pipeline handles the rest — fetching pages and extracting structured content for you.",
  },
  {
    question: "I want to understand a domain better — how does this help?",
    answer:
      "Run a broad search, select a diverse set of sites (leaders, newcomers, niche players), and add categories that matter to you (pricing, services, blog, etc.). The generated report gives you a structured comparison across all sites — a fast way to map out any space.",
  },
  {
    question: "I want to analyze a lot of pages — any limits?",
    answer:
      "No hard limit on sites or categories. Each site\u00d7category combination runs its own analysis, so the more you add, the longer the pipeline takes. Tip: start with 5\u201310 sites and 2\u20133 categories to get results quickly, then expand from there.",
  },
  {
    question: "What does the pipeline actually do with each site?",
    answer:
      "For every site, it fetches the homepage, discovers internal links, and classifies navigation into the categories you defined. Then for each category it finds relevant pages, optionally detects technologies and runs Lighthouse audits, assesses page quality with AI, extracts structured content, and builds a final report.",
  },
  {
    question: "What are categories?",
    answer:
      "Categories are the lenses through which you analyze each site. \"Home\" and \"Contact\" are included by default. You can add your own — like \"Pricing\", \"Blog\", or \"Services\" — each with a custom prompt describing what to extract. Every site gets analyzed once per category.",
  },
  {
    question: "What do the Wappalyzer and Lighthouse toggles do?",
    answer:
      "Wappalyzer detects the technology stack (frameworks, CMS, analytics tools, etc.) used by each site. Lighthouse runs Google's performance and accessibility audit. Both are optional per category — enable them when you want that extra data.",
  },
]

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Frequently Asked Questions</h1>
      <p className="mt-1 text-sm text-gray-500">
        Common questions about creating and running analyses.
      </p>

      <div className="mt-6 space-y-2">
        {faqs.map((faq) => (
          <div key={faq.question} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <Collapsible
              trigger={
                <span className="font-medium text-gray-800">{faq.question}</span>
              }
            >
              <p className="pb-1 pt-2 text-sm leading-relaxed text-gray-600">
                {faq.answer}
              </p>
            </Collapsible>
          </div>
        ))}
      </div>
    </main>
  )
}
