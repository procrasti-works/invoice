import Link from "next/link";
import type { ReactNode } from "react";

import { PayvioMark } from "@/app/_components/PayvioMark";

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
          <PayvioMark className="payvio-auth-mark" />
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
