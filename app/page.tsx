import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/app/_components/MarketingChrome";
import {
  CountUp,
  Magnetic,
  PrintedInvoice,
  Reveal,
  TickerTape,
} from "@/app/_components/MintMotion";
import { ArrowRight } from "lucide-react";

/* ── PAYVIO · THE MINT ──
   An invoice is money in written form. This page is the press room:
   engraved banknote-green ink on cream paper stock, serif headlines,
   tabular numerals, and documents that print themselves. */

const tickerItems = [
  "moodbod",
  "link",
  "wandr",
  "cadance",
  "asmby",
  "procrasti",
  "presence",
];

type PressFeature = {
  id: string;
  plate: string; // engraved plate number
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
  figure: { label: string; value: number; prefix: string; note: string };
};

const pressFeatures: PressFeature[] = [
  {
    id: "invoices",
    plate: "PLATE I",
    kicker: "Invoices",
    title: "Draft it. Send the link. Watch it come back paid.",
    body: "Line items, client link, payment status — the whole life of an invoice on one sheet, from first draft to the stamp.",
    bullets: ["Line items", "Secure client link", "Payment status"],
    figure: {
      label: "Invoice total",
      value: 4850,
      prefix: "N$",
      note: "draft → sent → approved → paid",
    },
  },
  {
    id: "scan",
    plate: "PLATE II",
    kicker: "Scan paper invoices",
    title: "Paper goes in. A purchase record comes out.",
    body: "Point the camera at any supplier invoice. Payvio engraves the details — supplier, amounts, line items, VAT — straight into your purchase ledger.",
    bullets: ["OCR extraction", "Auto line items", "VAT detection"],
    figure: {
      label: "Extracted total",
      value: 2300,
      prefix: "N$",
      note: "photographed → extracted → filed",
    },
  },
  {
    id: "receipts",
    plate: "PLATE III",
    kicker: "Receipt tracker",
    title: "Every till slip becomes claimable VAT input.",
    body: "Fuel, stationery, meals, equipment — photograph the receipt and the merchant, amount, date, and VAT land in your expense record automatically.",
    bullets: ["Photo capture", "VAT input tracking", "Expense categories"],
    figure: {
      label: "VAT input claimed",
      value: 345,
      prefix: "N$",
      note: "receipt → record → VAT return",
    },
  },
  {
    id: "clients",
    plate: "PLATE IV",
    kicker: "Clients",
    title: "Clients approve from one private link. No accounts.",
    body: "Save the client once, reuse them on every invoice, and keep reminders attached to the same record. Follow-up stops being archaeology.",
    bullets: ["Client records", "Approval status", "Reminder drafts"],
    figure: {
      label: "Awaiting approval",
      value: 3,
      prefix: "",
      note: "invoices in the approval queue",
    },
  },
  {
    id: "ledger",
    plate: "PLATE V",
    kicker: "Ledger",
    title: "Month end stops being a rebuild.",
    body: "Sales, supplier purchases, and VAT-ready totals stay side by side all month — so reporting is a glance, not a forensic exercise.",
    bullets: ["Issued invoices", "Supplier records", "VAT summary"],
    figure: {
      label: "This month",
      value: 38420,
      prefix: "N$",
      note: "sales recorded and reconciled",
    },
  },
];

const faqs: [string, string][] = [
  [
    "What is Payvio?",
    "A simple invoice and ledger workspace for Namibian businesses — invoices, client approvals, scanned supplier records, receipts, and VAT-ready totals in one place.",
  ],
  [
    "Who is it for?",
    "Freelancers, SMEs, and finance teams that need clean invoices, client records, and VAT-ready totals without spreadsheet rituals.",
  ],
  [
    "Does Payvio submit to NamRA/ITAS?",
    "Not in this version. Payvio keeps VAT-ready records first and can add direct submission once official specifications are available.",
  ],
];

function LeadForm({ source, tone }: { source: string; tone: "ink" | "paper" }) {
  return (
    <form action="/signup" className={`pv-lead pv-lead-${tone}`}>
      <input name="source" type="hidden" value={source} />
      <input
        aria-label="Business email"
        className="pv-lead-input"
        name="email"
        placeholder="Business email"
        type="email"
      />
      <Magnetic>
        <button className="pv-lead-btn" type="submit">
          Start free
          <ArrowRight aria-hidden="true" className="size-4" />
        </button>
      </Magnetic>
    </form>
  );
}

