import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/app/_components/MarketingChrome";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Clock,
  FileText,
  MailCheck,
  ShieldCheck,
} from "@/app/_components/IconPack";

export const metadata: Metadata = {
  title: "Blog | Payvio",
  description:
    "Practical invoice, payment, VAT, and records guides for Namibian businesses.",
};

const posts = [
  {
    slug: "cut-invoice-cycle",
    category: "Cash flow",
    date: "May 20, 2026",
    readTime: "5 min read",
    title: "How to cut your invoice-to-payment cycle in half",
    excerpt:
      "Send invoices sooner, use approval links, set clear terms, and follow up before payments go stale.",
    icon: MailCheck,
    takeaways: [
      "Send invoices when work is complete",
      "Use client approval links",
      "Automate reminders around due dates",
    ],
  },
  {
    slug: "invoice-mistakes",
    category: "Operations",
    date: "May 12, 2026",
    readTime: "4 min read",
    title: "The 5 invoice mistakes that delay client payments",
    excerpt:
      "Missing VAT breakdowns, unclear line items, weak numbering, and poor follow-up can all slow payment.",
    icon: FileText,
    takeaways: [
      "Keep VAT visible when it applies",
      "Use clear invoice numbers",
      "Send invoices to the billing contact",
    ],
  },
  {
    slug: "secure-approval-links",
    category: "Security",
    date: "Apr 28, 2026",
    readTime: "6 min read",
    title: "Why secure client approval links matter",
    excerpt:
      "A hosted client link reduces attachment tampering and keeps invoice review tied to the original record.",
    icon: ShieldCheck,
    takeaways: [
      "Avoid editable attachment workflows",
      "Keep invoice records hosted",
      "Confirm bank-detail changes directly",
    ],
  },
];

const resources = [
  ["Invoice setup", "Line items, terms, VAT, and client details"],
  ["Client follow-up", "Approval links, reminders, and overdue steps"],
  ["Record keeping", "Digital invoice history and purchase records"],
];

export default function BlogPage() {
  return (
    <div className="il-page min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main>
        <section className="bg-background px-5 py-20 text-center sm:px-8 sm:py-28">
          <p className="mx-auto inline-flex rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-foreground">
            Payvio resources
          </p>
          <h1 className="mx-auto mt-8 max-w-5xl text-5xl font-semibold leading-[1.02] sm:text-7xl">
            Practical guides for cleaner invoice work.
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-muted-foreground">
            Short, useful notes for Namibian business owners who want better invoices,
            faster follow-up, and clearer records.
          </p>
        </section>

        <section className="border-y border-border bg-muted px-5 py-10 sm:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-3">
            {resources.map(([title, body]) => (
              <article className="rounded-[8px] border border-border bg-background p-5" key={title}>
                <BookOpenCheck aria-hidden="true" className="size-6 text-primary" strokeWidth={1.8} />
                <h2 className="mt-4 text-xl font-semibold">{title}</h2>
                <p className="mt-3 text-sm font-medium leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-background px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-7 lg:grid-cols-[0.78fr_1fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Latest</p>
                <h2 className="mt-5 text-4xl font-semibold leading-[1.02] sm:text-6xl">
                  Read before the next invoice goes out.
                </h2>
              </div>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
                Each guide is written for practical action: send better invoices,
                reduce delays, and keep records easier to trust.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {posts.map((post) => {
                const Icon = post.icon;
                return (
                  <article className="flex flex-col rounded-[8px] border border-border bg-background p-6" key={post.slug}>
                    <div className="flex items-center justify-between gap-4">
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                        {post.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Clock aria-hidden="true" className="size-3.5" />
                        {post.readTime}
                      </span>
                    </div>
                    <div className="mt-8 grid size-14 place-items-center rounded-[8px] bg-muted text-primary">
                      <Icon aria-hidden="true" className="size-7" strokeWidth={1.8} />
                    </div>
                    <p className="mt-6 text-xs font-semibold uppercase text-muted-foreground">{post.date}</p>
                    <h3 className="mt-3 text-2xl font-semibold leading-tight">{post.title}</h3>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
                    <ul className="mt-6 grid gap-2">
                      {post.takeaways.map((item) => (
                        <li className="flex gap-2 text-sm font-medium leading-5" key={item}>
                          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-primary px-5 py-20 text-primary-foreground sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.75fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Simple operating rhythm</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.02] sm:text-6xl">
                Send. Track. Follow up. Keep the record.
              </h2>
            </div>
            <div className="grid gap-3">
              {["Create the invoice", "Send the client link", "Track approval and payment", "Export reports when needed"].map((item) => (
                <div className="flex gap-3 rounded-[8px] bg-primary-foreground/10 p-5" key={item}>
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                  <p className="text-sm font-medium leading-6 text-primary-foreground/70">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary px-5 py-20 text-primary-foreground sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1fr_0.65fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-primary-foreground/80">Ready when you are</p>
              <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] sm:text-7xl">
                Put the advice into the next invoice.
              </h2>
            </div>
            <div className="grid gap-3 rounded-[8px] bg-background p-5">
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
