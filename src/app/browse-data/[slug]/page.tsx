import { notFound } from "next/navigation"
import { getStudioReport, getAllStudioSummaries } from "@/lib/data"
import { StudioSidePanel } from "./StudioSidePanel"
import { ScrollSpy } from "./ScrollSpy"
import type {
  StudioReport,
  TechAssessment,
  DetectedTechnology,
  Features,
  NavLink,
  ContentAssessment,
  DropInPageAssessment,
  TrainingPageAssessment,
  RetreatPageAssessment,
  ContactInfo,
  ProgressiveDisclosure,
} from "../../../../scripts/scraper/types"

export const dynamic = "force-dynamic"

export default async function StudioDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const report = getStudioReport(slug)
  if (!report) notFound()
  const summaries = getAllStudioSummaries()

  return (
    <>
    <StudioSidePanel studios={summaries} currentSlug={slug} />
    <main className="ml-65 max-w-5xl px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{report.studioName}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>{report.city}</span>
          <a href={report.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {report.website}
          </a>
          <span>Scraped {new Date(report.scrapedAt).toLocaleDateString()}</span>
        </div>
      </div>

      <TechCard tech={report.tech} />
      <FeaturesCard features={report.features} />
      <NavigationCard navigation={report.navigation} />
      <ContentAssessmentCard assessment={report.contentAssessment} />
      <ContactCard contact={report.contact} />
      <ExtractedDataCard report={report} />
    </main>
    <ScrollSpy />
    </>
  )
}

// ── Tech Stack Card ──────────────────────────────────────────────────────────

