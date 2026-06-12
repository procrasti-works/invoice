import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/app/_components/MarketingChrome";
import {
  ArrowRight,
  Building2,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About | Payvio",
  description:
    "Payvio is a Namibia-built invoice and ledger workspace for local SMEs.",
};

const stats = [
  ["40,000+", "Active SMEs in Namibia"],
  ["90%", "SME failure risk tied to weak financial management"],
  ["15%", "VAT-ready records for registered businesses"],
  ["NAD", "Local currency from day one"],
];

const values = [
  {
    icon: Landmark,
    title: "Local first",
    body: "Built around Namibian business realities, local currency, and SME workflows.",
  },
  {
    icon: ReceiptText,
    title: "VAT-ready",
    body: "Invoices can separate VAT clearly when your business is VAT registered.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Financial records should stay controlled, organized, and easy to review.",
  },
  {
    icon: FileText,
    title: "Simple by choice",
    body: "Powerful enough for growth, simple enough for first-time business owners.",
  },
];

const founders = [
  {
    initials: "NH",
    name: "Nazeem Harris",
    role: "Co-Founder and CTO",
    body: "Leads product, frontend direction, and the Payvio experience for Namibian SMEs.",
  },
  {
    initials: "AM",
    name: "Andreas Mukombabi",
    role: "Co-Founder and CTO",
    body: "Leads backend architecture, product infrastructure, and the technical foundation.",
  },
];

export default function AboutPage() {
  return (
    <div className="il-page min-h-screen bg-white text-[var(--pv-ink)]">
      <MarketingHeader />
      <main>
        <section className="bg-white px-5 py-20 text-center sm:px-8 sm:py-28">
          <p className="mx-auto inline-flex rounded-full bg-[var(--pv-mint-soft)] px-5 py-2 text-sm font-black text-[var(--pv-ink)]">
            Built in Namibia
          </p>
          <h1 className="mx-auto mt-8 max-w-5xl text-5xl font-black leading-[1.02] sm:text-7xl">
            Invoice software built for local businesses.
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-[var(--ink-soft)]">
            Payvio exists because too many businesses still manage invoices through
            paper, spreadsheets, and message threads. We are building a cleaner way
            to send invoices, track clients, and keep records ready.
          </p>
        </section>

        <section className="border-y border-[var(--pv-line)] bg-[var(--pv-paper-bright)] px-5 py-10 sm:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-4">
            {stats.map(([value, label]) => (
              <div className="rounded-[8px] border border-[var(--pv-line)] bg-white p-5 text-center" key={label}>
                <strong className="block text-3xl font-black text-[var(--pv-ink)]">{value}</strong>
                <span className="mt-2 block text-sm font-bold text-[var(--ink-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase text-[var(--pv-green)]">Mission</p>
              <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
                Make invoice operations simple enough for every SME.
              </h2>
            </div>
            <div className="rounded-[8px] bg-[var(--pv-paper-warm)] p-8 sm:p-10">
              <Building2 aria-hidden="true" className="size-7 text-[var(--pv-green)]" />
              <p className="mt-6 text-lg font-medium leading-8 text-[var(--ink-soft)]">
                Payvio gives local businesses a focused workspace for invoices,
                clients, reminders, purchase records, reports, and VAT-ready totals.
                The goal is not more software complexity. The goal is better records
                and faster follow-up.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[var(--pv-paper-warm)] px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase text-[var(--pv-green)]">Values</p>
              <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
                The product should feel practical, local, and clear.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {values.map((item) => {
                const Icon = item.icon;
                return (
                  <article className="rounded-[8px] border border-[var(--pv-line)] bg-white p-5" key={item.title}>
                    <Icon aria-hidden="true" className="size-6 text-[var(--pv-green)]" strokeWidth={1.8} />
                    <h3 className="mt-4 text-xl font-black">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-7 lg:grid-cols-[0.78fr_1fr] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase text-[var(--pv-green)]">Team</p>
                <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
                  The people building Payvio.
                </h2>
              </div>
              <p className="max-w-xl text-lg leading-8 text-[var(--ink-soft)] lg:justify-self-end">
                A small product team focused on making invoice work easier for
                Namibian business owners.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {founders.map((founder) => (
                <article className="rounded-[8px] border border-[var(--pv-line)] bg-white p-6" key={founder.name}>
                  <div className="flex items-start gap-4">
                    <span className="grid size-14 shrink-0 place-items-center rounded-[8px] bg-[var(--pv-ink)] text-lg font-black text-white">
                      {founder.initials}
                    </span>
                    <div>
                      <h3 className="text-2xl font-black">{founder.name}</h3>
                      <p className="mt-1 text-sm font-black text-[var(--pv-green)]">{founder.role}</p>
                      <p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">{founder.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[var(--pv-ink)] px-5 py-20 text-white sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1fr_0.65fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase text-white/80">Next step</p>
              <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] sm:text-7xl">
                Start with one clean invoice.
              </h2>
            </div>
            <div className="grid gap-3 rounded-[8px] bg-white p-5">
              <Link className="il-dark-button" href="/signup">
                Open workspace
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link className="il-light-button" href="/pricing">
                View pricing
              </Link>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </div>
  );
}
