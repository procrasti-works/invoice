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
    <div className="il-page min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <main>
        <section className="bg-background px-5 py-20 text-center sm:px-8 sm:py-28">
          <p className="mx-auto inline-flex rounded-full bg-secondary px-5 py-2 text-sm font-semibold text-foreground">
            {eyebrow}
          </p>
          <h1 className="mx-auto mt-8 max-w-5xl text-5xl font-semibold leading-[1.02] sm:text-7xl">
            {title}
          </h1>
          <p className="mx-auto mt-7 max-w-3xl text-xl font-medium leading-8 text-muted-foreground">
            {description}
          </p>
          <p className="mt-6 text-sm font-semibold uppercase text-muted-foreground">
            Last updated: {effectiveDate}
          </p>
        </section>

        <section className="border-y border-border bg-muted px-5 py-10 sm:px-8">
          <div className="mx-auto grid max-w-[1180px] gap-4 md:grid-cols-3">
            {summary.map((item) => (
              <div
                className="rounded-[8px] border border-border bg-background p-5"
                key={item}
              >
                <p className="text-sm font-semibold leading-6 text-foreground">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-background px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[0.28fr_1fr] lg:items-start">
            <aside className="lg:sticky lg:top-28">
              <p className="text-xs font-semibold uppercase text-primary">
                Document
              </p>
              <div className="mt-5 grid gap-3 rounded-[8px] bg-muted p-5 text-sm font-medium text-muted-foreground">
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
                  className="rounded-[8px] border border-border bg-background p-6 sm:p-8"
                  id={slugify(section.title)}
                  key={section.title}
                >
                  <p className="text-xs font-semibold uppercase text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                    {section.title}
                  </h2>
                  <div className="mt-5 grid gap-4 text-base leading-8 text-muted-foreground">
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

        <section className="bg-primary px-5 py-20 text-primary-foreground sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1fr_0.65fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-primary-foreground/80">
                Legal questions
              </p>
              <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.02] sm:text-7xl">
                Contact Payvio before relying on anything unclear.
              </h2>
            </div>
            <div className="grid gap-3 rounded-[8px] bg-background p-5">
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
