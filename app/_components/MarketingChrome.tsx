import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  Building2,
  FileText,
  Landmark,
  Receipt,
  ReceiptText,
  ScanLine,
  Send,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PayvioMark } from "./PayvioMark";

type NavItem = {
  body: string;
  href: string;
  icon: LucideIcon;
  label: string;
};

const productNavItems: NavItem[] = [
  {
    label: "Invoices",
    href: "/#invoices",
    body: "Create and send clean client invoices.",
    icon: FileText,
  },
  {
    label: "Scan Paper Invoices",
    href: "/#scan",
    body: "Extract supplier invoices into purchase records.",
    icon: ScanLine,
  },
  {
    label: "Receipt Tracker",
    href: "/#receipts",
    body: "Capture expense receipts and track VAT input automatically.",
    icon: Receipt,
  },
  {
    label: "Client approvals",
    href: "/#clients",
    body: "Give clients one secure review link.",
    icon: Send,
  },
  {
    label: "Ledger",
    href: "/#ledger",
    body: "Track invoices, purchases, and balances.",
    icon: BookOpenCheck,
  },
  {
    label: "VAT records",
    href: "/#vat",
    body: "Keep VAT-ready totals in one place.",
    icon: ReceiptText,
  },
];

const solutionNavItems: NavItem[] = [
  {
    label: "Small businesses",
    href: "/#platform",
    body: "Run invoicing without spreadsheets.",
    icon: Building2,
  },
  {
    label: "Freelancers",
    href: "/#platform",
    body: "Send professional invoices quickly.",
    icon: Users,
  },
  {
    label: "Finance teams",
    href: "/#ledger",
    body: "Keep client follow-up and records clear.",
    icon: BarChart3,
  },
  {
    label: "Namibian SMEs",
    href: "/#vat",
    body: "Work in NAD with local VAT-ready records.",
    icon: Landmark,
  },
];

const resourceNavItems: NavItem[] = [
  {
    label: "About Payvio",
    href: "/about",
    body: "Why we are building for local SMEs.",
    icon: Building2,
  },
  {
    label: "Blog",
    href: "/blog",
    body: "Simple notes for better invoicing.",
    icon: BookOpenCheck,
  },
  {
    label: "Contact",
    href: "/contact",
    body: "Talk to the team about getting started.",
    icon: Send,
  },
  {
    label: "Login",
    href: "/login",
    body: "Open your existing workspace.",
    icon: ShieldCheck,
  },
];

function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />;
}

function MegaMenu({
  featured,
  items,
  label,
}: {
  featured: { body: string; href: string; title: string };
  items: NavItem[];
  label: string;
}) {
  return (
    <div className="il-menu">
      <button className="il-menu-trigger" type="button">
        {label}
        <span aria-hidden="true" className="il-menu-chevron" />
      </button>
      <div className="il-menu-panel">
        <div className="il-menu-items">
          {items.map((item) => (
            <Link className="il-menu-item" href={item.href} key={item.label}>
              <span className="il-menu-icon">
                <NavIcon icon={item.icon} />
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.body}</small>
              </span>
            </Link>
          ))}
        </div>
        <Link className="il-menu-feature" href={featured.href}>
          <span className="il-menu-feature-art">
            <span />
          </span>
          <strong>{featured.title}</strong>
          <small>{featured.body}</small>
        </Link>
      </div>
    </div>
  );
}

function FooterLink({ children, href }: { children: ReactNode; href: string }) {
  return <Link href={href}>{children}</Link>;
}

export function MarketingHeader() {
  return (
    <header className="il-header">
      <div className="il-header-shell">
        <Link aria-label="Payvio home" className="il-header-logo" href="/">
          <span className="il-wordmark">
            <PayvioMark className="il-wordmark-mark" />
            <span>Payvio</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="il-header-nav">
          <MegaMenu
            featured={{
              title: "Start with invoices",
              body: "Create the first invoice, send the client link, and keep the record in Payvio.",
              href: "/signup",
            }}
            items={productNavItems}
            label="Product"
          />
          <MegaMenu
            featured={{
              title: "Built for local businesses",
              body: "Payvio is focused on everyday invoice work for Namibian SMEs.",
              href: "/about",
            }}
            items={solutionNavItems}
            label="Solutions"
          />
          <Link className="il-menu-trigger" href="/pricing">
            Pricing
          </Link>
          <MegaMenu
            featured={{
              title: "Talk to Payvio",
              body: "Ask about setup, invoices, VAT records, or getting your team onboarded.",
              href: "/contact",
            }}
            items={resourceNavItems}
            label="Resources"
          />
        </nav>

        <div className="il-header-actions">
          <Link className="il-header-login" href="/login">
            Login
          </Link>
          <Link className="il-header-cta" href="/signup">
            Open workspace
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="bg-[#0d141c] py-16 text-white">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 md:grid-cols-2 lg:grid-cols-6">
        <div>
          <span className="il-footer-wordmark">
            <PayvioMark className="il-footer-mark" />
            <span>Payvio</span>
          </span>
          <p className="mt-6 text-sm leading-7 text-white/65">
            Invoice and ledger software for Namibian businesses.
          </p>
        </div>
        <div>
          <h3 className="font-black">Product</h3>
          <div className="mt-4 grid gap-2 text-sm text-white/65">
            <FooterLink href="/#invoices">Invoices</FooterLink>
            <FooterLink href="/#scan">Scan invoices</FooterLink>
            <FooterLink href="/#receipts">Receipt Tracker</FooterLink>
            <FooterLink href="/#clients">Clients</FooterLink>
            <FooterLink href="/#ledger">Ledger</FooterLink>
            <FooterLink href="/#vat">VAT records</FooterLink>
          </div>
        </div>
        <div>
          <h3 className="font-black">Company</h3>
          <div className="mt-4 grid gap-2 text-sm text-white/65">
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/blog">Blog</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
          </div>
        </div>
        <div>
          <h3 className="font-black">Account</h3>
          <div className="mt-4 grid gap-2 text-sm text-white/65">
            <FooterLink href="/signup">Open workspace</FooterLink>
            <FooterLink href="/login">Login</FooterLink>
            <FooterLink href="/forgot-password">Reset password</FooterLink>
          </div>
        </div>
        <div>
          <h3 className="font-black">Legal</h3>
          <div className="mt-4 grid gap-2 text-sm text-white/65">
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/policy">Policy</FooterLink>
          </div>
        </div>
        <div>
          <h3 className="font-black">Location</h3>
          <p className="mt-4 text-sm leading-7 text-white/65">
            Windhoek, Namibia
            <br />
            Built for local SMEs
          </p>
        </div>
      </div>
    </footer>
  );
}
