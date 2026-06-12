import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/app/_components/MarketingChrome";
import {
  ArrowRight,
  Check,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing | Payvio",
  description:
    "Simple Payvio pricing for Namibian businesses that need invoices, reminders, reports, purchases, and VAT-ready records.",
};

const plans = [
  {
    name: "Starter",
    price: "N$150",
    annual: "N$1,500/yr",
    eyebrow: "Start clean",
    audience: "Micro businesses, freelancers, sole traders",
    bestFor: "Getting professional invoices out of WhatsApp, Excel, and paper.",
    features: [
      "Up to 50 invoices/month",
      "5 clients",
      "Email delivery",
      "Basic reports",
      "1 user",
    ],
    cta: "Start Starter",
    href: "/signup",
  },
  {
    name: "Business",
    price: "N$350",
    annual: "N$3,500/yr",
    eyebrow: "Most popular",
    audience: "Small businesses, consultants, retailers",
    bestFor: "Unlimited invoices, proper follow-up, and purchase tracking.",
    features: [
      "Unlimited invoices",
      "Unlimited clients",
      "Automated reminders",
      "Full reports",
      "3 users",
      "Purchase tracking",
    ],
    cta: "Choose Business",
    href: "/signup",
    featured: true,
  },
  {
    name: "Professional",
    price: "N$750",
    annual: "N$7,500/yr",
    eyebrow: "Scale operations",
    audience: "Medium businesses, growing SMEs",
    bestFor: "Teams that need branding, exports, API access, and priority support.",
    features: [
      "All Business features",
      "API access",
      "NamRA export tools",
      "10 users",
      "Custom branding",
      "Priority support",
    ],
    cta: "Choose Professional",
    href: "/signup",
  },
  {
    name: "Enterprise",
    price: "N$2,000",
    annual: "Custom",
    eyebrow: "Custom support",
    audience: "Large businesses, branches, government contractors",
    bestFor: "Multi-branch operations that need custom integration and SLA support.",
    features: [
      "All Professional features",
      "Multi-branch",
      "SLA guarantee",
      "Unlimited users",
      "Custom integrations",
      "Dedicated account manager",
    ],
    cta: "Talk to sales",
    href: "/contact",
  },
];

const included = [
  {
    icon: FileText,
    title: "Professional invoices",
    body: "Create clean client invoices with the right totals and a better presentation.",
  },
  {
    icon: ReceiptText,
    title: "VAT-ready records",
    body: "Keep subtotal, VAT, and total amounts separate when VAT applies.",
  },
  {
    icon: Landmark,
    title: "NAD-native pricing",
    body: "Plans are priced in Namibian dollars for local business budgets.",
  },
  {
    icon: ShieldCheck,
    title: "Digital record keeping",
    body: "Keep invoices and purchase records organized for review and reporting.",
  },
];

const comparisonRows = [
  ["Monthly invoices", "50", "Unlimited", "Unlimited", "Unlimited"],
  ["Clients", "5", "Unlimited", "Unlimited", "Unlimited"],
  ["Users", "1", "3", "10", "Unlimited"],
  ["Automated reminders", "-", "Included", "Included", "Included"],
  ["Purchase tracking", "-", "Included", "Included", "Included"],
  ["Custom branding", "-", "-", "Included", "Included"],
  ["Custom integrations", "-", "-", "-", "Included"],
];

const faqs = [
  [
    "Which plan should I choose first?",
    "Start with Starter if you invoice a small client list. Choose Business if you need unlimited invoices, reminders, and purchase tracking.",
  ],
  [
    "Are prices in Namibian dollars?",
    "Yes. Payvio pricing is listed in NAD so local businesses can budget without currency conversion.",
  ],
  [
    "Does Payvio submit directly to NamRA/ITAS?",
    "Not in v1. Payvio focuses on VAT-ready records and export tools first, with direct integrations added when official requirements are available and tested.",
  ],
  [
    "Can I change plans later?",
    "Yes. Start with the plan that fits your current invoice volume, then move up when your client list or team grows.",
  ],
];

