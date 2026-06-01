"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { Calculator, CheckCircle2, FileText, Shield } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

function formatMoney(amount: number, currency = "NAD") {
  try {
    return new Intl.NumberFormat("en-NA", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function VatPage() {
  const { canAccess } = usePlan();
  const workspace = useQuery(api.invoices.workspace);
  const summary = useQuery(api.reports.summary, {});
  const [amount, setAmount] = useState("1000");
  const [mode, setMode] = useState<"exclusive" | "inclusive">("exclusive");

  if (!canAccess("vat")) {
    return <LockedPage feature="VAT" requiredPlan="Starter" />;
  }

  const currency = summary?.currency ?? workspace?.defaultCurrency ?? "NAD";
  const value = Math.max(0, Number(amount) || 0);
  const subtotal = mode === "exclusive" ? value : value / 1.15;
  const vat = mode === "exclusive" ? value * 0.15 : value - subtotal;
  const total = subtotal + vat;
  const vatPosition = (summary?.vatCollected ?? 0) - (summary?.vatInput ?? 0);
  const checklist: { label: string; done: boolean }[] = [
    { label: "Business VAT setting saved", done: Boolean(workspace?.vatRegistered) },
    { label: "VAT number stored when registered", done: Boolean(workspace?.vatNumber) },
    { label: "Issued invoices include VAT totals", done: true },
    { label: "Purchase records include VAT input", done: true },
    { label: "Direct NamRA/ITAS submission", done: false },
  ];

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">VAT-ready records</p>
          <h1 className="db-page-title">VAT</h1>
        </div>
        <Link href="/dashboard/settings" className="db-outline-btn">
          <Shield className="size-4" />
          Business settings
        </Link>
      </div>

      <div className="db-compliance-banner">
        <div className="db-stat-icon" style={{ marginBottom: 0 }}>
          <Shield className="size-4" />
        </div>
        <div>
          <p className="db-compliance-title">
            {workspace?.vatRegistered ? "VAT is enabled for issued invoices" : "VAT is off for this workspace"}
          </p>
          <p className="db-compliance-sub">
            Payvio keeps invoice totals, input VAT, and supplier records ready for internal review.
          </p>
        </div>
        <span className="db-compliance-badge">{workspace?.vatRegistered ? "Enabled" : "Not registered"}</span>
      </div>

      <div className="db-stat-row db-stat-row-4">
        <div className="db-stat-card">
          <p className="db-stat-label">VAT collected</p>
          <p className="db-stat-value">{formatMoney(summary?.vatCollected ?? 0, currency)}</p>
          <p className="db-stat-sub">From issued invoices</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">VAT input</p>
          <p className="db-stat-value">{formatMoney(summary?.vatInput ?? 0, currency)}</p>
          <p className="db-stat-sub">From purchase records</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">VAT position</p>
          <p className="db-stat-value">{formatMoney(vatPosition, currency)}</p>
          <p className="db-stat-sub">Collected minus input</p>
        </div>
        <div className="db-stat-card">
          <p className="db-stat-label">Currency</p>
          <p className="db-stat-value">{currency}</p>
          <p className="db-stat-sub">Workspace default</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(320px,0.55fr)]">
        <section className="db-card">
          <p className="db-card-title">
            <FileText className="size-4" />
            VAT record checklist
          </p>
          <div className="db-compliance-list">
            {checklist.map(({ label, done }) => (
              <div key={label} className="db-compliance-row">
                <span className={done ? "db-compliance-check db-compliance-check-done" : "db-compliance-check db-compliance-check-pending"}>
                  {done ? "Y" : "-"}
                </span>
                <span>{label}</span>
                <span className="db-compliance-tag">{done ? "Ready" : "Manual"}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="db-card">
          <p className="db-card-title">
            <Calculator className="size-4" />
            VAT calculator
          </p>
          <div className="db-calc-wrap">
            <div className="db-calc-toggle">
              <button type="button" className={mode === "exclusive" ? "db-calc-toggle-active" : ""} onClick={() => setMode("exclusive")}>
                Add VAT
              </button>
              <button type="button" className={mode === "inclusive" ? "db-calc-toggle-active" : ""} onClick={() => setMode("inclusive")}>
                Extract VAT
              </button>
            </div>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="db-calc-input h-11 rounded-md border border-[#e5e7eb] px-3 text-sm"
            />
            <div className="db-calc-result">
              <div className="db-info-row"><span>Subtotal</span><strong>{formatMoney(subtotal, currency)}</strong></div>
              <div className="db-info-row"><span>VAT 15%</span><strong>{formatMoney(vat, currency)}</strong></div>
              <div className="db-info-row db-info-row-total"><span>Total</span><strong>{formatMoney(total, currency)}</strong></div>
            </div>
          </div>
        </section>
      </div>

      <div className="db-notice mt-5">
        <CheckCircle2 className="size-4" />
        Direct filing is not submitted from Payvio yet. The working records on this page are usable for review and export preparation.
      </div>
    </div>
  );
}
