# B2B Prospecting Sample Inputs

**Date:** 2026-04-13
**Status:** Approved

## Context

Existing sample inputs (yoga, coworking, saas-landing) judge **website quality**. New samples demonstrate **B2B prospecting** — scanning a local business vertical to identify gaps and generate leads for a web agency or local SaaS provider.

Persona: local web agency serving a geography. Scan businesses, score web presence for gaps, output = prioritized lead list. Worse score = better lead.

### Future vision

1. **Scan** — find businesses with gaps (now)
2. **Diagnose** — structured gap report per business
3. **Generate** — AI builds micro-SaaS to fill gap
4. **Deploy** — locally hosted, business owns data

Google Maps as future site-list source. Meta enrichable with Maps data.

## Changes

- **Add** `data/inputs/restaurants.json` — 6 sites, 5 categories
- **Add** `data/inputs/locksmiths.json` — 6 sites, 5 categories
- **Delete** `data/inputs/coworking.json`

## restaurants.json

**Display name:** `"Local restaurants — B2B prospecting"`

### Categories

1. **Home** (`wappalyzer: true`, `lighthouse: true`) — Tech stack, digital maturity, online ordering/reservation on homepage
2. **Menu** — Key signal. HTML=has tooling. PDF/image=hot lead. None=cold
3. **Ordering** — Native vs third-party vs call-to-order vs none
4. **Reservations** — Widget vs embed vs phone-only vs nothing
5. **Contact** — Address, hours, phone, map. Gap analysis

### Sites (6) — Independent London restaurants, mixed digital maturity

## locksmiths.json

**Display name:** `"Local locksmiths — B2B prospecting"`

### Categories

1. **Home** (`wappalyzer: true`, `lighthouse: true`) — Digital maturity, mobile-first, emergency number, service area
2. **Services** — Individual pages vs dump, emergency vs scheduled
3. **Pricing** — Transparency. "Call for quote" = opportunity
4. **Trust** — License, insurance, reviews, trade body. Absence = prospecting signal
5. **Contact / Emergency** — Can locked-out person get help in 30 seconds?

### Sites (6) — London locksmiths, mixed maturity

## Prompt framing

All prompts: **gap analysis** not quality judgment. Each record includes `opportunityScore` (1-10, higher = more needs help = better lead).
