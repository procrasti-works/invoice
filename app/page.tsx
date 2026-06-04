import Image from "next/image";
import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/app/_components/MarketingChrome";
import dashboardMockup from "./_assets/payvio-dashboard-mockup.png";
import {
  ArrowRight,
  BarChart3,
  FileText,
  ReceiptText,
  Users,
} from "@/app/_components/IconPack";

type PlatformFeature = {
  body: string;
  bullets: string[];
  id: string;
  image: { src: string; alt: string };
  kicker: string;
  title: string;
  visual: {
    amount: string;
    body: string;
    fromName: string;
    fromToken: string;
    label: string;
    title: string;
    toName: string;
    toToken: string;
  };
};

const platformFeatures: PlatformFeature[] = [
  {
    id: "invoices",
    kicker: "Invoices",
    title: "Create, send, and close invoices from one workspace.",
    body: "Payvio keeps the invoice flow direct: draft the invoice, send the client link, track the status, and mark payment when it lands.",
    bullets: ["Line items", "Client link", "Payment status"],
    image: {
      src: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&q=80",
      alt: "Business professional reviewing invoices on a laptop",
    },
    visual: {
      title: "Invoice sent",
      body: "Every invoice has a simple path from draft to paid.",
      label: "Invoice total",
      amount: "N$4,850.00",
      fromToken: "INV",
      fromName: "Payvio workspace",
      toToken: "Client",
      toName: "Secure approval link",
    },
  },
  {
    id: "scan",
    kicker: "Scan Paper Invoices",
    title: "Turn paper invoices into digital records instantly.",
    body: "Point your camera at any supplier invoice and Payvio extracts the details — supplier, amounts, line items, and VAT — straight into your purchase ledger.",
    bullets: ["OCR extraction", "Auto line items", "VAT detection"],
    image: {
      src: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=900&q=80",
      alt: "Scanning a paper document with a phone camera",
    },
    visual: {
      title: "Scan complete",
      body: "Paper details land directly into a draft purchase record.",
      label: "Extracted total",
      amount: "N$2,300.00",
      fromToken: "Paper",
      fromName: "Physical invoice",
      toToken: "Draft",
      toName: "Ready to review",
    },
  },
  {
    id: "receipts",
    kicker: "Receipt Tracker",
    title: "Capture every expense receipt and never lose one again.",
    body: "Photograph any receipt — fuel, stationery, meals, equipment — and Payvio extracts the amount, merchant, date, and VAT. Every receipt feeds your VAT input totals automatically.",
    bullets: ["Photo capture", "VAT input tracking", "Expense categories"],
    image: {
      src: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=900&q=80",
      alt: "Business person organising expense receipts",
    },
    visual: {
      title: "Receipt captured",
      body: "Merchant, amount, and VAT land in your expense record.",
      label: "VAT input claimed",
      amount: "N$345.00",
      fromToken: "Receipt",
      fromName: "Physical receipt",
      toToken: "VAT",
      toName: "Input VAT total",
    },
  },
  {
    id: "clients",
    kicker: "Clients",
    title: "Keep approvals and follow-up easy to manage.",
    body: "Save client details once, reuse them on every invoice, and keep reminders connected to the same record.",
    bullets: ["Client records", "Approval status", "Reminder drafts"],
    image: {
      src: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&q=80",
      alt: "Business team in a client meeting",
    },
    visual: {
      title: "Client review",
      body: "The client sees the invoice without needing an account.",
      label: "Awaiting approval",
      amount: "3 invoices",
      fromToken: "SME",
      fromName: "Your business",
      toToken: "OK",
      toName: "Client approval",
    },
  },
  {
    id: "ledger",
    kicker: "Ledger",
    title: "See sales, supplier purchases, and VAT-ready totals clearly.",
    body: "Payvio keeps the operational record tidy so reporting does not become a month-end rebuild.",
    bullets: ["Issued invoices", "Supplier records", "VAT summary"],
    image: {
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80",
      alt: "Financial analytics dashboard on a screen",
    },
    visual: {
      title: "Ledger view",
      body: "Sales and purchases stay side by side.",
      label: "This month",
      amount: "N$38,420.00",
      fromToken: "Sales",
      fromName: "Issued invoices",
      toToken: "VAT",
      toName: "VAT-ready records",
    },
  },
];

const marqueeItems = [
  "moodbod",
  "link",
  "wandr",
  "cadance",
  "asmby",
  "procrasti",
  "presence",
];

const faqs = [
  [
    "What is Payvio?",
    "A simple invoice and ledger workspace for Namibian businesses.",
  ],
  [
    "Who is it for?",
    "Freelancers, SMEs, and finance teams that need clean invoices, client records, and VAT-ready totals.",
  ],
  [
    "Can Payvio export VAT records?",
    "Yes. Payvio keeps VAT-ready records and CSV exports for review.",
  ],
];

