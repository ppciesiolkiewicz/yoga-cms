import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Yoga Studio Software Research | YogaCMS",
  description: "Research and comparison of yoga studio management software",
};

type Software = {
  name: string;
  website: string;
  tagline: string;
  pricing: string;
  focus: string;
  features: string[];
  pros: string[];
  cons: string[];
  badge?: string;
};

const software: Software[] = [
  {
    name: "Momoyoga",
    website: "https://www.momoyoga.com",
    tagline: "Built exclusively for yoga teachers and studios",
    pricing: "Free plan available. Standard ~\u20AC29/mo, Plus ~\u20AC59/mo, Custom ~\u20AC179/mo (billed annually)",
    focus: "Simplicity & yoga-only focus",
    badge: "Best for simplicity",
    features: [
      "Class scheduling & online booking",
      "Online payments (recurring memberships, class passes)",
      "Online teaching (Zoom, YouTube Live, Google Meet, Vimeo)",
      "Video on demand library",
      "Free mobile app for yogis (iOS & Android)",
      "Website integration (WordPress, Squarespace, Wix, Joomla)",
      "Waitlists & booking/cancellation windows",
      "Promo codes & donation payments",
      "Mailchimp integration (Plus plan)",
    ],
    pros: [
      "4.7/5 ease of use on Capterra \u2014 consistently praised as intuitive",
      "10,000+ teachers and 1,000,000+ yogis on the platform",
      "Free tier available with unlimited classes, yogis, and teachers",
      "Yoga-only product \u2014 every feature shaped around how studios work",
    ],
    cons: [
      "Limited advanced functionality for large multi-location studios",
      "Branding & recurring memberships locked behind Plus tier (\u20AC59/mo)",
      "Custom branded app only on highest tier (\u20AC179/mo)",
    ],
  },
  {
    name: "Zenamu",
    website: "https://zenamu.com",
    tagline: "Advanced course & programme management for yoga studios",
    pricing: "Free plan available. Paid plans from ~\u20AC16/mo, scaling to ~\u20AC72+/mo for unlimited",
    focus: "Course management & makeup sessions",
    badge: "Best for course management",
    features: [
      "Advanced course scheduling with makeup sessions & late enrollment",
      "Drop-in registration for single spots in ongoing courses",
      "Weekly schedules with even/odd week rotation",
      "Stripe & PayPal integration (Apple Pay, Google Pay)",
      "Membership plans (unlimited or capped access)",
      "Discount codes & gift vouchers",
      "Digital liability waivers with legally binding signatures",
      "Automatic late-cancellation fees",
      "Mobile app (iOS/Android) for clients & instructors",
      "Website embedding included in basic plans",
    ],
    pros: [
      "Cheapest paid option \u2014 starts at \u20AC16/mo",
      "Course management is best-in-class (makeup sessions, discounted remaining spots)",
      "Card payments & website embed included in basic plans (competitors charge extra)",
      "Users report +25% class participation, 60% less admin time",
      "Team actively improves based on user feedback",
    ],
    cons: [
      "Smaller user base / less brand recognition",
      "Fewer third-party integrations than larger competitors",
    ],
  },
  {
    name: "OfferingTree",
    website: "https://www.offeringtree.com",
    tagline: "All-in-one platform with built-in website builder",
    pricing: "Individual from ~$26/mo. Studio & Teams from ~$100/mo. 14-day free trial",
    focus: "All-in-one CMS replacing your website platform",
    badge: "Best all-in-one with CMS",
    features: [
      "Full website builder (replaces WordPress/Squarespace)",
      "Client booking & scheduling",
      "Payment processing & membership management",
      "Email marketing built-in",
      "On-demand video hosting",
      "Courses & workshops",
    ],
    pros: [
      "Replaces your website platform entirely \u2014 one subscription for everything",
      "4.8/5 across 84+ reviews, #1 rated for boutique wellness",
      "Built specifically for yoga, pilates, dance, boutique fitness",
      "No need to juggle separate booking, payment, email, and website tools",
    ],
    cons: [
      "Studio plan at $100/mo is pricier than booking-only alternatives",
      "Less flexibility than a dedicated website platform (WordPress, etc.)",
      "Smaller ecosystem of integrations",
    ],
  },
  {
    name: "Momence",
    website: "https://www.momence.com",
    tagline: "Modern studio management with powerful marketing automation",
    pricing: "Free plan (5% transaction fee). Basic $20/mo (1% fee). Pro ~$60/mo. Enterprise ~$99+/mo",
    focus: "Marketing automation & modern UX",
    badge: "Best for marketing",
    features: [
      "Class & appointment scheduling",
      "Landing pages & website plugins",
      "Point of sale",
      "Membership & pack management",
      "On-demand video library",
      "Newsletters & two-way texting",
      "Marketing automation & CRM",
      "Reporting & analytics",
    ],
    pros: [
      "Modern design with powerful marketing automation",
      "Free tier available with full feature access",
      "Competitive pricing \u2014 better value than Mindbody for comparable features",
      "5,000+ businesses on the platform",
    ],
    cons: [
      "Transaction fees on lower tiers (5% on free, 1% on basic)",
      "Reports of bugginess and unintuitive navigation after 2025 acquisition",
      "Customer support quality declined post-acquisition (Jan 2025)",
      "Payment processing fees relatively high (3.9% + $0.30 online)",
    ],
  },
  {
    name: "Mindbody",
    website: "https://www.mindbodyonline.com",
    tagline: "Industry leader with built-in consumer marketplace",
    pricing: "Starts ~$139/mo. Higher tiers $279\u2013$499+/mo. Per-transaction fees apply",
    focus: "Enterprise features & consumer marketplace",
    features: [
      "Class & appointment scheduling",
      "Staff management & payroll",
      "Branded mobile app",
      "Consumer marketplace (clients discover your studio)",
      "POS & retail",
      "Robust reporting & analytics",
      "Multi-location management",
      "AI-powered client insights",
      "Integrations ecosystem",
    ],
    pros: [
      "Largest consumer marketplace \u2014 clients find you through the Mindbody app",
      "Most comprehensive feature set in the industry",
      "Enterprise-grade multi-location support",
      "Extensive third-party integration ecosystem",
    ],
    cons: [
      "Most expensive option \u2014 high monthly fees + per-transaction charges",
      "Complex interface with steep learning curve",
      "Limited customization / branding control on lower tiers",
      "Overkill for solo instructors or small studios",
    ],
  },
  {
    name: "WellnessLiving",
    website: "https://www.wellnessliving.com",
    tagline: "All-in-one platform with AI assistant and branded app",
    pricing: "From ~$39/mo (Starter). Business ~$105/mo. BusinessPro ~$189/mo. BusinessMax ~$285/mo",
    focus: "Full-featured Mindbody alternative",
    features: [
      "Online booking, payments & class scheduling",
      "Automated email & text reminders",
      "Branded mobile app included (no extra charge)",
      "Client management & CRM",
      "Automated marketing campaigns",
      "Multi-location management",
      "Isaac AI assistant (predicts client churn risk)",
      "Reporting & analytics",
    ],
    pros: [
      "Branded app included at no extra charge",
      "AI assistant for client retention prediction",
      "More affordable than Mindbody for similar features",
      "Good for small-to-medium studios seeking full-featured platform",
    ],
    cons: [
      "Business plan doubles in price after 3 months ($105 \u2192 $210/mo)",
      "Interface can feel overwhelming",
      "Some features require higher tiers",
    ],
  },
  {
    name: "Glofox (ABC Glofox)",
    website: "https://www.glofox.com",
    tagline: "Custom branded apps with multi-location architecture",
    pricing: "Entry ~$80/mo, mid ~$95/mo, premium ~$170/mo. Can exceed $600/mo with add-ons",
    focus: "Branded mobile apps & multi-location",
    features: [
      "Custom branded mobile app (published under your studio name)",
      "Member app on iOS & Android",
      "Website booking portal",
      "Class, course & appointment scheduling",
      "Payment processing",
      "Push notifications & broadcasts",
      "Third-party integrations",
      "Multi-location architecture",
      "Business insights & reporting",
    ],
    pros: [
      "Custom branded app published on App Store / Google Play under your name",
      "Strong multi-location architecture \u2014 standout feature",
      "No hidden fees or price increases (flat monthly rate)",
    ],
    cons: [
      "Can get very expensive with add-ons ($600+/mo)",
      "Pricing requires contacting sales for custom quote",
      "Less yoga-specific \u2014 targets broader fitness market",
    ],
  },
  {
    name: "Vagaro",
    website: "https://www.vagaro.com",
    tagline: "Budget-friendly with all features at every price point",
    pricing: "From ~$30/mo for 1 staff member, +$10 per additional staff. No setup/cancellation fees",
    focus: "Value for money",
    features: [
      "Appointment booking & scheduling",
      "Membership sales & POS",
      "Email & SMS marketing",
      "Inventory management",
      "Staff scheduling, commissions & payroll",
      "Livestreaming & on-demand video hosting",
      "Client marketplace",
    ],
    pros: [
      "80% of Mindbody features at 20% of the price",
      "All features included at every price point (no tier-locked features)",
      "Simple per-staff pricing model",
      "No contracts, cancel anytime",
    ],
    cons: [
      "Dated UI design",
      "Basic marketing tools compared to competitors",
      "Branded app, advanced reporting are paid add-ons",
      "Add-on costs can approach mid-tier competitor pricing",
      "Not yoga-specific \u2014 serves salons, spas, fitness broadly",
    ],
  },
  {
    name: "Punchpass",
    website: "https://punchpass.com",
    tagline: "Simple studio management focused on passes and memberships",
    pricing: "Solo $49/mo (up to 100 bookings). Scales to $199+/mo. First 2 months half price",
    focus: "Simplicity & pass management",
    features: [
      "Online scheduling & booking",
      "Unlimited passes, memberships, gift cards, discount codes",
      "Group classes (online, in-person, hybrid)",
      "Private sessions & appointments",
      "Courses, workshops & events",
      "Zoom integration for virtual classes",
      "Customizable email automations",
      "Reporting for class trends, accounting & payroll",
      "Waitlists & late charges",
    ],
    pros: [
      "Clean, simple interface focused on what studios actually need",
      "Strong pass/membership management",
      "Good hybrid class support (in-person + virtual via Zoom)",
      "14-day free trial, no credit card required",
    ],
    cons: [
      "No mobile app for clients",
      "Pricing based on booking volume \u2014 can get expensive at scale",
      "No built-in payment processing marketplace",
    ],
  },
  {
    name: "TeamUp",
    website: "https://goteamup.com",
    tagline: "UK-based, affordable platform for small studios and group fitness",
    pricing: "Free plan up to 25 members. Paid plans scale with studio size. No contracts",
    focus: "Small studios & group fitness",
    features: [
      "Class booking & scheduling",
      "Payments & membership management",
      "Participant management",
      "Reporting & analytics",
      "Website integrations",
      "On-demand content",
    ],
    pros: [
      "Free plan for very small studios (up to 25 members)",
      "All features available at every level (scales by member count, not features)",
      "Flexible month-to-month, no long-term contracts",
      "UK-based with good European support",
    ],
    cons: [
      "Less feature-rich than larger competitors",
      "Pricing not fully transparent (depends on studio size)",
      "Smaller brand recognition",
    ],
  },
  {
    name: "bsport",
    website: "https://pro.bsport.io",
    tagline: "European studio management platform popular with yoga studios",
    pricing: "No free plan. Free trial available. Custom pricing (contact sales)",
    focus: "European market & yoga studios",
    features: [
      "Class scheduling & booking",
      "Member management",
      "Payment processing",
      "Marketing tools",
      "Multi-location support",
      "Branded mobile experience",
      "Analytics & reporting",
    ],
    pros: [
      "40% of users are yoga studios \u2014 strong yoga focus",
      "Strong presence in European market",
      "Transparent pricing appreciated by users",
    ],
    cons: [
      "No free plan",
      "High costs for add-ons reported by smaller studios",
      "Considered overpriced for small businesses by some users",
    ],
  },
  {
    name: "YOGO",
    website: "https://www.yogobooking.com",
    tagline: "Fitness administration with true white-labeling and seamless integrations",
    pricing: "No setup fees, no hidden costs. Transparent pricing (contact for quote)",
    focus: "White-labeling & integrations",
    features: [
      "Booking & member management",
      "Automatic payments (PBS, card, MobilePay, Apple Pay, Google Pay)",
      "Class scheduling, waitlists & SMS notifications",
      "Built-in livestreaming for online classes",
      "KISI integration (automated door opening)",
      "Real-time booking, occupancy & payment insights",
      "Urban Sports Club & ClassPass integrations",
      "Stripe integration",
      "True white-labeling",
    ],
    pros: [
      "True white-labeling \u2014 the platform looks like your brand",
      "Seamless integrations (ClassPass, Urban Sports Club, KISI, Stripe)",
      "Built-in livestreaming",
      "No setup fees or hidden costs",
    ],
    cons: [
      "Pricing not publicly listed",
      "Smaller market presence outside Northern Europe",
    ],
  },
  {
    name: "Vibefam",
    website: "https://vibefam.com",
    tagline: "Built for boutique fitness brands in APAC region",
    pricing: "From SGD $89/mo (~$65 USD). More affordable than most Western competitors",
    focus: "APAC region & boutique fitness",
    features: [
      "Class scheduling & booking",
      "Flexible pricing models (class packs, memberships, drop-ins)",
      "Secure checkout (credit cards, Apple Pay, Google Pay, local methods)",
      "Real-time analytics (bookings, attendance, revenue, member trends)",
      "Trial promotions & revenue tracking dashboard",
      "Community building tools",
    ],
    pros: [
      "Only platform with local APAC payment integrations",
      "Customer support in local time zones",
      "More affordable than Western competitors ($300+ USD/mo)",
      "Built specifically for boutique fitness brands",
    ],
    cons: [
      "Primarily focused on APAC market",
      "Smaller feature set than enterprise competitors",
      "Less suitable for European/North American studios",
    ],
  },
  {
    name: "Fitune",
    website: "https://fitune.com",
    tagline: "Affordable booking and class management for independent instructors",
    pricing: "3 tiers from $19.95/mo to $89.95/mo. Free trial available",
    focus: "Independent instructors & affordability",
    features: [
      "Booking system (in-person & online classes)",
      "Events, courses & 1-on-1 sessions",
      "Video library for on-demand content",
      "Automated payments & subscriptions",
      "Client & business management",
    ],
    pros: [
      "Very affordable starting price ($19.95/mo)",
      "Good for independent instructors and small operations",
      "Free trial available",
    ],
    cons: [
      "Smaller platform with less market presence",
      "Fewer integrations than established competitors",
    ],
  },
  {
    name: "StudioBookings",
    website: "https://www.studiobookings.com",
    tagline: "Budget-friendly studio management with no per-booking fees",
    pricing: "From $25/mo (rising to ~$45/mo). No per-booking fees",
    focus: "Budget studios & no per-booking fees",
    features: [
      "Scheduling & booking management",
      "Automated payments & memberships",
      "Free mobile app for members",
      "Multi-language support (40+ countries)",
      "Reporting & analytics",
    ],
    pros: [
      "No per-booking fees \u2014 significant savings for high-volume studios",
      "Clean, intuitive interface with minimal learning curve",
      "Available in 40+ countries and languages",
      "Flexible month-to-month pricing",
    ],
    cons: [
      "Less feature-rich than larger competitors",
      "Smaller brand recognition",
      "Limited marketing automation tools",
    ],
  },
  {
    name: "Arbox",
    website: "https://www.arboxapp.com",
    tagline: "Cloud-based studio management with integrated SaaS solutions",
    pricing: "Basic plan from ~$39/mo (annual billing)",
    focus: "Growing studios & administration",
    features: [
      "Yoga class scheduling",
      "In-depth business administration",
      "Cloud-based management",
      "Integrated SaaS solutions",
      "Payment processing",
      "Member management",
    ],
    pros: [
      "Affordable entry point",
      "Comprehensive administration modules",
      "Cloud-based \u2014 accessible from anywhere",
    ],
    cons: [
      "Less yoga-specific than dedicated platforms",
      "Smaller ecosystem",
    ],
  },
];