export default function PricingPage() {
  return (
    <div className="il-page min-h-screen bg-white text-[var(--pv-ink)]">
      <MarketingHeader />

      <main>
        <section className="bg-white px-5 py-20 text-center sm:px-8 sm:py-28">
        <p className="mx-auto inline-flex rounded-full bg-[var(--pv-mint-soft)] px-5 py-2 text-sm font-black text-[var(--pv-ink)]">
          Pricing built for Namibian SMEs
        </p>
        <h1 className="mx-auto mt-8 max-w-5xl text-5xl font-black leading-[1.02] sm:text-7xl">
          Pick the invoice plan that fits how your business works.
        </h1>
        <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-[var(--ink-soft)]">
          Start simple with professional invoices. Upgrade when you need unlimited clients,
          reminders, purchase tracking, reports, branding, or custom support.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link className="il-dark-button" href="#plans">
            View plans
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link className="il-light-button" href="/contact">
            Talk to us
          </Link>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 sm:py-28" id="plans">
        <div className="mx-auto max-w-[1180px]">
          <div className="grid gap-7 lg:grid-cols-[0.82fr_1fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase text-[var(--pv-green)]">
                Plans
              </p>
              <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
                Simple monthly plans. Clear annual options.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-[var(--ink-soft)] lg:justify-self-end">
              The Business plan is the best fit for most active SMEs because it removes
              invoice and client limits while adding reminders, reports, and purchases.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <article
                className={`relative flex flex-col rounded-[8px] border p-6 ${
                  plan.featured
                    ? "border-[var(--pv-green)] bg-[var(--pv-mint-soft)] shadow-[0_18px_50px_rgba(9,120,225,0.12)]"
                    : "border-[var(--pv-line)] bg-white"
                }`}
                key={plan.name}
              >
                <span
                  className={`mb-5 w-max rounded-full px-3 py-1 text-xs font-black ${
                    plan.featured
                      ? "bg-[var(--pv-ink)] text-white"
                      : "bg-[var(--pv-paper-warm)] text-[var(--pv-green)]"
                  }`}
                >
                  {plan.eyebrow}
                </span>
                <h3 className="text-2xl font-black">{plan.name}</h3>
                <p className="mt-3 min-h-12 text-sm font-bold leading-6 text-[var(--ink-muted)]">
                  {plan.audience}
                </p>
                <div className="mt-6">
                  <strong className="text-4xl font-black">{plan.price}</strong>
                  <span className="ml-1 text-sm font-bold text-[var(--ink-muted)]">/mo</span>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--pv-green)]">{plan.annual}</p>
                <p className="mt-5 text-sm leading-6 text-[var(--ink-soft)]">{plan.bestFor}</p>
                <ul className="mt-6 grid gap-3">
                  {plan.features.map((feature) => (
                    <li className="flex gap-2 text-sm font-bold leading-5 text-[var(--pv-ink)]" key={feature}>
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--pv-green)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  className={plan.featured ? "il-dark-button mt-7 w-full" : "il-light-button mt-7 w-full"}
                  href={plan.href}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--pv-paper-warm)] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase text-[var(--pv-green)]">
              All plans
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
              Local invoice basics from day one.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[var(--ink-soft)]">
              Payvio is positioned for the everyday finance work Namibian businesses
              already need: clear invoices, client records, VAT-ready totals, and digital history.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {included.map((item) => {
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
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase text-[var(--pv-green)]">
                Compare
              </p>
              <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
                See what changes as you grow.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-[var(--ink-soft)] lg:justify-self-end">
              Upgrade only when a real business need appears: more clients, more users,
              automation, branding, or branch support.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-[8px] border border-[var(--pv-line)]">
            <table className="w-full min-w-[760px] border-collapse bg-white text-left">
              <thead className="bg-[var(--pv-paper-warm)] text-xs font-black uppercase text-[var(--ink-muted)]">
                <tr>
                  <th className="px-5 py-4">Feature</th>
                  <th className="px-5 py-4">Starter</th>
                  <th className="px-5 py-4">Business</th>
                  <th className="px-5 py-4">Professional</th>
                  <th className="px-5 py-4">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([feature, starter, business, professional, enterprise]) => (
                  <tr className="border-t border-[var(--pv-line)]" key={feature}>
                    <td className="px-5 py-4 font-black">{feature}</td>
                    {[starter, business, professional, enterprise].map((value, index) => (
                      <td className="px-5 py-4 font-bold text-[var(--ink-soft)]" key={`${feature}-${index}`}>
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-[var(--pv-ink)] px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.75fr_1fr] lg:items-start">
          <div>
            <Sparkles aria-hidden="true" className="size-7 text-[var(--pv-mint)]" />
            <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
              Built around Namibia&apos;s invoice problem.
            </h2>
          </div>
          <div className="grid gap-3">
            {[
              "Many SMEs still invoice through paper, Excel, Word, or WhatsApp.",
              "VAT-ready records and invoice retention are hard to manage manually.",
              "Foreign tools are often expensive, complex, and not built around local needs.",
              "Payvio keeps the sales message simple: professional invoices and clearer records.",
            ].map((item) => (
              <div className="flex gap-3 rounded-[8px] bg-white/10 p-5" key={item}>
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-[var(--pv-mint)]" />
                <p className="text-sm font-bold leading-6 text-white/70">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1fr]">
          <div>
            <p className="text-xs font-black uppercase text-[var(--pv-green)]">
              Questions
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[1.02] sm:text-6xl">
              Clear answers before you choose.
            </h2>
            <Link className="il-dark-button mt-8" href="/contact">
              Contact Payvio
            </Link>
          </div>
          <div className="grid gap-3">
            {faqs.map(([question, answer]) => (
              <article className="rounded-[8px] bg-[var(--pv-paper-warm)] p-6" key={question}>
                <h3 className="text-2xl font-black text-[var(--pv-ink)]">{question}</h3>
                <p className="mt-4 text-lg leading-8 text-[var(--ink-soft)]">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--pv-ink)] px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1fr_0.65fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase text-white/80">
              Start today
            </p>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] sm:text-7xl">
              Send the first clean invoice.
            </h2>
            <p className="mt-6 max-w-2xl text-lg font-bold leading-8 text-white/75">
              Choose a plan now, then upgrade when your invoice volume, team, or reporting needs grow.
            </p>
          </div>
          <div className="grid gap-3 rounded-[8px] bg-white p-5">
            <Link className="il-dark-button" href="/signup">
              Open workspace
            </Link>
            <Link className="il-light-button" href="/contact">
              Talk to sales
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
      </main>
    </div>
  );
}