function HeroLeadForm({ source }: { source: string }) {
  return (
    <form action="/signup" className="il-lead-form">
      <input name="source" type="hidden" value={source} />
      <input
        aria-label="Work email"
        className="il-lead-input"
        name="email"
        placeholder="Business email"
        type="email"
      />
      <button className="il-lead-button" type="submit">
        Start free
      </button>
    </form>
  );
}

function HeroPreview() {
  return (
    <div className="il-preview" aria-label="Payvio invoice workspace preview">
      <Image
        alt="Payvio invoice dashboard showing invoice metrics and a new invoice form"
        className="il-preview-image"
        placeholder="blur"
        preload
        quality={85}
        sizes="(max-width: 760px) 94vw, (max-width: 1120px) 88vw, 1120px"
        src={dashboardMockup}
      />
    </div>
  );
}

function ClientsCarousel() {
  const trackItems = [...marqueeItems, ...marqueeItems];

  return (
    <section className="il-used-by-section">
      <div className="il-used-by-shell">
        <p className="il-used-by-label">Used by</p>

        <div aria-label="Companies using Payvio" className="il-marquee il-used-by-marquee">
          <div className="il-marquee-track il-used-by-track">
            {trackItems.map((item, index) => (
              <span
                aria-hidden={index >= marqueeItems.length}
                className="il-used-by-name"
                key={`${item}-${index}`}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function OrbitScaleSection() {
  return (
    <section className="il-orbit-section" aria-labelledby="orbit-scale-title">
      <div className="il-orbit-stage">
        <div className="il-orbit-ring il-orbit-ring-outer" />
        <div className="il-orbit-ring il-orbit-ring-inner" />
        <div className="il-orbit-marker il-marker-one">
          <FileText aria-hidden="true" />
        </div>
        <div className="il-orbit-marker il-marker-two">
          <Users aria-hidden="true" />
        </div>
        <div className="il-orbit-marker il-marker-three">
          <ReceiptText aria-hidden="true" />
        </div>
        <div className="il-orbit-marker il-marker-four">
          <BarChart3 aria-hidden="true" />
        </div>
        <div className="il-orbit-copy">
          <h2 id="orbit-scale-title">Easy to start, clear enough to scale.</h2>
          <p>
            One Payvio workspace for invoices, clients, reminders, scanned
            supplier records, and VAT-ready reporting. Start simple and keep the
            record clean as the business grows.
          </p>
        </div>
      </div>
    </section>
  );
}

function PlatformFeature({ feature }: { feature: PlatformFeature }) {
  return (
    <article
      className="grid gap-8 border-t border-border py-10 lg:grid-cols-[0.72fr_1fr] lg:items-center"
      id={feature.id}
    >
      <div>
        <p className="text-xs font-semibold uppercase text-primary">
          {feature.kicker}
        </p>
        <h3 className="mt-4 max-w-2xl text-3xl font-semibold leading-[1.02] text-foreground sm:text-5xl">
          {feature.title}
        </h3>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
          {feature.body}
        </p>
      </div>
      <div className="il-platform-panel">
        <div className="il-platform-feature-img">
          <Image
            src={feature.image.src}
            alt={feature.image.alt}
            width={900}
            height={500}
            className="il-platform-img"
          />
        </div>
        <div className="il-platform-showcase-copy">
          <h4>{feature.visual.title}</h4>
          <p>{feature.visual.body}</p>
        </div>

        <div className="il-platform-flow-card">
          <p>{feature.visual.label}</p>
          <strong>{feature.visual.amount}</strong>

          <div className="il-platform-flow-box">
            <div className="il-platform-flow-row">
              <span className="il-platform-flow-token">
                {feature.visual.fromToken}
              </span>
              <span>{feature.visual.fromName}</span>
            </div>
            <span className="il-platform-flow-arrow" aria-hidden="true">
              &darr;
            </span>
            <div className="il-platform-flow-row">
              <span className="il-platform-flow-token il-platform-flow-token-soft">
                {feature.visual.toToken}
              </span>
              <span>{feature.visual.toName}</span>
            </div>
          </div>
        </div>

        <div
          className="il-platform-feature-pills"
          aria-label={`${feature.kicker} tools`}
        >
          {feature.bullets.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase text-primary">{children}</p>
  );
}

function SecuritySection() {
  const items = [
    ["Secure links", "Clients can review invoices from a private link."],
    ["Role aware", "Team access is kept inside the workspace."],
    ["Clear records", "Events, totals, and status changes stay visible."],
    ["Local focus", "Built around NAD, VAT-ready records, and Namibian SMEs."],
  ];

  return (
    <section className="bg-primary py-20 text-primary-foreground sm:py-28">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            Safety and clarity
          </p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.02] sm:text-7xl">
            Built for real invoice work.
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(([title, body]) => (
            <article className="rounded-[8px] bg-primary-foreground/10 p-5" key={title}>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/65">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="il-page min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main>
        <section className="il-hero bg-background">
        <div className="il-hero-shell mx-auto max-w-[1180px] px-5 text-center sm:px-8">
          <a
            className="il-hero-eyebrow inline-flex items-center rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-foreground"
            href="#platform"
          >
            Payvio for invoices, clients, VAT, and ledgers
          </a>
          <h1 className="il-hero-title mx-auto mt-9 max-w-6xl text-foreground">
            The invoice platform Namibia can grow with.
          </h1>
          <p className="il-hero-copy mx-auto mt-7 max-w-3xl text-foreground">
            Create invoices, send secure client links, scan supplier invoices,
            track payments, and keep VAT-ready records in one simple workspace.
          </p>
          <div className="il-hero-form mx-auto mt-9">
            <HeroLeadForm source="Homepage hero" />
          </div>
          <p className="il-hero-note mx-auto mt-7 max-w-2xl text-xs leading-5 text-muted-foreground">
            Payvio keeps invoice records organized. Payments stay with your
            bank or payment provider.
          </p>
          <div className="mt-12 w-full">
            <HeroPreview />
          </div>
        </div>
      </section>

      <ClientsCarousel />

      <OrbitScaleSection />

      <section className="bg-background py-20 sm:py-28" id="platform">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1fr] lg:items-end">
            <div>
              <SectionLabel>One workspace for invoice operations</SectionLabel>
              <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] text-foreground sm:text-7xl">
                Invoices, scans, clients, purchases, and VAT in one place.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
              The structure is simple: create the invoice, send the link, scan
              supplier files, collect proof, and keep the ledger ready for reporting.
            </p>
          </div>

          <div className="mt-10">
            {platformFeatures.map((feature) => (
              <PlatformFeature feature={feature} key={feature.id} />
            ))}
          </div>
        </div>
      </section>

      <section id="vat" className="bg-muted py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.85fr_1fr] lg:items-center">
          <div>
            <SectionLabel>VAT-ready records</SectionLabel>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.02] text-foreground sm:text-7xl">
              Keep the numbers clean before month end.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Payvio separates subtotal, VAT, and total values so the record is
              easier to review when reporting time arrives.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="il-dark-button" href="/signup">
                Start workspace
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link className="il-light-button" href="/contact">
                Contact us
              </Link>
            </div>
          </div>
          <div className="il-ledger-card">
            <div>
              <span>VAT collected</span>
              <strong>N$4,920.00</strong>
            </div>
            <div>
              <span>Supplier VAT input</span>
              <strong>N$1,140.00</strong>
            </div>
            <div>
              <span>VAT position</span>
              <strong>N$3,780.00</strong>
            </div>
            <p>Numbers shown are sample values for the marketing preview.</p>
          </div>
        </div>
      </section>

      <section className="bg-background py-20 sm:py-28" id="pricing">
        <div className="mx-auto grid max-w-[1180px] gap-4 px-5 sm:px-8 lg:grid-cols-2">
          <article className="rounded-[8px] bg-primary p-8 text-primary-foreground sm:p-10">
            <p className="text-xs font-semibold uppercase text-primary">
              Up and running fast
            </p>
            <h2 className="mt-5 text-3xl font-semibold leading-[1.02] sm:text-6xl">
              Start with the first invoice.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-primary-foreground/65">
              Create the workspace, add a client, and send a secure invoice
              link without changing how you get paid.
            </p>
          </article>
          <article className="rounded-[8px] bg-secondary p-8 text-foreground sm:p-10">
            <p className="text-xs font-semibold uppercase text-primary">
              Clear plans
            </p>
            <h2 className="mt-5 text-3xl font-semibold leading-[1.02] sm:text-6xl">
              Simple pricing for growing teams.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Pick the plan that fits your invoice volume, client list, and
              reporting needs.
            </p>
          </article>
        </div>
      </section>

      <SecuritySection />

      <section id="contact" className="bg-background py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.75fr_1fr]">
          <div>
            <SectionLabel>Contact</SectionLabel>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.02] text-foreground sm:text-6xl">
              Simple answers. Clear next steps.
            </h2>
            <div className="mt-8">
              <Link className="il-dark-button" href="/contact">
                Talk to Payvio
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
          <div className="grid gap-3">
            {faqs.map(([question, answer]) => (
              <article className="rounded-[8px] bg-muted p-6" key={question}>
                <h3 className="text-2xl font-semibold text-foreground">
                  {question}
                </h3>
                <p className="mt-4 text-lg leading-8 text-muted-foreground">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase text-primary-foreground/80">
              Ready when you are
            </p>
            <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] text-primary-foreground sm:text-7xl">
              Start your invoice workspace today.
            </h2>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-background px-6 text-base font-semibold text-foreground transition hover:bg-muted"
                href="/signup"
              >
                Open workspace
              </Link>
              <Link
                className="il-final-login inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-semibold transition hover:bg-primary/90"
                href="/login"
              >
                Login
              </Link>
            </div>
          </div>
          <div className="rounded-[8px] bg-background p-5">
            <HeroLeadForm source="Homepage final CTA" />
          </div>
        </div>
      </section>

      <MarketingFooter />
      </main>
    </div>
  );
}
