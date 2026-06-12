import Link from "next/link";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/app/_components/MarketingChrome";

export type LegalSection = {
  body: string[];
  items?: string[];
  title: string;
};

type LegalPageProps = {
  description: string;
  effectiveDate: string;
  eyebrow: string;
  sections: LegalSection[];
  summary: string[];
  title: string;
};

export function LegalPage({
  description,
  effectiveDate,
  eyebrow,
  sections,
  summary,
  title,
}: LegalPageProps) {
  return (
    <div className="il-page min-h-screen bg-white text-[var(--pv-ink)]">
      <MarketingHeader />
      <main>
        <section className="bg-white px-5 py-20 text-center sm:px-8 sm:py-28">
          <p className="mx-auto inline-flex rounded-full bg-[var(--pv-mint-soft)] px-5 py-2 text-sm font-black text-[var(--pv-ink)]">
            {eyebrow}
          </p>
          <h1 className="mx-auto mt-8 max-w-5xl text-5xl font-black leading-[1.02] sm:text-7xl">
            {title}
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-[var(--ink-soft)]">
            {description}
          </p>
          <p className="mt-6 text-sm font-black uppercase text-[var(--ink-muted)]">
            Last updated: {effectiveDate}
          </p>
        </section>

        <section className="border-y border-[var(--pv-line)] bg-[var(--pv-paper-bright)] px-5 py-10 sm:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-3">
            {summary.map((item) => (
              <div
                className="rounded-[8px] border border-[var(--pv-line)] bg-white p-5"
                key={item}
              >
                <p className="text-sm font-black leading-6 text-[var(--pv-ink)]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.28fr_1fr] lg:items-start">
            <aside className="lg:sticky lg:top-28">
              <p className="text-xs font-black uppercase text-[var(--pv-green)]">
                Document
              </p>
              <div className="mt-5 grid gap-3 rounded-[8px] bg-[var(--pv-paper-warm)] p-5 text-sm font-bold text-[var(--ink-soft)]">
                {sections.map((section) => (
                  <a href={`#${slugify(section.title)}`} key={section.title}>
                    {section.title}
                  </a>
                ))}
              </div>
            </aside>

            <article className="grid gap-8">
              {sections.map((section, index) => (
                <section
                  className="rounded-[8px] border border-[var(--pv-line)] bg-white p-6 sm:p-8"
                  id={slugify(section.title)}
                  key={section.title}
                >
                  <p className="text-xs font-black uppercase text-[var(--pv-green)]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                    {section.title}
                  </h2>
                  <div className="mt-5 grid gap-4 text-base leading-8 text-[var(--ink-soft)]">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {section.items ? (
                      <ul className="grid gap-3 pl-5">
                        {section.items.map((item) => (
                          <li className="list-disc" key={item}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </section>

        <section className="bg-[var(--pv-ink)] px-5 py-20 text-white sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1fr_0.65fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase text-white/80">
                Legal questions
              </p>
              <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] sm:text-7xl">
                Contact Payvio before relying on anything unclear.
              </h2>
            </div>
            <div className="grid gap-3 rounded-[8px] bg-white p-5">
              <Link className="il-dark-button" href="/contact">
                Contact Payvio
              </Link>
              <Link className="il-light-button" href="/terms">
                View terms
              </Link>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </div>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
