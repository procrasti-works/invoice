import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="new-auth-page">

      {/* ── Left brand panel ── */}
      <section className="new-auth-brand">
        <div className="new-auth-brand-top">
          <Link href="/" aria-label="Payvio home">
            <img src="/payvio-logo.svg" alt="Payvio" className="new-auth-logo" />
          </Link>
        </div>

        {/* Dashboard preview mockup */}
        <div className="new-auth-mockup">
          {/* Sidebar strip */}
          <div className="new-auth-mock-sidebar">
            <div className="new-auth-mock-logo-dot" />
            {["Invoices", "Clients", "Reminders", "Reports", "Ledger", "VAT"].map((item, i) => (
              <div key={item} className={`new-auth-mock-nav-item${i === 0 ? " active" : ""}`}>
                <div className="new-auth-mock-nav-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Main content strip */}
          <div className="new-auth-mock-main">
            {/* Stat cards */}
            <div className="new-auth-mock-stats">
              {[
                { label: "Outstanding", color: "#dcfce7", accent: "#16a34a" },
                { label: "Paid", color: "#dbeafe", accent: "#1a6fc4" },
                { label: "Active", color: "#fef9c3", accent: "#ca8a04" },
                { label: "Overdue", color: "#fee2e2", accent: "#dc2626" },
              ].map((s) => (
                <div key={s.label} className="new-auth-mock-stat" style={{ background: s.color }}>
                  <div className="new-auth-mock-stat-dot" style={{ background: s.accent }} />
                  <span style={{ color: s.accent, fontSize: "0.6rem", fontWeight: 600 }}>{s.label}</span>
                  <div className="new-auth-mock-stat-bar" style={{ background: s.accent }} />
                </div>
              ))}
            </div>

            {/* Mini table */}
            <div className="new-auth-mock-table">
              <div className="new-auth-mock-table-header">
                <span>Invoice</span><span>Client</span><span>Status</span><span>Amount</span>
              </div>
              {[
                { inv: "INV-001", client: "Acme Ltd", status: "Paid", color: "#16a34a" },
                { inv: "INV-002", client: "Delta Corp", status: "Sent", color: "#1a6fc4" },
                { inv: "INV-003", client: "Vantage Co", status: "Draft", color: "#6b7280" },
              ].map((row) => (
                <div key={row.inv} className="new-auth-mock-table-row">
                  <span>{row.inv}</span>
                  <span>{row.client}</span>
                  <span style={{ color: row.color, fontWeight: 600 }}>{row.status}</span>
                  <span>N$1,250</span>
                </div>
              ))}
            </div>

            {/* NamRA badge */}
            <div className="new-auth-mock-badge">
              <div className="new-auth-mock-badge-dot" />
              NamRA ITAS Compliant
            </div>
          </div>
        </div>

        <div className="new-auth-brand-copy">
          <h2>Namibia's invoice platform for modern SMEs.</h2>
          <p>Create, send, approve and track invoices — fully NamRA compliant. Built for Namibian businesses.</p>
          <div className="new-auth-brand-stats">
            <div><strong>40,000+</strong><span>Active SMEs</span></div>
            <div><strong>NamRA</strong><span>ITAS Ready</span></div>
            <div><strong>15%</strong><span>VAT Auto-calc</span></div>
          </div>
        </div>
      </section>

      {/* ── Right form panel ── */}
      <section className="new-auth-form-panel" aria-labelledby="auth-title">
        <div className="new-auth-card">
          <Link href="/" className="new-auth-form-logo-link">
            <img src="/payvio-logo.svg" alt="Payvio" className="new-auth-form-logo" />
          </Link>
          <span className="new-auth-eyebrow">{eyebrow}</span>
          <h1 id="auth-title" className="new-auth-title">{title}</h1>
          <p className="new-auth-description">{description}</p>
          {children}
          <div className="new-auth-footer">{footer}</div>
        </div>
      </section>
    </main>
  );
}

export function AuthField({
  label, id, type = "text", placeholder, autoComplete, required = true,
}: {
  label: string; id: string; type?: string;
  placeholder: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <label className="new-auth-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id} name={id} type={type} placeholder={placeholder}
        autoComplete={autoComplete} required={required}
        minLength={type === "password" ? 8 : undefined}
      />
    </label>
  );
}