function TechCard({ tech }: { tech: TechAssessment }) {
  return (
    <section id="tech" className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">
        <a href="#tech" className="cursor-pointer hover:text-blue-600">Tech Stack</a>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-gray-500">Platform</p>
          <p className="mt-1 font-medium">{tech.platform}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500">Estimated Cost / mo</p>
          <p className="mt-1 font-medium">
            ${tech.totalEstimatedMonthlyCost.min}–{tech.totalEstimatedMonthlyCost.max}{" "}
            {tech.totalEstimatedMonthlyCost.currency}
          </p>
        </div>
      </div>

      {tech.detectedTechnologies.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase text-gray-500">
            Detected Technologies ({tech.detectedTechnologies.length})
          </p>
          <DetectedTechList technologies={tech.detectedTechnologies} />
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs uppercase text-gray-500">Lighthouse Scores</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <LighthouseScore label="Performance" value={tech.lighthouse.performance} />
          <LighthouseScore label="Accessibility" value={tech.lighthouse.accessibility} />
          <LighthouseScore label="SEO" value={tech.lighthouse.seo} />
          <LighthouseScore label="Best Practices" value={tech.lighthouse.bestPractices} />
        </div>
      </div>

      {tech.costBreakdown.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase text-gray-500">Cost Breakdown</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {tech.costBreakdown.map(item => (
              <li key={item.item} className="flex justify-between py-1">
                <span>{item.item}</span>
                <span className="text-gray-500">
                  ${item.estimatedMonthlyCost.min}–{item.estimatedMonthlyCost.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function TechTooltipContent({ t }: { t: DetectedTechnology }) {
  return (
    <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 w-60 -translate-x-1/2 pb-1.5 opacity-0 transition-[opacity,visibility] duration-75 delay-[0ms] group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-hover:delay-350">
      <div className="rounded-md border border-gray-700 bg-gray-900 p-2.5 text-left text-[11px] text-gray-100 shadow-lg">
        <div className="mb-1 font-semibold text-white">
          {t.name}
          {t.version && <span className="ml-1 font-mono text-gray-400">v{t.version}</span>}
        </div>
        <div className="text-gray-300">{t.categories.join(" · ") || t.category}</div>
        {typeof t.confidence === "number" && (
          <div className="text-gray-400">Confidence: {t.confidence}%</div>
        )}
        {t.description && <div className="mt-1 text-gray-300">{t.description}</div>}
        {t.website && (
          <a
            href={t.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all text-blue-300 underline-offset-2 hover:underline"
          >
            {t.website}
          </a>
        )}
      </div>
    </div>
  )
}

function DetectedTechList({ technologies }: { technologies: DetectedTechnology[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {technologies.map(t => {
        const label = t.name + (t.version ? ` ${t.version}` : "")
        const chipClass =
          "inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 hover:border-gray-300"
        return (
          <div key={t.name} className="group relative">
            {t.website ? (
              <a href={t.website} target="_blank" rel="noopener noreferrer" className={chipClass}>
                {label}
              </a>
            ) : (
              <span className={chipClass}>{label}</span>
            )}
            <TechTooltipContent t={t} />
          </div>
        )
      })}
    </div>
  )
}

function LighthouseScore({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90
      ? "bg-green-100 text-green-800"
      : value >= 50
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800"
  return (
    <div className="flex flex-col items-center rounded-lg border border-gray-100 p-3">
      <span className={`text-2xl font-bold ${color.split(" ")[1]}`}>{value}</span>
      <span className="mt-1 text-center text-xs text-gray-500">{label}</span>
    </div>
  )
}

// ── Features Card ────────────────────────────────────────────────────────────

function FeaturesCard({ features }: { features: Features }) {
  const boolFeatures: { label: string; value: boolean }[] = [
    { label: "Online Classes", value: features.onlineClasses },
    { label: "E-commerce", value: features.ecommerce },
    { label: "Newsletter", value: features.newsletter },
    { label: "Blog", value: features.blog },
    { label: "Multi-language", value: features.multiLanguage },
  ]

  return (
    <section id="features" className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">
        <a href="#features" className="cursor-pointer hover:text-blue-600">Features</a>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {features.onlineBooking && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">&#10003;</span>
            <span>Online Booking: <span className="text-gray-500">{features.onlineBooking}</span></span>
          </div>
        )}
        {features.chat && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">&#10003;</span>
            <span>Chat: <span className="text-gray-500">{features.chat}</span></span>
          </div>
        )}
        {boolFeatures.map(f => (
          <div key={f.label} className="flex items-center gap-2 text-sm">
            <span className={f.value ? "text-green-600" : "text-red-400"}>
              {f.value ? "✓" : "✗"}
            </span>
            <span className={f.value ? "" : "text-gray-400"}>{f.label}</span>
          </div>
        ))}
      </div>
      {features.addOnServices.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs uppercase text-gray-500">Add-on Services</p>
          <div className="flex flex-wrap gap-2">
            {features.addOnServices.map(s => (
              <span key={s} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{s}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Navigation Card ──────────────────────────────────────────────────────────

function NavigationCard({ navigation }: { navigation: NavLink[] }) {
  if (navigation.length === 0) return null
  return (
    <section id="navigation" className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">
        <a href="#navigation" className="cursor-pointer hover:text-blue-600">Navigation</a>
      </h2>
      <ul className="flex flex-wrap gap-2">
        {navigation.map(link => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-gray-200 px-3 py-1 text-sm text-blue-600 hover:bg-gray-50 hover:underline"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Content Assessment Card ──────────────────────────────────────────────────

function ContentAssessmentCard({ assessment }: { assessment: ContentAssessment }) {
  const pct = assessment.overallScore * 10
  const scoreColor =
    pct >= 70
      ? "bg-green-100 text-green-800"
      : pct >= 40
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800"

  return (
    <section id="content-assessment" className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">
          <a href="#content-assessment" className="cursor-pointer hover:text-blue-600">Content Assessment</a>
        </h2>
        <span className={`rounded-full px-3 py-0.5 text-sm font-medium ${scoreColor}`}>
          {assessment.overallScore}/10
        </span>
      </div>
      <p className="text-sm text-gray-600">{assessment.summary}</p>

      {assessment.dropInPages.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Drop-in Pages</h3>
          <div className="space-y-3">
            {assessment.dropInPages.map(page => (
              <DropInPageCard key={page.url} page={page} />
            ))}
          </div>
        </div>
      )}

      {assessment.trainingPages.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Training Pages</h3>
          <div className="space-y-3">
            {assessment.trainingPages.map(page => (
              <TrainingPageCard key={page.url} page={page} />
            ))}
          </div>
        </div>
      )}

      {assessment.retreatPages.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium">Retreat Pages</h3>
          <div className="space-y-3">
            {assessment.retreatPages.map(page => (
              <RetreatPageCard key={page.url} page={page} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function DualScoreBadges({ conversion, seo }: { conversion: number; seo: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">Conv</span>
      <ScoreBadge score={conversion} />
      <span className="ml-1 text-xs text-gray-500">SEO</span>
      <ScoreBadge score={seo} />
    </div>
  )
}

function DropInPageCard({ page }: { page: DropInPageAssessment }) {
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
          {page.pageName}
        </a>
        <DualScoreBadges conversion={page.conversionScore} seo={page.seoScore} />
        {!page.scheduleVisible && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Schedule hidden</span>
        )}
        {!page.pricesClear && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Prices unclear</span>
        )}
      </div>
      {page.notes && <p className="mt-2 text-xs text-gray-500">{page.notes}</p>}
    </div>
  )
}

function TrainingPageCard({ page }: { page: TrainingPageAssessment }) {
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
          {page.pageName}
        </a>
        <DualScoreBadges conversion={page.conversionScore} seo={page.seoScore} />
        {page.fillerContentWarning && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Filler Content</span>
        )}
        {page.whyChooseUsWarning && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Why Choose Us</span>
        )}
        <span className="text-xs text-gray-400">Key info: {page.keyInfoScrollDepthEstimate}</span>
      </div>
      <DisclosureChecklist disclosure={page.progressiveDisclosure} />
      {page.notes && <p className="mt-2 text-xs text-gray-500">{page.notes}</p>}
    </div>
  )
}

function RetreatPageCard({ page }: { page: RetreatPageAssessment }) {
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
          {page.pageName}
        </a>
        <DualScoreBadges conversion={page.conversionScore} seo={page.seoScore} />
      </div>
      <DisclosureChecklist disclosure={page.progressiveDisclosure} />
      {page.notes && <p className="mt-2 text-xs text-gray-500">{page.notes}</p>}
    </div>
  )
}

function DisclosureChecklist({ disclosure }: { disclosure: ProgressiveDisclosure }) {
  const items: { label: string; value: boolean }[] = [
    { label: "When", value: disclosure.when },
    { label: "Where", value: disclosure.where },
    { label: "Price", value: disclosure.price },
    { label: "What", value: disclosure.what },
    { label: "How long", value: disclosure.howLong },
  ]
  return (
    <div className="mt-2 flex gap-3">
      {items.map(item => (
        <span
          key={item.label}
          className={`flex items-center gap-1 text-xs ${item.value ? "text-green-600" : "text-red-400"}`}
        >
          <span>{item.value ? "✓" : "✗"}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  )
}

function ScoreBadge({ score, max = 10 }: { score: number; max?: number }) {
  const pct = max === 100 ? score : score * 10
  const color =
    pct >= 70
      ? "bg-green-100 text-green-800"
      : pct >= 40
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800"
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score}{max === 100 ? "" : "/10"}
    </span>
  )
}

// ── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ contact }: { contact: ContactInfo }) {
  const hasAny =
    contact.email ||
    contact.phone ||
    contact.whatsapp ||
    contact.instagram ||
    contact.facebook ||
    contact.address ||
    contact.contactPageUrl

  if (!hasAny) return null

  return (
    <section id="contact" className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">
        <a href="#contact" className="cursor-pointer hover:text-blue-600">Contact</a>
      </h2>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {contact.email && (
          <>
            <dt className="text-gray-500">Email</dt>
            <dd>
              <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
            </dd>
          </>
        )}
        {contact.phone && (
          <>
            <dt className="text-gray-500">Phone</dt>
            <dd>{contact.phone}</dd>
          </>
        )}
        {contact.whatsapp && (
          <>
            <dt className="text-gray-500">WhatsApp</dt>
            <dd>{contact.whatsapp}</dd>
          </>
        )}
        {contact.address && (
          <>
            <dt className="text-gray-500">Address</dt>
            <dd>{contact.address}</dd>
          </>
        )}
        {contact.instagram && (
          <>
            <dt className="text-gray-500">Instagram</dt>
            <dd>
              <a href={contact.instagram} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {contact.instagram}
              </a>
            </dd>
          </>
        )}
        {contact.facebook && (
          <>
            <dt className="text-gray-500">Facebook</dt>
            <dd>
              <a href={contact.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {contact.facebook}
              </a>
            </dd>
          </>
        )}
        {contact.contactPageUrl && (
          <>
            <dt className="text-gray-500">Contact Page</dt>
            <dd>
              <a href={contact.contactPageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {contact.contactPageUrl}
              </a>
            </dd>
          </>
        )}
      </dl>
    </section>
  )
}

// ── Extracted Data Card ───────────────────────────────────────────────────────

function ExtractedDataCard({ report }: { report: StudioReport }) {
  const hasData =
    report.dropInClasses.length > 0 || report.trainings.length > 0 || report.retreats.length > 0

  if (!hasData) return null

  return (
    <section id="extracted-data" className="scroll-mt-4 rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">
        <a href="#extracted-data" className="cursor-pointer hover:text-blue-600">Extracted Data</a>
      </h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {report.dropInClasses.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Drop-in Classes ({report.dropInClasses.length})
            </h3>
            <ul className="space-y-2 text-sm">
              {report.dropInClasses.map((c, i) => (
                <li key={i} className="rounded border border-gray-100 p-2">
                  <p className="font-medium">{c.className}</p>
                  <p className="text-xs text-gray-500">{c.style}</p>
                  {c.schedule && <p className="text-xs text-gray-400">{c.schedule}</p>}
                  {c.price && <p className="text-xs text-gray-400">{c.price}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.trainings.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Trainings ({report.trainings.length})
            </h3>
            <ul className="space-y-2 text-sm">
              {report.trainings.map((t, i) => (
                <li key={i} className="rounded border border-gray-100 p-2">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.type}</p>
                  {t.duration && <p className="text-xs text-gray-400">{t.duration}</p>}
                  {t.price && <p className="text-xs text-gray-400">{t.price}</p>}
                  {t.certification && (
                    <p className="text-xs text-blue-600">{t.certification}</p>
                  )}
                  {t.dates && t.dates.length > 0 && (
                    <p className="text-xs text-gray-400">{t.dates.join(", ")}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.retreats.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Retreats ({report.retreats.length})
            </h3>
            <ul className="space-y-2 text-sm">
              {report.retreats.map((r, i) => (
                <li key={i} className="rounded border border-gray-100 p-2">
                  <p className="font-medium">{r.name}</p>
                  {r.duration && <p className="text-xs text-gray-400">{r.duration}</p>}
                  {r.price && <p className="text-xs text-gray-400">{r.price}</p>}
                  {r.dates && r.dates.length > 0 && (
                    <p className="text-xs text-gray-400">{r.dates.join(", ")}</p>
                  )}
                  {r.description && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{r.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
