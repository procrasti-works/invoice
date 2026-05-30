import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="Payvio overview">
        <Link href="/" aria-label="Payvio home">
          <img src="/payvio-logo.svg" alt="Payvio" style={{height:"51px"}} className="w-auto" />
        </Link>

        <div className="auth-preview">
          <div className="auth-preview-top">
            <span>Ledger</span>
            <strong>Secure workspace</strong>
          </div>
          <div className="auth-preview-grid">
            <span />
            <span />
            <span />
          </div>
          <div className="auth-preview-chart">
            <i />
          </div>
          <div className="auth-preview-table">
            <span>Invoice draft</span>
            <b>Review</b>
            <span>Payment match</span>
            <b>Ready</b>
            <span>Close export</span>
            <b>Synced</b>
          </div>
        </div>

        <div className="auth-panel-copy">
          <h2>Invoice work, approvals, and close in one calm workspace.</h2>
        </div>
      </section>

      <section className="auth-form-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <Link href="/" aria-label="Payvio home">
            <img src="/payvio-logo.svg" alt="Payvio" style={{height:"51px"}} className="w-auto mb-6" />
          </Link>
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </section>
    </main>
  );
}

export function AuthField({
  label,
  id,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={type === "password" ? 8 : undefined}
      />
    </label>
  );
}
