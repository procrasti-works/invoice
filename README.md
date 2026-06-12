# Payvio

**The press room for your business's money.** Payvio is an invoice, client,
ledger, receipt-scanning and VAT-ready record workspace built for Namibian
SMEs — live at **[payvio.site](https://payvio.site)**.

---

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind v4**
- **Convex** — database, auth (email + Google), file storage
- **Design:** "THE MINT" — engraved-banknote aesthetic (see below)
- Hosting: **Vercel** (frontend) + **Convex production** (backend)

## Local development

```bash
bun install
npm run dev            # http://localhost:3000
npx convex dev         # backend (dev deployment)
```

## Deploy

The production flow is **git push → Vercel**, with the Convex backend deployed
separately:

```bash
git push procrasti HEAD:main      # → triggers the payvio.site Vercel build
npx convex deploy -y              # → deploys backend to prod (wandering-cormorant-766)
```

> Frontend-only changes (CSS, pages) need only the push. Anything under
> `convex/` (schema, functions) also needs `npx convex deploy`.

## Repo governance

`.github/CODEOWNERS` gates every UI path (`app/`, `components/`, CSS) to the
owner. **This only enforces once branch protection is enabled** on `main`
(Settings → Branches → require a PR + "Require review from Code Owners").

---

## THE MINT — brand kit

The single source of truth for every surface **and every ad**. Light theme only.

| Token | Hex | Use |
|---|---|---|
| Ink (deep green) | `#0B3B2E` | dark CTA bands, sidebar, primary buttons, headlines on cream |
| Ink deep | `#072A21` | hover, gradient floor |
| Green | `#0C7A55` | kickers, links, accents |
| Mint | `#2FD08C` | the "highlighter" — one bright accent, key numbers, primary CTAs on dark |
| Gold | `#C9A227` | plate numerals, small archival marks |
| Stamp red | `#C03B2D` | the PAID stamp, the invoice margin line |
| Paper | `#F6F3EA` | the cream canvas |
| Paper bright | `#FFFDF6` | cards, the printed-invoice sheet |

- **Display serif:** Fraunces (italic cut for the emphasis word — "*minted*").
- **UI / body:** Geist. **Numbers:** Geist Mono, tabular.
- **Textures:** faint paper grain on light surfaces; whisper notepad ruled
  lines on the printed-invoice + cards; the hero invoice has a red left margin.
- **Voice:** plain, confident, a little editorial. "The press room for your
  business's money." "Your invoices, *minted* properly." "Month end, already done."
- **Motifs:** the self-printing invoice with a red **PAID** stamp; guilloché
  (banknote line-work); engraved "plates"; tabular money figures (N$).

---

## ADS PLAYBOOK

How we produce Payvio ads with the connected MCP tools. **No Remotion** — video
is done with the Higgsfield Marketing Studio MCP. Two audiences, always.

### Tools

| Need | Tool | Notes |
|---|---|---|
| Static ads (IG/FB post, story, poster, flyer, email banner) | **Canva MCP** | `generate-design` → review candidates → `create-design-from-candidate` → `export-design` (PNG/JPG/MP4) |
| Short ad video (Apple-style product spot) | **Higgsfield MCP** | `generate_video` with `model: marketing_studio_video`; **preflight credits with `get_cost: true` before generating** |
| Hero/product stills for the ads | **Higgsfield MCP** | `generate_image`, `model: marketing_studio_image` |

### The two audiences (every concept ships in both voices)

**A — Small business / freelancer** (the core market)
- Pain: chasing payments, month-end scramble, losing receipts, looking unprofessional.
- Tone: warm, direct, "you". "Get paid without the chase." "One link. Client approves. Done."
- Surfaces: Instagram post (1080×1350), Story (1080×1920), Facebook post.

**B — Large company / finance team** (up-market)
- Pain: VAT-ready records, audit trail, team roles, reconciliation across the org.
- Tone: precise, institutional, "your team". "VAT-ready records, before month end." "An audit trail that reads itself."
- Surfaces: LinkedIn-style post, poster, email banner.

### Canva generation prompt recipe

Always feed the brand kit into the `query`. Template:

> Create a [format] ad for **Payvio**, an invoice & VAT-records app for
> [Namibian SMEs / finance teams]. Style: "engraved private bank" — **cream
> paper `#F6F3EA`** background with faint paper grain, **deep banknote-green
> `#0B3B2E`** headline in an elegant **serif (Fraunces)** with one **italic**
> emphasis word, a **mint `#2FD08C`** pill CTA, tabular **N$** figures in mono,
> and a small **PAID** stamp motif in **stamp-red `#C03B2D`**. Headline: "[copy]".
> Subhead: "[copy]". CTA: "Start free". Clean, lots of cream space, no stock-photo clutter.

### Headline bank

*SMB:* "Get paid without the chase." · "Your invoices, minted properly." ·
"One link. Client approves. Paid." · "Receipts in. VAT sorted."
*Enterprise:* "Month end, already done." · "VAT-ready records, before the deadline." ·
"An audit trail that reads itself." · "Every dollar your team is owed, on one ledger."

### Workflow

1. `generate-design` (format + brand-kit query) → get candidates.
2. Pick the best → `create-design-from-candidate` (saves to the Canva account).
3. `export-design` → PNG/JPG download URL to share/post.
4. For video: `generate_video` (preflight `get_cost`) → optional `upscale_video`.
5. Stage social posts through the HubSpot/Canva flow or hand the exports to the owner.
