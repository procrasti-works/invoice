import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/app/_components/MarketingChrome";
import {
  ArrowRight,
  Check,
  Mail,
  MapPin,
  MessageCircle,
  UserRound,
} from "@/app/_components/IconPack";

export const metadata: Metadata = {
  title: "Contact | Payvio",
  description:
    "Contact Payvio for pricing, VAT-ready invoicing, setup, and product questions.",
};

const people = [
  {
    initials: "NH",
    name: "Nazeem Harris",
    role: "Co-Founder and CTO",
    email: "inthelooppodastnazeem@gmail.com",
    handle: "@nazeem_harris",
    href: "https://www.instagram.com/nazeem_harris/",
  },
  {
    initials: "AM",
    name: "Andreas Mukombabi",
    role: "Co-Founder and CTO",
    email: "info.procrasti@gmail.com",
    handle: "@dot.a9",
    href: "https://www.instagram.com/dot.a9/",
  },
];

const questions = [
  [
    "Can Payvio export VAT records?",
    "Yes. Payvio keeps VAT-ready invoice records and report exports for review.",
  ],
  [
    "What currencies do you support?",
    "Payvio supports NAD, USD, and ZAR for businesses that work with local and cross-border clients.",
  ],
  [
    "Do you offer a free trial?",
    "Yes. New workspaces can start with a trial before choosing the plan that fits their invoice volume.",
  ],
  [
    "How do plans work?",
    "Plans are based on invoice volume, clients, users, reminders, reports, purchases, branding, and support needs.",
  ],
];

const contactReasons = [
  "Help choosing the right plan",
  "Questions about VAT-ready records",
  "Setup help for a new workspace",
  "Product feedback from a Namibian business",
];

export default function ContactPage() {
  return (
    <div className="il-page min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main>
        <section className="bg-background px-5 py-20 text-center sm:px-8 sm:py-28">
          <p className="mx-auto inline-flex rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-foreground">
            Contact Payvio
          </p>
          <h1 className="mx-auto mt-8 max-w-5xl text-5xl font-semibold leading-[1.02] sm:text-7xl">
            Simple answers. Clear next steps.
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-muted-foreground">
            Ask about pricing, setup, VAT-ready invoicing, client approvals, or
            whether Payvio fits your business.
          </p>
        </section>

        <section className="border-y border-border bg-muted px-5 py-10 sm:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-4">
            {contactReasons.map((item) => (
              <div className="flex gap-3 rounded-[8px] border border-border bg-background p-5" key={item}>
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                <p className="text-sm font-semibold leading-6">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-background px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Team</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.02] sm:text-6xl">
                Reach the founders directly.
              </h2>
              <div className="mt-8 rounded-[8px] bg-muted p-6">
                <MapPin aria-hidden="true" className="size-6 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">Windhoek, Namibia</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Building Namibia&apos;s invoice infrastructure one SME at a time.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {people.map((person) => (
                <article className="rounded-[8px] border border-border bg-background p-6" key={person.email}>
                  <div className="flex items-start gap-4">
                    <span className="grid size-14 shrink-0 place-items-center rounded-[8px] bg-primary text-lg font-semibold text-primary-foreground">
                      {person.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-semibold">{person.name}</h3>
                        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                          {person.role}
                        </span>
                      </div>
                      <div className="mt-5 grid gap-2 text-sm font-medium text-muted-foreground">
                        <a className="inline-flex items-center gap-2 break-all text-primary" href={`mailto:${person.email}`}>
                          <Mail aria-hidden="true" className="size-4 shrink-0" />
                          {person.email}
                        </a>
                        <a className="inline-flex items-center gap-2 text-muted-foreground" href={person.href} rel="noreferrer" target="_blank">
                          <UserRound aria-hidden="true" className="size-4 shrink-0" />
                          {person.handle}
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.72fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Questions</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.02] sm:text-6xl">
                Common things people ask first.
              </h2>
            </div>
            <div className="grid gap-3">
              {questions.map(([question, answer]) => (
                <article className="rounded-[8px] bg-background p-6" key={question}>
                  <h3 className="text-2xl font-semibold text-foreground">{question}</h3>
                  <p className="mt-4 text-lg leading-8 text-muted-foreground">{answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary px-5 py-20 text-primary-foreground sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.75fr_1fr] lg:items-center">
            <div>
              <MessageCircle aria-hidden="true" className="size-7 text-primary" />
              <h2 className="mt-5 text-4xl font-semibold leading-[1.02] sm:text-6xl">
                Tell us what your invoice flow looks like.
              </h2>
            </div>
            <p className="text-lg font-medium leading-8 text-primary-foreground/70">
              The fastest way to choose the right plan is to understand your client count,
              monthly invoice volume, VAT needs, and whether you track supplier purchases.
            </p>
          </div>
        </section>

        <section className="bg-primary px-5 py-20 text-primary-foreground sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1fr_0.65fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-primary-foreground/80">Ready when you are</p>
              <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] sm:text-7xl">
                Start with a workspace.
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
