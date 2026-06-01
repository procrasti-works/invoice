"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  Loader2,
  Save,
  Shield,
  SlidersHorizontal,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type TaxMode = "no_vat" | "vat_15" | "zero_rated" | "exempt";
type VatSettingsForm = {
  vatRegistered: boolean;
  vatNumber: string;
  taxId: string;
  vatRegistrationType: "not_registered" | "voluntary" | "mandatory";
  vatFilingFrequency: "monthly" | "bi_monthly";
  vatReturnDueDay: string;
  vatRecordRetentionYears: string;
  vatDefaultTaxMode: TaxMode;
  vedEnabled: boolean;
  vedTransmissionMode: "manual_export" | "near_real_time" | "real_time";
  itasRegistered: boolean;
};

const defaultSettingsForm: VatSettingsForm = {
  vatRegistered: false,
  vatNumber: "",
  taxId: "",
  vatRegistrationType: "not_registered",
  vatFilingFrequency: "monthly",
  vatReturnDueDay: "25",
  vatRecordRetentionYears: "5",
  vatDefaultTaxMode: "no_vat",
  vedEnabled: false,
  vedTransmissionMode: "manual_export",
  itasRegistered: false,
};

const fieldClass = "db-field-input";

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

function monthStartIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function monthEndIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: unknown[][]) {
  downloadBlob(
    filename,
    rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    "text/csv;charset=utf-8",
  );
}

function settingsToForm(settings: NonNullable<ReturnTypePlaceholder>["settings"]): VatSettingsForm {
  if (!settings) {
    return defaultSettingsForm;
  }

  return {
    vatRegistered: settings.vatRegistered,
    vatNumber: settings.vatNumber,
    taxId: settings.taxId,
    vatRegistrationType: settings.registrationType as VatSettingsForm["vatRegistrationType"],
    vatFilingFrequency: settings.filingFrequency,
    vatReturnDueDay: String(settings.returnDueDay),
    vatRecordRetentionYears: String(settings.recordRetentionYears),
    vatDefaultTaxMode: settings.defaultTaxMode,
    vedEnabled: settings.vedEnabled,
    vedTransmissionMode: settings.transmissionMode,
    itasRegistered: settings.itasRegistered,
  };
}

type ReturnTypePlaceholder = {
  settings: {
    vatRegistered: boolean;
    vatNumber: string;
    taxId: string;
    registrationType: string;
    filingFrequency: VatSettingsForm["vatFilingFrequency"];
    returnDueDay: number;
    recordRetentionYears: number;
    defaultTaxMode: TaxMode;
    vedEnabled: boolean;
    transmissionMode: VatSettingsForm["vedTransmissionMode"];
    itasRegistered: boolean;
  } | null;
};

function taxModeLabel(value: TaxMode) {
  if (value === "vat_15") {
    return "VAT 15%";
  }

  if (value === "zero_rated") {
    return "Zero-rated";
  }

  if (value === "exempt") {
    return "Exempt";
  }

  return "No VAT";
}