/** Layered engraved guilloché curves, drifting slowly. */
function Guilloche() {
  const curves = [
    "M0,160 C240,60 480,260 720,160 C960,60 1200,260 1440,160",
    "M0,180 C240,80 480,280 720,180 C960,80 1200,280 1440,180",
    "M0,200 C240,100 480,300 720,200 C960,100 1200,300 1440,200",
    "M0,140 C240,240 480,40 720,140 C960,240 1200,40 1440,140",
    "M0,120 C240,220 480,20 720,120 C960,220 1200,20 1440,120",
    "M0,220 C240,120 480,320 720,220 C960,120 1200,320 1440,220",
  ];
  return (
    <div aria-hidden="true" className="pv-guilloche">
      {[0, 1].map((layer) => (
        <svg
          className={`pv-guilloche-layer pv-guilloche-${layer}`}
          fill="none"
          key={layer}
          preserveAspectRatio="none"
          viewBox="0 0 1440 340"
        >
          {curves.map((d, i) => (
            <path d={d} key={i} transform={`translate(0 ${i * 18 - 40})`} />
          ))}
          {curves.map((d, i) => (
            <path d={d} key={`b-${i}`} transform={`translate(0 ${i * 18 + 120})`} />
          ))}
        </svg>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="pv-page">
      <MarketingHeader />

      <main>
        {/* ── THE PRESS — hero ── */}
        <section className="pv-hero">
          <Guilloche />
          <div className="pv-hero-grain" aria-hidden="true" />
          <div className="pv-hero-shell">
            <div className="pv-hero-copy">
              <p className="pv-eyebrow">
                <span className="pv-eyebrow-rule" aria-hidden="true" />
                EST. WINDHOEK · INVOICES, CLIENTS, VAT &amp; LEDGERS
              </p>
              <h1 className="pv-hero-title">
                Your invoices,
                <br />
                <em>minted</em> properly.
              </h1>
              <p className="pv-hero-sub">
                Payvio is the press room for your business&apos;s money — draft
                invoices, send secure client links, scan supplier paper, and
                keep VAT-ready records that survive month end.
              </p>
              <LeadForm source="Homepage hero" tone="ink" />
              <p className="pv-hero-note">
                Payvio keeps the record. Payments stay with your bank — exactly
                where they should be.
              </p>
              <div className="pv-hero-figures">
                <div>
                  <span className="pv-figure-label">Issued this month</span>
                  <span className="pv-figure-value">
                    <CountUp decimals={2} prefix="N$" value={38420} />
                  </span>
                </div>
                <div>
                  <span className="pv-figure-label">VAT position</span>
                  <span className="pv-figure-value">
                    <CountUp decimals={2} prefix="N$" value={3780} />
                  </span>
                </div>
                <div>
                  <span className="pv-figure-label">Awaiting approval</span>
                  <span className="pv-figure-value">
                    <CountUp decimals={0} value={3} />
                  </span>
                </div>
              </div>
            </div>
            <div className="pv-hero-doc">
              <PrintedInvoice />
            </div>
          </div>
          <div className="pv-hero-foot" aria-hidden="true">
            <span className="pv-microtext">
              PAYVIO·WINDHOEK·NAD·VAT·READY·PAYVIO·WINDHOEK·NAD·VAT·READY·PAYVIO·WINDHOEK·NAD·VAT·READY·PAYVIO·WINDHOEK·NAD·VAT·READY·PAYVIO·WINDHOEK·NAD·VAT·READY
            </span>
          </div>
        </section>

        {/* ── ticker tape ── */}
        <section className="pv-tape-section">
          <p className="pv-tape-label">IN CIRCULATION AT</p>
          <TickerTape items={tickerItems} />
        </section>

        {/* ── the five plates ── */}
        <section className="pv-press" id="platform">
          <div className="pv-press-shell">
            <Reveal>
              <p className="pv-kicker">THE PRESS</p>
              <h2 className="pv-h2">
                Five plates. One clean record
                <br />
                of <em>every dollar</em> you&apos;re owed.
              </h2>
            </Reveal>

            <div className="pv-plates">
              {pressFeatures.map((f, i) => (
                <Reveal
                  as="article"
                  className={`pv-plate ${i % 2 ? "pv-plate-flip" : ""}`}
                  key={f.id}
                >
                  <div className="pv-plate-copy" id={f.id}>
                    <span className="pv-plate-no">{f.plate}</span>
                    <p className="pv-kicker">{f.kicker.toUpperCase()}</p>
                    <h3 className="pv-h3">{f.title}</h3>
                    <p className="pv-body">{f.body}</p>
                    <div className="pv-bullets">
                      {f.bullets.map((b) => (
                        <span className="pv-bullet" key={b}>
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="pv-plate-figure">
                    <div className="pv-figure-card">
                      <span className="pv-figure-card-label">{f.figure.label}</span>
                      <span className="pv-figure-card-value">
                        <CountUp
                          decimals={f.figure.prefix ? 2 : 0}
                          prefix={f.figure.prefix}
                          value={f.figure.value}
                        />
                      </span>
                      <span className="pv-figure-card-note">{f.figure.note}</span>
                      <span className="pv-figure-card-corner" aria-hidden="true" />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── VAT — the balance ── */}
        <section className="pv-vat" id="vat">
          <div className="pv-vat-shell">
            <Reveal>
              <p className="pv-kicker pv-kicker-light">VAT-READY RECORDS</p>
              <h2 className="pv-h2 pv-h2-light">
                Month end, <em>already done.</em>
              </h2>
              <p className="pv-body pv-body-light">
                Payvio keeps subtotal, VAT, and total as separate engravings on
                every record — so when reporting time arrives, the numbers are
                simply <strong>there</strong>.
              </p>
              <div className="pv-vat-ctas">
                <Magnetic>
                  <Link className="pv-btn-paper" href="/signup">
                    Start workspace
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Magnetic>
                <Link className="pv-btn-ghost" href="/contact">
                  Contact us
                </Link>
              </div>
            </Reveal>
            <Reveal className="pv-vat-card" delay={150}>
              <div className="pv-vat-row">
                <span>VAT collected</span>
                <strong>
                  <CountUp decimals={2} prefix="N$" value={4920} />
                </strong>
              </div>
              <div className="pv-vat-row">
                <span>Supplier VAT input</span>
                <strong>
                  <CountUp decimals={2} prefix="N$" value={1140} />
                </strong>
              </div>
              <div className="pv-vat-row pv-vat-position">
                <span>VAT position</span>
                <strong>
                  <CountUp decimals={2} prefix="N$" value={3780} />
                </strong>
              </div>
              <p className="pv-vat-note">Sample values for the marketing preview.</p>
            </Reveal>
          </div>
        </section>

        {/* ── pricing teaser ── */}
        <section className="pv-pricing" id="pricing">
          <div className="pv-pricing-shell">
            <Reveal className="pv-price-card pv-price-ink">
              <p className="pv-kicker pv-kicker-light">UP AND RUNNING FAST</p>
              <h2 className="pv-h3 pv-h3-light">Start with the first invoice.</h2>
              <p className="pv-body pv-body-light">
                Create the workspace, add a client, and send a secure invoice
                link — without changing how you get paid.
              </p>
            </Reveal>
            <Reveal className="pv-price-card pv-price-paper" delay={120}>
              <p className="pv-kicker">CLEAR PLANS</p>
              <h2 className="pv-h3">Simple pricing for growing teams.</h2>
              <p className="pv-body">
                Pick the plan that fits your invoice volume, client list, and
                reporting needs.
              </p>
              <Link className="pv-link-rule" href="/pricing">
                See pricing <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ── security strip ── */}
        <section className="pv-security">
          <div className="pv-security-shell">
            <Reveal>
              <p className="pv-kicker">SAFETY AND CLARITY</p>
              <h2 className="pv-h2">
                Built like a vault,
                <br />
                <em>readable</em> like a ledger.
              </h2>
            </Reveal>
            <div className="pv-security-grid">
              {[
                ["Secure links", "Clients review invoices from one private link — no client accounts, no attachments lost to inboxes."],
                ["Role aware", "Team access stays inside the workspace, scoped to what each person actually does."],
                ["Clear records", "Events, totals, and status changes stay visible. The history is the audit trail."],
                ["Local focus", "Built around NAD, VAT-ready records, and the way Namibian SMEs actually invoice."],
              ].map(([title, body], i) => (
                <Reveal className="pv-security-card" delay={i * 90} key={title}>
                  <span className="pv-security-index">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="pv-faq" id="contact">
          <div className="pv-faq-shell">
            <Reveal>
              <p className="pv-kicker">QUESTIONS</p>
              <h2 className="pv-h2">
                Simple answers.
                <br />
                <em>Clear</em> next steps.
              </h2>
              <Magnetic>
                <Link className="pv-btn-ink" href="/contact">
                  Talk to Payvio
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Magnetic>
            </Reveal>
            <div className="pv-faq-list">
              {faqs.map(([q, a], i) => (
                <Reveal className="pv-faq-item" delay={i * 80} key={q}>
                  <h3>{q}</h3>
                  <p>{a}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── final plate ── */}
        <section className="pv-final">
          <Guilloche />
          <div className="pv-final-shell">
            <Reveal>
              <p className="pv-kicker pv-kicker-mint">READY WHEN YOU ARE</p>
              <h2 className="pv-final-title">
                Put your money
                <br />
                on <em>paper.</em>
              </h2>
            </Reveal>
            <Reveal className="pv-final-form" delay={150}>
              <LeadForm source="Homepage final CTA" tone="paper" />
              <Link className="pv-final-login" href="/login">
                or log in to your workspace →
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