export default function ResearchPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <Link href="/" className="text-sm text-accent-fg hover:underline">
        &larr; Home
      </Link>

      <h1 className="mt-6 text-3xl font-bold">Yoga Studio Software Research</h1>
      <p className="mt-2 text-foreground-secondary">
        Comparison of {software.length} yoga &amp; fitness studio management platforms.
        Last updated: April 2026.
      </p>

      {/* Quick comparison table */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Quick Comparison</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-border-strong">
                <th className="py-2 pr-4 font-semibold">Platform</th>
                <th className="py-2 pr-4 font-semibold">Starting Price</th>
                <th className="py-2 pr-4 font-semibold">Focus</th>
                <th className="py-2 pr-4 font-semibold">Free Plan</th>
              </tr>
            </thead>
            <tbody>
              {software.map((s) => (
                <tr key={s.name} className="border-b border-border-default">
                  <td className="py-2 pr-4 font-medium">
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-fg hover:underline"
                    >
                      {s.name}
                    </a>
                    {s.badge && (
                      <span className="ml-2 rounded bg-warning-subtle px-1.5 py-0.5 text-xs font-medium text-warning">
                        {s.badge}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-foreground-secondary">{s.pricing.split(".")[0]}</td>
                  <td className="py-2 pr-4 text-foreground-secondary">{s.focus}</td>
                  <td className="py-2 pr-4">
                    {s.pricing.toLowerCase().includes("free plan") ||
                    s.pricing.toLowerCase().includes("free plan")
                      ? "Yes"
                      : s.pricing.toLowerCase().includes("free trial")
                        ? "Trial"
                        : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed cards */}
      <section className="mt-12 space-y-10">
        <h2 className="text-xl font-semibold">Detailed Breakdown</h2>

        {software.map((s) => (
          <article
            key={s.name}
            className="rounded-lg border border-border-default bg-surface p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">
                  <a
                    href={s.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-fg hover:underline"
                  >
                    {s.name}
                  </a>
                  {s.badge && (
                    <span className="ml-2 rounded bg-warning-subtle px-2 py-0.5 text-sm font-medium text-warning">
                      {s.badge}
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-foreground-secondary">{s.tagline}</p>
              </div>
            </div>

            <p className="mt-3 text-sm">
              <span className="font-semibold">Pricing:</span> {s.pricing}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide">
                  Features
                </h4>
                <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                  {s.features.map((f) => (
                    <li key={f}>- {f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-success uppercase tracking-wide">
                  Pros
                </h4>
                <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                  {s.pros.map((p) => (
                    <li key={p} className="text-success">
                      + {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-error uppercase tracking-wide">
                  Cons
                </h4>
                <ul className="mt-1 space-y-1 text-sm text-foreground-secondary">
                  {s.cons.map((c) => (
                    <li key={c} className="text-error">
                      - {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Sources */}
      <section className="mt-12 border-t border-border-default pt-6">
        <h2 className="text-lg font-semibold">Sources</h2>
        <ul className="mt-2 space-y-1 text-sm text-foreground-secondary">
          <li>
            <a href="https://www.capterra.com/yoga-studio-software/" target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">
              Capterra \u2014 Best Yoga Studio Software 2026
            </a>
          </li>
          <li>
            <a href="https://www.getapp.com/recreation-wellness-software/yoga-studio/" target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">
              GetApp \u2014 Yoga Studio Software Reviews & Pricing
            </a>
          </li>
          <li>
            <a href="https://www.softwareadvice.com/yoga-studio/" target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">
              Software Advice \u2014 Yoga Studio Software Reviews & Pricing
            </a>
          </li>
          <li>
            <a href="https://studiogrowth.com/best-yoga-studio-software/" target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">
              StudioGrowth \u2014 10 Yoga Studio Software For 2026
            </a>
          </li>
          <li>Individual vendor websites (visited April 2026)</li>
        </ul>
      </section>
    </main>
  );
}