export default function VatPage() {
  const { canAccess } = usePlan();
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(monthEndIso);
  const summary = useQuery(api.vat.returnSummary, { from, to });
  const updateSettings = useMutation(api.vat.updateSettings);
  const [settingsForm, setSettingsForm] = useState<VatSettingsForm>(defaultSettingsForm);
  const [settingsVersion, setSettingsVersion] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("1000");
  const [mode, setMode] = useState<"exclusive" | "inclusive">("exclusive");

  const settings = summary?.settings ?? null;
  const organization = summary?.organization ?? null;
  const currency = organization?.currency ?? "NAD";
  const rows = useMemo(() => summary?.exportRows ?? [], [summary?.exportRows]);
  const totals = summary?.totals;
  const vatRate = settings?.vatRate ?? 0.15;
  const value = Math.max(0, Number(amount) || 0);
  const subtotal = mode === "exclusive" ? value : value / (1 + vatRate);
  const vat = mode === "exclusive" ? value * vatRate : value - subtotal;
  const total = subtotal + vat;

  const incompleteRows = useMemo(
    () => rows.filter((row) => row.vedStatus === "incomplete"),
    [rows],
  );
  const readinessRows = summary?.readiness ?? [];
  const completeReadinessCount = readinessRows.filter((item) => item.done).length;
  const transmissionLabel =
    settings?.transmissionMode === "manual_export"
      ? "Manual export"
      : settings?.transmissionMode?.replace(/_/g, " ") ?? "Manual export";
  const filingLabel = settings?.filingFrequency?.replace("_", "-") ?? "monthly";

  useEffect(() => {
    const version = `${settings?.vatRegistered}:${settings?.vatNumber}:${settings?.taxId}:${settings?.defaultTaxMode}:${settings?.filingFrequency}:${settings?.returnDueDay}:${settings?.recordRetentionYears}:${settings?.vedEnabled}:${settings?.transmissionMode}:${settings?.itasRegistered}`;

    if (settings && version !== settingsVersion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettingsForm(settingsToForm(settings));
      setSettingsVersion(version);
    }
  }, [settings, settingsVersion]);

  if (!canAccess("vat")) {
    return <LockedPage feature="VAT" requiredPlan="Starter" />;
  }

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      await updateSettings({
        vatRegistered: settingsForm.vatRegistered,
        vatNumber: settingsForm.vatNumber,
        taxId: settingsForm.taxId,
        vatRegistrationType: settingsForm.vatRegistered
          ? settingsForm.vatRegistrationType === "not_registered"
            ? "mandatory"
            : settingsForm.vatRegistrationType
          : "not_registered",
        vatFilingFrequency: settingsForm.vatFilingFrequency,
        vatReturnDueDay: Number(settingsForm.vatReturnDueDay) || 25,
        vatRecordRetentionYears: Number(settingsForm.vatRecordRetentionYears) || 5,
        vatDefaultTaxMode: settingsForm.vatRegistered
          ? settingsForm.vatDefaultTaxMode
          : "no_vat",
        vedEnabled: settingsForm.vatRegistered && settingsForm.vedEnabled,
        vedTransmissionMode: settingsForm.vedTransmissionMode,
        itasRegistered: settingsForm.itasRegistered,
      });
      setNotice("VAT settings saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save VAT settings.");
    } finally {
      setSaving(false);
    }
  }

  function exportRows() {
    downloadCsv(`payvio-vat-return-${from}-to-${to}.csv`, [
      [
        "Record type",
        "Document type",
        "Document number",
        "Issue date",
        "Party name",
        "Party address",
        "Party VAT number",
        "Tax mode",
        "Subtotal",
        "VAT",
        "Total",
        "Currency",
        "Status",
        "Retention until",
        "VAT status",
        "Missing fields",
      ],
      ...rows.map((row) => [
        row.recordType,
        row.documentType,
        row.documentNumber,
        row.issueDate,
        row.partyName,
        row.partyAddress,
        row.partyVatNumber,
        row.taxModeLabel,
        row.subtotal,
        row.vatAmount,
        row.total,
        row.currency,
        row.status,
        row.retentionUntil,
        row.vedStatus,
        row.missingFields,
      ]),
    ]);
  }

  function exportJson() {
    downloadBlob(
      `payvio-itas-export-${from}-to-${to}.json`,
      JSON.stringify(
        {
          organization,
          period: summary?.period,
          settings,
          totals,
          records: rows,
        },
        null,
        2,
      ),
      "application/json;charset=utf-8",
    );
  }

  return (
    <div className="db-page db-dashboard-page db-vat-page">
      <section className="db-workview">
        <div className="db-workview-head">
          <div>
            <p className="db-breadcrumb">
              Payvio <span>/</span> VAT
            </p>
            <h1 className="db-workview-title">VAT</h1>
          </div>
          <div className="db-vat-header-actions">
            <button
              className="db-outline-btn"
              type="button"
              onClick={exportJson}
              disabled={!summary}
            >
              <Download className="size-4" />
              Export JSON
            </button>
            <button
              className="db-primary-btn db-new-invoice-btn"
              type="button"
              onClick={exportRows}
              disabled={!summary}
            >
              <Download className="size-4" />
              Export CSV
            </button>
          </div>
        </div>

        {notice ? (
          <div className="db-notice db-notice-clean">
            <CheckCircle2 className="size-4" />
            <span>{notice}</span>
          </div>
        ) : null}

        {error ? (
          <div className="db-notice db-notice-clean db-vat-error">
            <AlertTriangle className="size-4" />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="db-card db-vat-status-card">
          <div className="db-vat-status-main">
            <span className="db-vat-status-icon">
              <Shield className="size-4" />
            </span>
            <div>
              <p>{settings?.vedEnabled ? "VAT records enabled" : "VAT records inactive"}</p>
              <span>
                VAT {Math.round(vatRate * 100)}% | due day {settings?.returnDueDay ?? 25} |{" "}
                {settings?.recordRetentionYears ?? 5} year retention
              </span>
            </div>
          </div>
          <span className="db-compliance-badge db-vat-status-badge">
            {transmissionLabel}
          </span>
        </section>

        <section className="db-card db-vat-period-card">
          <div className="db-panel-header">
            <div>
              <p className="db-panel-kicker">Period</p>
              <h2>Return window</h2>
            </div>
            <Link href="/dashboard/settings" className="db-outline-btn db-vat-settings-link">
              <SlidersHorizontal className="size-4" />
              Workspace settings
            </Link>
          </div>
          <div className="db-vat-period-body">
            <label className="db-field">
              Period from
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="db-field">
              Period to
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
        </section>

        <div className="db-metric-strip" aria-label="VAT metrics">
          <div className="db-metric-cell">
            <span>Output VAT</span>
            <strong>{formatMoney(totals?.outputVat ?? 0, currency)}</strong>
            <small>{totals?.issuedInvoiceCount ?? 0} issued invoices</small>
          </div>
          <div className="db-metric-cell">
            <span>Input VAT</span>
            <strong>{formatMoney(totals?.inputVat ?? 0, currency)}</strong>
            <small>{totals?.purchaseRecordCount ?? 0} supplier records</small>
          </div>
          <div className="db-metric-cell">
            <span>Net VAT</span>
            <strong>{formatMoney(totals?.netVat ?? 0, currency)}</strong>
            <small>{(totals?.netVat ?? 0) >= 0 ? "Payable" : "Refund position"}</small>
          </div>
          <div className="db-metric-cell">
            <span>Return due</span>
            <strong className="db-vat-date-metric">{summary?.period.dueDate ?? "-"}</strong>
            <small>{filingLabel}</small>
          </div>
        </div>

        <div className="db-vat-layout">
          <section className="db-card db-vat-panel">
            <div className="db-panel-header">
              <div>
                <p className="db-panel-kicker">Compliance</p>
                <h2>VAT readiness</h2>
              </div>
              <span className="db-panel-meta">
                {`${completeReadinessCount}/${readinessRows.length}`}
              </span>
            </div>
            <div className="db-compliance-list db-vat-readiness-list">
              {readinessRows.map((item) => (
                <div key={item.key} className="db-compliance-row">
                  <span
                    className={
                      item.done
                        ? "db-compliance-check db-compliance-check-done"
                        : "db-compliance-check db-compliance-check-pending"
                    }
                  >
                    {item.done ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <AlertTriangle className="size-3.5" />
                    )}
                  </span>
                  <span>{item.label}</span>
                  <span className="db-compliance-tag">{item.done ? "Ready" : "Open"}</span>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={handleSaveSettings} className="db-card db-vat-settings-card">
            <div className="db-panel-header">
              <div>
                <p className="db-panel-kicker">Workspace</p>
                <h2>VAT settings</h2>
              </div>
              <span className="db-panel-meta">
                <Save className="size-3.5" />
                Settings
              </span>
            </div>

            <div className="db-vat-settings-body">
              <label className="db-vat-toggle">
                <input
                  type="checkbox"
                  checked={settingsForm.vatRegistered}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      vatRegistered: event.target.checked,
                      vatRegistrationType: event.target.checked ? "mandatory" : "not_registered",
                      vatDefaultTaxMode: event.target.checked ? "vat_15" : "no_vat",
                      vedEnabled: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>VAT registered</strong>
                  <small>Enable VAT records and exports.</small>
                </span>
              </label>

              <div className="db-vat-form-grid db-vat-form-grid-2">
                <label className="db-field">
                  VAT number
                  <input
                    value={settingsForm.vatNumber}
                    disabled={!settingsForm.vatRegistered}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        vatNumber: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="db-field">
                  Tax ID
                  <input
                    value={settingsForm.taxId}
                    onChange={(event) =>
                      setSettingsForm((current) => ({ ...current, taxId: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="db-vat-form-grid db-vat-form-grid-2">
                <label className="db-field">
                  Registration type
                  <select
                    value={settingsForm.vatRegistrationType}
                    disabled={!settingsForm.vatRegistered}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        vatRegistrationType: event.target
                          .value as VatSettingsForm["vatRegistrationType"],
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="not_registered">Not registered</option>
                    <option value="voluntary">Voluntary</option>
                    <option value="mandatory">Mandatory</option>
                  </select>
                </label>
                <label className="db-field">
                  Default tax
                  <select
                    value={settingsForm.vatRegistered ? settingsForm.vatDefaultTaxMode : "no_vat"}
                    disabled={!settingsForm.vatRegistered}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        vatDefaultTaxMode: event.target.value as TaxMode,
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="vat_15">{taxModeLabel("vat_15")}</option>
                    <option value="zero_rated">{taxModeLabel("zero_rated")}</option>
                    <option value="exempt">{taxModeLabel("exempt")}</option>
                    <option value="no_vat">{taxModeLabel("no_vat")}</option>
                  </select>
                </label>
              </div>

              <div className="db-vat-form-grid db-vat-form-grid-3">
                <label className="db-field">
                  Filing
                  <select
                    value={settingsForm.vatFilingFrequency}
                    disabled={!settingsForm.vatRegistered}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        vatFilingFrequency: event.target
                          .value as VatSettingsForm["vatFilingFrequency"],
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="bi_monthly">Bi-monthly</option>
                  </select>
                </label>
                <label className="db-field">
                  Due day
                  <input
                    inputMode="numeric"
                    value={settingsForm.vatReturnDueDay}
                    disabled={!settingsForm.vatRegistered}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        vatReturnDueDay: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="db-field">
                  Retention
                  <input
                    inputMode="numeric"
                    value={settingsForm.vatRecordRetentionYears}
                    disabled={!settingsForm.vatRegistered}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        vatRecordRetentionYears: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <div className="db-vat-form-grid db-vat-form-grid-2">
                <label className="db-field">
                  Transmission
                  <select
                    value={settingsForm.vedTransmissionMode}
                    disabled={!settingsForm.vatRegistered}
                    onChange={(event) =>
                      setSettingsForm((current) => ({
                        ...current,
                        vedTransmissionMode: event.target
                          .value as VatSettingsForm["vedTransmissionMode"],
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="manual_export">Manual export</option>
                    <option value="near_real_time">Near real-time</option>
                    <option value="real_time">Real-time</option>
                  </select>
                </label>
                <label className="db-field">
                  ITAS
                  <span className="db-vat-checkbox-row">
                    <input
                      type="checkbox"
                      checked={settingsForm.itasRegistered}
                      disabled={!settingsForm.vatRegistered}
                      onChange={(event) =>
                        setSettingsForm((current) => ({
                          ...current,
                          itasRegistered: event.target.checked,
                        }))
                      }
                    />
                    Profile saved
                  </span>
                </label>
              </div>

              <label className="db-vat-toggle db-vat-toggle-compact">
                <input
                  type="checkbox"
                  checked={settingsForm.vatRegistered && settingsForm.vedEnabled}
                  disabled={!settingsForm.vatRegistered}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      vedEnabled: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>VAT records active</strong>
                  <small>Include VAT records in exports.</small>
                </span>
              </label>

              <div className="db-vat-action-row">
                <button type="submit" className="db-primary-btn" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Save VAT settings
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="db-vat-record-layout">
          <section className="db-card db-vat-audit-card">
            <div className="db-panel-header">
              <div>
                <p className="db-panel-kicker">Records</p>
                <h2>Audit records</h2>
              </div>
              {incompleteRows.length ? (
                <span className="db-compliance-tag db-vat-record-tag">
                  {incompleteRows.length} incomplete
                </span>
              ) : (
                <span className="db-compliance-tag db-vat-record-tag">Ready</span>
              )}
            </div>
            <div className="db-table-wrap">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Document</th>
                    <th>Date</th>
                    <th>Party</th>
                    <th>Tax</th>
                    <th>Status</th>
                    <th className="db-table-number">VAT</th>
                    <th className="db-table-number">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 40).map((row) => (
                    <tr key={`${row.recordType}:${row.documentNumber}:${row.issueDate}`}>
                      <td>{row.recordType}</td>
                      <td>
                        <span className="db-inv-num">{row.documentNumber || "-"}</span>
                        <span className="db-row-meta">{row.documentType}</span>
                      </td>
                      <td>{row.issueDate}</td>
                      <td>{row.partyName}</td>
                      <td>{row.taxModeLabel}</td>
                      <td>
                        <span
                          className={
                            row.vedStatus === "ready"
                              ? "db-status-pill db-vat-status-ready"
                              : "db-status-pill db-vat-status-open"
                          }
                        >
                          {row.vedStatus === "ready" ? "Ready" : "Incomplete"}
                        </span>
                      </td>
                      <td className="db-table-number">
                        {formatMoney(row.vatAmount, row.currency)}
                      </td>
                      <td className="db-table-number">
                        {formatMoney(row.total, row.currency)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="db-table-empty">
                        No VAT records in this period
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="db-card db-vat-calc-card">
            <div className="db-panel-header">
              <div>
                <p className="db-panel-kicker">Tool</p>
                <h2>VAT calculator</h2>
              </div>
              <span className="db-panel-meta">
                <Calculator className="size-3.5" />
                {Math.round(vatRate * 100)}%
              </span>
            </div>
            <div className="db-calc-wrap db-vat-calc-body">
              <div className="db-calc-toggle">
                <button
                  type="button"
                  className={mode === "exclusive" ? "db-calc-toggle-active" : ""}
                  onClick={() => setMode("exclusive")}
                >
                  Add VAT
                </button>
                <button
                  type="button"
                  className={mode === "inclusive" ? "db-calc-toggle-active" : ""}
                  onClick={() => setMode("inclusive")}
                >
                  Extract VAT
                </button>
              </div>
              <label className="db-field">
                Amount
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={`${fieldClass} db-calc-input`}
                />
              </label>
              <div className="db-calc-result">
                <div className="db-info-row">
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotal, currency)}</strong>
                </div>
                <div className="db-info-row">
                  <span>VAT {Math.round(vatRate * 100)}%</span>
                  <strong>{formatMoney(vat, currency)}</strong>
                </div>
                <div className="db-info-row db-info-row-total">
                  <span>Total</span>
                  <strong>{formatMoney(total, currency)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
