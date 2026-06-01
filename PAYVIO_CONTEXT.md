# PAYVIO — PROJECT CONTEXT

## Stack
- Next.js 16.2.6 · React 19 · Convex backend · Tailwind v4 · TypeScript · Bun
- Deployed: **payvio.site** via Vercel
- Repo: **procrasti-works/invoice** — always push to `procrasti` remote

## Push command (always use this)
```bash
git push procrasti main
```

## Founders
- **Nazeem Harris** — Co-Founder & CTO · inthelooppodastnazeem@gmail.com · instagram.com/nazeem_harris/
- **Andreas Mukombabi** — Co-Founder & CTO · info.procrasti@gmail.com · instagram.com/dot.a9/
- Location: Windhoek, Namibia

---

## App Structure
```
app/
  page.tsx              # Landing page (full marketing site)
  about/page.tsx        # About page
  blog/page.tsx         # Blog (3 full articles)
  contact/page.tsx      # Contact + FAQ
  (auth)/               # Login & signup pages
  dashboard/
    page.tsx            # Invoices (main dashboard)
    clients/page.tsx    # Clients page
    reminders/page.tsx  # Reminders page
    reports/page.tsx    # Reports & Analytics
    ledger/page.tsx     # Invoice Ledger + 5yr archive
    vat/page.tsx        # VAT & NamRA compliance
    scan/page.tsx       # Scan Paper Invoices (OCR)
    settings/           # Workspace settings
    _components/
      DashboardShell.tsx  # Sidebar + topbar layout
      DashboardPage.tsx   # Invoices page content
lib/
  plan.tsx              # Plan gating context
```

---

## Design System
- **Sidebar**: white/light, Brex-inspired, `db-*` CSS classes
- **Active nav**: light blue bg `#eff6ff` + left border `#1a6fc4`
- **All dashboard pages** use `db-page`, `db-page-header`, `db-stat-card`, `db-card`, `db-table`, `db-tabs`
- **Landing page** uses `lp-*` CSS classes
- **Auth pages** use `new-auth-*` CSS classes
- **Info pages** (About/Blog/Contact) use `info-*` CSS classes

---

## Plan Gating System (`lib/plan.tsx`)

### Access Codes
| Code | Plan |
|---|---|
| `PAYVIO-ADMIN-2026` | Admin (full access) |
| `ENT-2026` | Enterprise |
| `PRO-2026` | Professional |
| `BIZ-2026` | Business |
| `START-2026` | Starter |
| No code | 14-day free trial |

### Feature Access by Plan
| Feature | Trial | Starter | Business | Pro | Enterprise | Admin |
|---|---|---|---|---|---|---|
| Invoices/Clients/Reminders/Settings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reports & Analytics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoice Ledger | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scan Paper Invoice | ✅ (50 max) | ❌ | ✅ | ✅ | ✅ | ✅ |
| VAT & NamRA | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

- Trial = 14 days, Starter features, 50 scan limit tracked in localStorage
- Locked features show lock icon in sidebar + upgrade page when clicked

### Pricing (NAD)
- Starter: N$150/mo
- Business: N$350/mo
- Professional: N$750/mo
- Enterprise: N$2,000/mo

---

## Scan Paper Invoice Feature
- Frontend: `app/dashboard/scan/page.tsx`
- Backend: `convex/purchaseScanExtraction.ts`
- Uses in-app manual review by default.
- Optional Desert handoff: set `PAYVIO_SCAN_DESERT_WEBHOOK_URL` or `DESERT_SCAN_WEBHOOK_URL`.
- Uploaded originals stay in Convex storage for the purchase record.
- Review fields: supplier, invoice number, dates, line items, subtotal, VAT, total, currency.

---

## Convex Schema (key tables)
- `organizations` — workspaces/companies
- `memberships` — org members with roles
- `clients` — per-org client records
- `invoices` — full lifecycle (draft → paid/overdue), 9 statuses
- `invoiceLineItems` — line items per invoice
- `invoiceSnapshots` — immutable snapshot when sent
- `invoiceEvents` — audit trail
- `paymentRecords` — payment tracking
- `reminders` — scheduled follow-ups

---

## Key VAT / NamRA Facts (Namibia)
- VAT rate: **15%**
- Mandatory registration threshold: N$1M/year
- Invoice retention: **5 years**
- VAT return due: **25th of following month**
- E-invoicing mandate: **2026–2029 phased rollout** (NamRA ITAS system)
- 40,000+ active SMEs · 29,000+ registered companies · 90% fail within 5 years
- No local NamRA-compliant invoicing SaaS existed before Payvio — first mover opportunity

---

## Landing Page Sections (in order)
1. Header (nav: Home/About/Blog/Contact, Login, Get In Touch)
2. Hero (email form, pill badge, brand logos)
3. Service Cards (Invoice Management, Client Approvals, Payment Tracking, Scan Paper Invoices)
4. Stats Bar (dark navy)
5. Feature Grid (10 cards with Unsplash stock images)
6. Workflow Steps (5 steps with images)
7. Testimonials (3 with dot nav + metrics strip)
8. Pricing (monthly/annual toggle, 4 NAD tiers)
9. Blog (3 cards with stock images)
10. Footer (logo, newsletter, socials, 3 link columns, copyright)

---

## What Andreas Still Needs to Build
1. Optional OCR/parser layer for scan review automation
2. NamRA ITAS direct API integration (VAT & NamRA page export button)
3. Local bank integrations — FNB, Bank Windhoek, Standard Bank (Enterprise feature)
4. Payment processing backend (Stripe/Polar already in schema)
5. Real email delivery for invoices (currently opens Gmail compose)
6. Recurring invoice scheduling backend
