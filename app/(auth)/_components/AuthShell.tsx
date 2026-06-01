import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  note?: ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
  footer,
  note,
}: AuthShellProps) {
  return (
    <main className="payvio-auth-screen">
      <section className="payvio-auth-panel" aria-labelledby="auth-title">
        <Link href="/" className="payvio-auth-logo" aria-label="Payvio home">
          <PayvioAuthMark />
        </Link>
        <div className="payvio-auth-heading">
          <h1 id="auth-title">{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="payvio-auth-card">
          {children}
          {note ? <div className="payvio-auth-note">{note}</div> : null}
        </div>
        <div className="payvio-auth-footer">{footer}</div>
      </section>
    </main>
  );
}

function PayvioAuthMark() {
  return (
    <svg
      aria-hidden="true"
      className="payvio-auth-mark"
      viewBox="0 0 48 48"
      focusable="false"
    >
      <circle className="payvio-auth-mark-ink" cx="24" cy="24" r="21" />
      <path className="payvio-auth-mark-letter" d="M16 35V13h10.2c5.1 0 8.5 3.1 8.5 7.6s-3.4 7.6-8.5 7.6H21" />
      <path className="payvio-auth-mark-ledger" d="M24.5 35 33.8 17" />
      <path className="payvio-auth-mark-ledger" d="M27.4 35h7.2" />
      <circle className="payvio-auth-mark-dot" cx="35.5" cy="34.5" r="2.4" />
    </svg>
  );
}

export function AuthField({
  label,
  id,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
  action,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
  action?: ReactNode;
}) {
  return (
    <label className="payvio-auth-field" htmlFor={id}>
      <span className="payvio-auth-field-top">
        <span>{label}</span>
        {action}
      </span>
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
