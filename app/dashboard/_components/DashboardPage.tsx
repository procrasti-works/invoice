"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type Invoice = Doc<"invoices">;
type Client = Doc<"clients">;
type InvoiceLineItem = Doc<"invoiceLineItems">;
type InvoiceEvent = Doc<"invoiceEvents">;
type PaymentProof = Doc<"paymentProofs">;
type InvoiceStatus = Invoice["status"];
type InvoiceRow = {
  invoice: Invoice;
  client: Client | null;
  events: InvoiceEvent[];
  lineItems: InvoiceLineItem[];
  paymentProofs?: PaymentProof[];
};
type PaymentProofRow = {
  proof: PaymentProof;
  invoice: Invoice | null;
};
type DraftLineItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};
type ViewFilter =
  | "all"
  | "drafts"
  | "sent"
  | "approved"
  | "rejected"
  | "overdue"
  | "paid";

type EmailDraft = {
  to: string;
  subject: string;
  body: string;
  gmailHref: string;
  mailtoHref: string;
  whatsappHref: string;
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  awaiting_payment: "Awaiting payment",
  rejected: "Rejected",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const statusToneClasses: Record<InvoiceStatus, string> = {
  draft: "db-status-neutral",
  ready: "db-status-info",
  sent: "db-status-info",
  viewed: "db-status-info",
  approved: "db-status-success",
  awaiting_payment: "db-status-warning",
  rejected: "db-status-danger",
  paid: "db-status-success",
  overdue: "db-status-danger",
  void: "db-status-neutral",
};

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

function defaultDueDate() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    .toISOString()
    .slice(0, 10);
}

function isClientActive(status: InvoiceStatus) {
  return (
    status === "sent" ||
    status === "viewed" ||
    status === "approved" ||
    status === "awaiting_payment" ||
    status === "overdue"
  );
}

function emailHref(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function gmailHref(to: string, subject: string, body: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

function whatsappHref(subject: string, body: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${subject}\n\n${body}`)}`;
}

function invoiceDisplayTotal(invoice: Invoice) {
  return invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function newLineItem(): DraftLineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "0",
  };
}

function buildEmailDraft(invoice: Invoice, invoiceUrl: string, senderName: string) {
  const clientName = invoice.clientName ?? invoice.client ?? "there";
  const subject = `${invoice.invoiceNumber} from ${senderName}`;
  const body = [
    `Hi ${clientName},`,
    "",
    `Please review ${invoice.invoiceNumber} here:`,
    invoiceUrl,
    "",
    "Approve the invoice if everything looks correct. Approval does not mark it paid; payment stays due by the agreed terms.",
    "",
    "Thanks,",
    senderName,
  ].join("\n");

  return {
    to: invoice.clientEmail ?? "",
    subject,
    body,
    gmailHref: gmailHref(invoice.clientEmail ?? "", subject, body),
    mailtoHref: emailHref(invoice.clientEmail ?? "", subject, body),
    whatsappHref: whatsappHref(subject, body),
  };
}

function buildFollowUpDraft(
  invoice: Invoice,
  invoiceUrl: string,
  senderName: string,
  kind: "reminder" | "overdue",
) {
  const clientName = invoice.clientName ?? invoice.client ?? "there";
  const invoiceTotal = formatMoney(
    invoiceDisplayTotal(invoice),
    invoice.currency ?? "NAD",
  );
  const subject =
    kind === "overdue"
      ? `Overdue invoice ${invoice.invoiceNumber}`
      : `Reminder: ${invoice.invoiceNumber}`;
  const body =
    kind === "overdue"
      ? [
          `Hi ${clientName},`,
          "",
          `${invoice.invoiceNumber} for ${invoiceTotal} is now overdue.`,
          `You can review the invoice here: ${invoiceUrl}`,
          "",
          "Please arrange payment or reply if anything needs attention.",
          "",
          "Thanks,",
          senderName,
        ].join("\n")
      : [
          `Hi ${clientName},`,
          "",
          `Just a quick reminder about ${invoice.invoiceNumber} for ${invoiceTotal}, due ${invoice.dueDate}.`,
          `You can review the invoice here: ${invoiceUrl}`,
          "",
          "Please approve it if everything looks correct, or reply with any questions.",
          "",
          "Thanks,",
          senderName,
        ].join("\n");

  return {
    to: invoice.clientEmail ?? "",
    subject,
    body,
    gmailHref: gmailHref(invoice.clientEmail ?? "", subject, body),
    mailtoHref: emailHref(invoice.clientEmail ?? "", subject, body),
    whatsappHref: whatsappHref(subject, body),
  };
}

export function DashboardPage() {
  const convex = useConvex();
  const invoiceRows = useQuery(api.invoices.list);
  const stats = useQuery(api.invoices.stats);
  const workspace = useQuery(api.invoices.workspace);
  const clientRows = useQuery(api.invoices.listClients) as Client[] | undefined;
  const createDraft = useMutation(api.invoices.createDraft);
  const amendInvoice = useMutation(api.invoices.amend);
  const sendInvoice = useMutation(api.invoices.send);
  const markSent = useMutation(api.invoices.markSent);
  const markPaid = useMutation(api.invoices.markPaid);
  const scheduleReminder = useMutation(api.invoices.scheduleReminder);
  const updateStatus = useMutation(api.invoices.updateStatus);
  const proofRows = useQuery(api.invoices.listPaymentProofs, { status: "submitted" });
  const reviewPaymentProof = useMutation(api.invoices.reviewPaymentProof);

  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [draftLineItems, setDraftLineItems] = useState<DraftLineItem[]>([
    {
      id: crypto.randomUUID(),
      description: "Monthly service invoice",
      quantity: "1",
      unitPrice: "1250",
    },
  ]);
  const [taxMode, setTaxMode] = useState<"no_vat" | "vat_15">("no_vat");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [paymentLink, setPaymentLink] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [terms, setTerms] = useState("Due on receipt unless otherwise agreed.");
  const [notes, setNotes] = useState("Thank you for your business.");
  const [editingInvoiceId, setEditingInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [clientLink, setClientLink] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => (invoiceRows ?? []) as InvoiceRow[], [invoiceRows]);
  const activeClients = useMemo(
    () => (clientRows ?? []).filter((client) => client.active ?? true),
    [clientRows],
  );
  const selectedClient = useMemo(
    () => activeClients.find((client) => client._id === selectedClientId) ?? null,
    [activeClients, selectedClientId],
  );
  const pendingProofRows = useMemo(
    () => (proofRows ?? []) as PaymentProofRow[],
    [proofRows],
  );
  const isLoading = invoiceRows === undefined || stats === undefined;
  const vatRegistered = workspace?.vatRegistered ?? false;
  const effectiveTaxMode = vatRegistered ? taxMode : "no_vat";

  const filteredRows = useMemo(() => {
    if (activeView === "drafts") {
      return rows.filter(({ invoice }) =>
        invoice.status === "draft" || invoice.status === "ready",
      );
    }

    if (activeView === "sent") {
      return rows.filter(({ invoice }) =>
        invoice.status === "sent" || invoice.status === "viewed",
      );
    }

    if (activeView === "approved") {
      return rows.filter(({ invoice }) =>
        invoice.status === "approved" ||
        invoice.status === "awaiting_payment",
      );
    }

    if (activeView === "rejected") {
      return rows.filter(({ invoice }) => invoice.status === "rejected");
    }

    if (activeView === "overdue") {
      return rows.filter(({ invoice }) => invoice.status === "overdue");
    }

    if (activeView === "paid") {
      return rows.filter(({ invoice }) => invoice.status === "paid");
    }

    return rows;
  }, [activeView, rows]);

  const tabs: { id: ViewFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: rows.length },
    {
      id: "drafts",
      label: "Drafts",
      count: rows.filter(({ invoice }) =>
        invoice.status === "draft" || invoice.status === "ready",
      ).length,
    },
    {
      id: "sent",
      label: "Sent",
      count: rows.filter(({ invoice }) =>
        invoice.status === "sent" || invoice.status === "viewed",
      ).length,
    },
    {
      id: "approved",
      label: "Approved",
      count: rows.filter(({ invoice }) =>
        invoice.status === "approved" ||
        invoice.status === "awaiting_payment",
      ).length,
    },
    {
      id: "rejected",
      label: "Rejected",
      count: rows.filter(({ invoice }) => invoice.status === "rejected").length,
    },
    { id: "overdue", label: "Overdue", count: stats?.overdueCount ?? 0 },
    { id: "paid", label: "Paid", count: stats?.paidCount ?? 0 },
  ];

  const clientSummaries = useMemo(() => {
    const statsByClient = new Map<string, { value: number; invoices: number }>();

    rows.forEach(({ invoice }) => {
      const keys = [
        invoice.clientId,
        invoice.clientEmail?.toLowerCase(),
        invoice.clientName?.toLowerCase(),
      ].filter(Boolean) as string[];

      keys.forEach((key) => {
        const current = statsByClient.get(key) ?? { value: 0, invoices: 0 };
        current.value += invoiceDisplayTotal(invoice);
        current.invoices += 1;
        statsByClient.set(key, current);
      });
    });

    return activeClients.slice(0, 6).map((client) => {
      const stats =
        statsByClient.get(client._id) ??
        statsByClient.get(client.email.toLowerCase()) ??
        statsByClient.get(client.name.toLowerCase()) ??
        { value: 0, invoices: 0 };

      return { client, ...stats };
    });
  }, [activeClients, rows]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Client link copied.");
    } catch {
      setNotice(value);
    }
  }

  function updateDraftLineItem(id: string, patch: Partial<DraftLineItem>) {
    setDraftLineItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addDraftLineItem() {
    setDraftLineItems((current) => [...current, newLineItem()]);
  }

  function removeDraftLineItem(id: string) {
    setDraftLineItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id),
    );
  }

  function applySelectedClient(clientId: string) {
    if (!clientId) {
      setSelectedClientId(null);
      return;
    }

    const client = activeClients.find((item) => item._id === clientId);

    if (!client) {
      return;
    }

    setSelectedClientId(client._id);
    setClientName(client.name);
    setClientEmail(client.email);
    setClientPhone(client.phone ?? "");
    setClientAddress(client.address ?? "");

    if (client.paymentTerms) {
      setTerms(client.paymentTerms);
    }
  }

  async function handleReviewProof(proofId: Id<"paymentProofs">, status: "accepted" | "rejected") {
    setPendingAction(`proof-${proofId}-${status}`);
    setNotice(null);

    try {
      await reviewPaymentProof({ proofId, status });
      setNotice(status === "accepted" ? "Payment proof accepted." : "Payment proof rejected.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to review proof.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create");
    setNotice(null);
    setClientLink(null);
    setEmailDraft(null);

    const payload = {
      clientId: selectedClientId ?? undefined,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientVatNumber: selectedClient?.vatNumber ?? undefined,
      clientTaxId: selectedClient?.taxId ?? undefined,
      dueDate,
      currency: workspace?.defaultCurrency ?? "NAD",
      taxMode: effectiveTaxMode,
      paymentInstructions,
      paymentLink: paymentLink || workspace?.paymentLink || "",
      terms,
      notes,
      lineItems: draftLineItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      })),
    };

    try {
      if (editingInvoiceId) {
        await amendInvoice({ id: editingInvoiceId, ...payload });
        setEditingInvoiceId(null);
        setNotice("Amendment saved. Send the revised invoice back to the client.");
      } else {
        await createDraft(payload);
        setNotice("Draft created. Send it when the preview looks right.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create draft.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAmend(row: InvoiceRow) {
    setPendingAction(`amend-${row.invoice._id}`);
    setNotice(null);

    try {
      const details = row.lineItems.length
        ? row
        : await convex.query(api.invoices.getEditDetails, { id: row.invoice._id });
      const { invoice, lineItems, client } = details;

      setEditingInvoiceId(invoice._id);
      setSelectedClientId(invoice.clientId ?? client?._id ?? null);
      setClientName(invoice.clientName ?? invoice.client ?? "Client");
      setClientEmail(invoice.clientEmail ?? "");
      setClientPhone(invoice.clientSnapshot?.phone ?? "");
      setClientAddress(invoice.clientSnapshot?.address ?? "");
      setDraftLineItems(
        lineItems.length
          ? lineItems.map((item) => ({
              id: item._id,
              description: item.description,
              quantity: String(item.quantity ?? 1),
              unitPrice: String(item.unitPrice ?? 0),
            }))
          : [
              {
                id: crypto.randomUUID(),
                description: "Revised invoice item",
                quantity: "1",
                unitPrice: String(invoice.subtotal ?? invoiceDisplayTotal(invoice)),
              },
            ],
      );
      setTaxMode(invoice.taxMode === "vat_15" ? "vat_15" : "no_vat");
      setDueDate(invoice.dueDate || defaultDueDate());
      setPaymentLink(invoice.paymentLink ?? "");
      setPaymentInstructions(invoice.paymentInstructions ?? "");
      setTerms(invoice.terms ?? "Due on receipt unless otherwise agreed.");
      setNotes(invoice.notes ?? "Updated after client feedback.");
      setNotice(`Amending ${invoice.invoiceNumber}. Save the amendment, then send it again.`);
      setClientLink(null);
      setEmailDraft(null);
      document.getElementById("new-invoice")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load invoice details.");
    } finally {
      setPendingAction(null);
    }
  }

  function clearAmendment() {
    setEditingInvoiceId(null);
    setNotice(null);
  }

  function openEmailTemplate(invoice: Invoice) {
    if (!invoice.publicToken) {
      setNotice("Prepare the email first to create a client link.");
      return;
    }

    const link = `${window.location.origin}/invoice/${invoice.publicToken}`;
    const draft = buildEmailDraft(
      invoice,
      link,
      workspace?.name ?? "Invoice Ledger",
    );
    setClientLink(link);
    setEmailDraft(draft);
    window.open(draft.gmailHref, "_blank");
    setNotice("Email composer opened. After you send it, mark the invoice sent.");
  }

  async function handleSend(invoice: Invoice) {
    setPendingAction(`send-${invoice._id}`);
    setNotice(null);
    setEmailDraft(null);
    const emailWindow = window.open("", "_blank");

    try {
      const result = await sendInvoice({ id: invoice._id });
      const link = `${window.location.origin}${result.urlPath}`;
      const draft = buildEmailDraft(
        invoice,
        link,
        workspace?.name ?? "Invoice Ledger",
      );
      setClientLink(link);
      setEmailDraft(draft);
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // Opening the email template still works if the browser blocks clipboard access.
      }
      if (emailWindow) {
        emailWindow.location.href = draft.gmailHref;
      }
      setNotice("Email composer opened. After you send it, mark the invoice sent.");
    } catch (error) {
      emailWindow?.close();
      setNotice(error instanceof Error ? error.message : "Unable to send invoice.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMarkSent(invoice: Invoice) {
    setPendingAction(`mark-sent-${invoice._id}`);
    setNotice(null);

    try {
      await markSent({ id: invoice._id });
      setNotice(`${invoice.invoiceNumber} marked sent.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to mark sent.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleMarkPaid(invoice: Invoice) {
    setPendingAction(`paid-${invoice._id}`);
    setNotice(null);

    try {
      await markPaid({ id: invoice._id });
      setNotice(`${invoice.invoiceNumber} marked paid.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to mark paid.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReminder(invoice: Invoice) {
    setPendingAction(`reminder-${invoice._id}`);
    setNotice(null);
    setEmailDraft(null);

    if (!invoice.publicToken) {
      setNotice("Prepare the invoice email first so the reminder has a client link.");
      setPendingAction(null);
      return;
    }

    const emailWindow = window.open("", "_blank");

    try {
      const link = `${window.location.origin}/invoice/${invoice.publicToken}`;
      const draft = buildFollowUpDraft(
        invoice,
        link,
        workspace?.name ?? "Invoice Ledger",
        "reminder",
      );
      await scheduleReminder({
        id: invoice._id,
        message: `Reminder email prepared for ${invoice.clientName ?? invoice.client ?? "client"}.`,
      });
      setClientLink(link);
      setEmailDraft(draft);
      if (emailWindow) {
        emailWindow.location.href = draft.gmailHref;
      }
      setNotice("Reminder email opened. Send it from your business email.");
    } catch (error) {
      emailWindow?.close();
      setNotice(error instanceof Error ? error.message : "Unable to schedule reminder.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleOverdue(invoice: Invoice) {
    setPendingAction(`overdue-${invoice._id}`);
    setNotice(null);
    setEmailDraft(null);

    if (!invoice.publicToken) {
      setNotice("Prepare the invoice email first so the overdue notice has a client link.");
      setPendingAction(null);
      return;
    }

    const emailWindow = window.open("", "_blank");

    try {
      const link = `${window.location.origin}/invoice/${invoice.publicToken}`;
      const draft = buildFollowUpDraft(
        invoice,
        link,
        workspace?.name ?? "Invoice Ledger",
        "overdue",
      );
      await updateStatus({ id: invoice._id, status: "overdue" });
      setClientLink(link);
      setEmailDraft(draft);
      if (emailWindow) {
        emailWindow.location.href = draft.gmailHref;
      }
      setNotice(`${invoice.invoiceNumber} marked overdue. Overdue email opened.`);
    } catch (error) {
      emailWindow?.close();
      setNotice(error instanceof Error ? error.message : "Unable to update status.");
    } finally {
      setPendingAction(null);
    }
  }

  const dashboardMetrics = [
    {
      label: "Outstanding",
      value: formatMoney(stats?.totalOutstanding ?? 0),
      detail: `${stats?.awaitingClientCount ?? 0} with client`,
    },
    {
      label: "Paid",
      value: formatMoney(stats?.totalPaid ?? 0),
      detail: `${stats?.paidCount ?? 0} closed`,
    },
    {
      label: "Active",
      value: String(stats?.invoiceCount ?? 0),
      detail: "Drafts to paid",
    },
    {
      label: "Overdue",
      value: String(stats?.overdueCount ?? 0),
      detail: "Needs follow-up",
    },
  ];

  return (
    <div className="db-page db-dashboard-page">
      <section className="db-workview">
        <div className="db-workview-head">
          <div>
            <p className="db-breadcrumb">Payvio <span>/</span> Invoices</p>
            <h1 className="db-workview-title">Invoices</h1>
          </div>
          <a href="#new-invoice" className="db-primary-btn db-new-invoice-btn">
            New invoice
          </a>
        </div>

        <div className="db-metric-strip" aria-label="Invoice metrics">
          {dashboardMetrics.map((metric) => (
            <div key={metric.label} className="db-metric-cell">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          ))}
        </div>

      {notice || clientLink ? (
        <div className="db-notice db-notice-clean">
          <span>{notice ?? clientLink}</span>
          {clientLink && (
            <div className="db-notice-actions">
              <button type="button" className="db-outline-btn" onClick={() => copyText(clientLink)}>
                Copy link
              </button>
              {emailDraft && (
                <>
                  <a href={emailDraft.gmailHref} target="_blank" rel="noreferrer" className="db-primary-btn">
                    Open email
                  </a>
                  <a href={emailDraft.mailtoHref} className="db-outline-btn">
                    Email app
                  </a>
                  <a href={emailDraft.whatsappHref} target="_blank" rel="noreferrer" className="db-outline-btn">
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    className="db-outline-btn"
                    onClick={() => copyText(`${emailDraft.subject}\n\n${emailDraft.body}`)}
                  >
                    Copy email
                  </button>
                </>
              )}
              <a href={clientLink} target="_blank" rel="noreferrer" className="db-outline-btn">
                Open
              </a>
            </div>
          )}
        </div>
      ) : null}

      {pendingProofRows.length ? (
        <PaymentProofQueue
          rows={pendingProofRows}
          currency={workspace?.defaultCurrency ?? "NAD"}
          pendingAction={pendingAction}
          onReview={handleReviewProof}
        />
      ) : null}

      <section className="db-card db-compose-card" id="new-invoice">
        <div className="db-panel-header">
          <div>
            <p className="db-panel-kicker">Compose</p>
            <h2>{editingInvoiceId ? "Amend invoice" : "New invoice"}</h2>
          </div>
          <span className="db-panel-meta">{workspace?.defaultCurrency ?? "NAD"}</span>
        </div>

        <div className="db-compose-grid">
          <form onSubmit={handleCreate} className="db-compose-form">
            <Field label="Onboarded client">
              <select
                value={selectedClientId ?? ""}
                onChange={(event) => applySelectedClient(event.target.value)}
                className="db-field-input"
              >
                <option value="">
                  {activeClients.length ? "Manual client" : "No saved clients yet"}
                </option>
                {activeClients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.name}
                    {client.businessName || client.company
                      ? ` - ${client.businessName ?? client.company}`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
            {selectedClient ? (
              <p className="text-[12px] text-[#6b7280]">
                Using saved details for {selectedClient.name}.
              </p>
            ) : null}

            <div className="db-form-grid db-form-grid-2">
              <Field label="Client name">
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="db-field-input" />
              </Field>
              <Field label="Client email">
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="db-field-input" />
              </Field>
            </div>

            <div className="db-form-grid db-form-grid-2">
              <Field label="Client phone / WhatsApp">
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="db-field-input" />
              </Field>
              <Field label="Client address">
                <Input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="db-field-input" />
              </Field>
            </div>

            <div className="db-line-items">
              <div className="db-line-items-head">
                <span>Line items</span>
                <button type="button" className="db-link-btn" onClick={addDraftLineItem}>
                  Add line
                </button>
              </div>
              {draftLineItems.map((item, index) => (
                <div key={item.id} className="db-line-item-row">
                  <Field label={index === 0 ? "Description" : "Item"}>
                    <Input value={item.description} onChange={(e) => updateDraftLineItem(item.id, { description: e.target.value })} className="db-field-input" />
                  </Field>
                  <Field label="Qty">
                    <Input inputMode="decimal" value={item.quantity} onChange={(e) => updateDraftLineItem(item.id, { quantity: e.target.value })} className="db-field-input" />
                  </Field>
                  <Field label="Unit price">
                    <Input inputMode="decimal" value={item.unitPrice} onChange={(e) => updateDraftLineItem(item.id, { unitPrice: e.target.value })} className="db-field-input" />
                  </Field>
                  <button
                    type="button"
                    className="db-remove-line"
                    onClick={() => removeDraftLineItem(item.id)}
                    disabled={draftLineItems.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="db-form-grid db-form-grid-3">
              <Field label="Due date">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="db-field-input" />
              </Field>
              <Field label="VAT">
                <select
                  value={effectiveTaxMode}
                  disabled={!vatRegistered}
                  onChange={(event) => setTaxMode(event.target.value === "vat_15" ? "vat_15" : "no_vat")}
                  className="db-field-input"
                >
                  <option value="no_vat">No VAT</option>
                  <option value="vat_15">VAT 15%</option>
                </select>
              </Field>
              <Field label="Payment link">
                <Input value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://pay.example.com/invoice" className="db-field-input" />
              </Field>
            </div>

            <Field label="Payment instructions">
              <Input value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} placeholder={workspace?.paymentInstructions ?? "Bank transfer or agreed method"} className="db-field-input" />
            </Field>

            <div className="db-form-grid db-form-grid-2">
              <Field label="Terms">
                <Input value={terms} onChange={(e) => setTerms(e.target.value)} className="db-field-input" />
              </Field>
              <Field label="Note">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="db-field-input" />
              </Field>
            </div>

            <div className="db-form-actions">
              <button type="submit" disabled={pendingAction === "create"} className="db-primary-btn">
                {pendingAction === "create" ? <Loader2 className="size-4 animate-spin" /> : null}
                {editingInvoiceId ? "Save amendment" : "Create draft"}
              </button>
              {editingInvoiceId && (
                <button type="button" className="db-outline-btn" onClick={clearAmendment}>
                  Cancel amendment
                </button>
              )}
            </div>
          </form>

          <InvoicePreview
            clientName={clientName}
            clientEmail={clientEmail}
            lineItems={draftLineItems}
            taxMode={effectiveTaxMode}
            dueDate={dueDate}
            terms={terms}
            notes={notes}
            paymentInstructions={paymentInstructions || workspace?.paymentInstructions || "Payment instructions appear here."}
            paymentLink={paymentLink || workspace?.paymentLink || ""}
            currency={workspace?.defaultCurrency ?? "NAD"}
          />
        </div>
      </section>

      <section className="db-card db-list-card" id="invoices">
        <div className="db-list-toolbar">
          <div>
            <p className="db-panel-kicker">Pipeline</p>
            <h2>Invoices</h2>
          </div>
          <div className="db-tabs" role="tablist" aria-label="Invoice views">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`db-tab${activeView === tab.id ? " db-tab-active" : ""}`}
              >
                {tab.label}
                <span className="db-tab-count">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="db-skeleton-list" aria-label="Loading invoices">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : filteredRows.length ? (
          <div className="db-table-wrap">
            <table className="db-table db-invoice-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Last activity</th>
                  <th className="db-align-right">Amount</th>
                  <th className="db-align-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const { invoice, events, paymentProofs } = row;
                  const pendingProofCount = (paymentProofs ?? []).filter((proof) => proof.status === "submitted").length;

                  return (
                    <tr key={invoice._id}>
                      <td>
                        <span className="db-inv-num">{invoice.invoiceNumber}</span>
                        <span className="db-row-meta">Due {invoice.dueDate}</span>
                      </td>
                      <td>
                        <span className="db-row-primary">{invoice.clientName ?? invoice.client ?? "Client"}</span>
                        <span className="db-row-meta">{invoice.clientEmail ?? "No email"}</span>
                      </td>
                      <td>
                        <Badge variant="outline" className={`db-status-badge ${statusToneClasses[invoice.status]}`}>
                          <span aria-hidden="true" />
                          {statusLabels[invoice.status]}
                        </Badge>
                        {pendingProofCount ? (
                          <span className="db-row-warning">{pendingProofCount} proof pending</span>
                        ) : null}
                      </td>
                      <td className="db-activity-cell">{events[0]?.message ?? "No activity yet."}</td>
                      <td className="db-align-right db-money-cell">
                        {formatMoney(invoiceDisplayTotal(invoice), invoice.currency ?? workspace?.defaultCurrency ?? "NAD")}
                      </td>
                      <td className="db-align-right">
                        <InvoiceActions
                          invoice={invoice}
                          row={row}
                          pendingAction={pendingAction}
                          onSend={handleSend}
                          onEmail={openEmailTemplate}
                          onMarkSent={handleMarkSent}
                          onAmend={handleAmend}
                          onReminder={handleReminder}
                          onMarkPaid={handleMarkPaid}
                          onOverdue={handleOverdue}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="db-empty db-empty-plain">
            <h3>No invoices in this view</h3>
            <p>Create an invoice above and send the secure client link from this pipeline.</p>
          </div>
        )}
      </section>

      <div className="db-split-grid db-dashboard-lower">
        <section className="db-card" id="clients">
          <div className="db-panel-header db-panel-header-small">
            <h2>Clients</h2>
          </div>
          {clientRows === undefined ? (
            <div className="db-empty db-empty-plain db-empty-small">
              <p>Loading clients.</p>
            </div>
          ) : clientSummaries.length ? (
            <div className="db-mini-grid">
              {clientSummaries.map((summary) => {
                const client = {
                  ...summary.client,
                  value: summary.value,
                  invoices: summary.invoices,
                };

                return (
                <div key={client._id} className="db-client-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.88rem", color: "#111827" }}>{client.name}</p>
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{client.email || "No email"}</p>
                  <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111827", marginTop: "4px" }}>{formatMoney(client.value)} - {client.invoices} inv.</p>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="db-empty db-empty-plain db-empty-small">
              <p>No clients saved yet.</p>
              <Link href="/dashboard/clients" className="db-outline-btn">
                Add client
              </Link>
            </div>
          )}
        </section>

        <section className="db-card" id="reminders">
          <div className="db-panel-header db-panel-header-small">
            <h2>Reminders</h2>
          </div>
          {rows.some(({ invoice }) => isClientActive(invoice.status)) ? (
            <div className="db-reminder-list">
              {rows.filter(({ invoice }) => isClientActive(invoice.status)).slice(0, 4).map(({ invoice }) => (
                <div key={invoice._id} className="db-reminder-item">
                  <div>
                    <p className="db-reminder-inv">{invoice.invoiceNumber} — {invoice.clientName ?? invoice.client}</p>
                    <p className="db-reminder-meta">{statusLabels[invoice.status]} · due {invoice.dueDate}</p>
                  </div>
                  <button type="button" className="db-reminder-btn" onClick={() => handleReminder(invoice)}>
                    Remind
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="db-empty db-empty-plain db-empty-small">
              <p>Active sent invoices will show up here.</p>
            </div>
          )}
        </section>
      </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="db-field">
      {label}
      {children}
    </label>
  );
}

function InvoicePreview({
  clientName,
  clientEmail,
  lineItems,
  taxMode,
  dueDate,
  terms,
  notes,
  paymentInstructions,
  paymentLink,
  currency,
}: {
  clientName: string;
  clientEmail: string;
  lineItems: DraftLineItem[];
  taxMode: "no_vat" | "vat_15";
  dueDate: string;
  terms: string;
  notes: string;
  paymentInstructions: string;
  paymentLink: string;
  currency: string;
}) {
  const subtotal = lineItems.reduce(
    (total, item) =>
      total + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0),
    0,
  );
  const vatAmount = taxMode === "vat_15" ? subtotal * 0.15 : 0;
  const total = subtotal + vatAmount;

  return (
    <aside className="db-preview-panel">
      <div className="db-preview-top">
        <p>Invoice preview</p>
        <Badge variant="outline" className="db-status-badge db-status-success">
          <span aria-hidden="true" />
          Ready packet
        </Badge>
      </div>

      <div className="db-preview-body">
        <h2>Invoice</h2>

        <div className="db-preview-meta">
          <div>
            <span>Bill to</span>
            <strong>{clientName || "Client"}</strong>
            <small>{clientEmail || "client@email.com"}</small>
          </div>
          <div>
            <span>Due</span>
            <strong>{dueDate}</strong>
          </div>
        </div>

        <div className="db-preview-lines">
          <div className="db-preview-lines-head">
            <span>Item</span>
            <span>Qty</span>
            <span>Amount</span>
          </div>
          {lineItems.map((item) => {
            const lineTotal = Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0);

            return (
              <div key={item.id} className="db-preview-line">
                <span>{item.description || "Invoice item"}</span>
                <span>{item.quantity || "1"}</span>
                <span>{formatMoney(lineTotal, currency)}</span>
              </div>
            );
          })}
        </div>

        <div className="db-preview-total">
          <div>
            <span>Subtotal (excl. VAT)</span>
            <strong>{formatMoney(subtotal, currency)}</strong>
          </div>
          <div>
            <span>{taxMode === "vat_15" ? "VAT (15%)" : "VAT"}</span>
            <strong>{formatMoney(vatAmount, currency)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatMoney(total, currency)}</strong>
          </div>
        </div>

        <div className="db-preview-notes">
          <p><strong>Terms:</strong> {terms}</p>
          <p><strong>Payment:</strong> {paymentLink ? "Payment button included." : paymentInstructions}</p>
          <p>{notes}</p>
        </div>
      </div>
    </aside>
  );
}

function PaymentProofQueue({
  rows,
  currency,
  pendingAction,
  onReview,
}: {
  rows: PaymentProofRow[];
  currency: string;
  pendingAction: string | null;
  onReview: (proofId: Id<"paymentProofs">, status: "accepted" | "rejected") => void;
}) {
  return (
    <div className="db-card db-proof-card">
      <div className="db-panel-header db-panel-header-small">
        <h2>Proofs to review</h2>
      </div>
      <div className="db-proof-list">
        {rows.slice(0, 5).map(({ proof, invoice }) => (
          <div key={proof._id} className="db-proof-row">
            <div>
              <p className="db-proof-title">
                {invoice?.invoiceNumber ?? "Invoice"} - {proof.payerName}
              </p>
              <p className="db-proof-meta">
                {formatMoney(proof.amount, proof.currency ?? currency)} paid on {proof.paymentDate}
                {proof.bankReference ? ` - Ref ${proof.bankReference}` : ""}
              </p>
            </div>
            <div className="db-proof-actions">
              <button
                type="button"
                className="db-primary-btn"
                disabled={pendingAction === `proof-${proof._id}-accepted`}
                onClick={() => onReview(proof._id, "accepted")}
              >
                {pendingAction === `proof-${proof._id}-accepted` ? <Loader2 className="size-3 animate-spin" /> : null}
                Accept
              </button>
              <button
                type="button"
                className="db-outline-btn"
                disabled={pendingAction === `proof-${proof._id}-rejected`}
                onClick={() => onReview(proof._id, "rejected")}
              >
                {pendingAction === `proof-${proof._id}-rejected` ? <Loader2 className="size-3 animate-spin" /> : null}
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceActions({
  invoice,
  row,
  pendingAction,
  onSend,
  onEmail,
  onMarkSent,
  onAmend,
  onReminder,
  onMarkPaid,
  onOverdue,
}: {
  invoice: Invoice;
  row: InvoiceRow;
  pendingAction: string | null;
  onSend: (invoice: Invoice) => void;
  onEmail: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onAmend: (row: InvoiceRow) => void | Promise<void>;
  onReminder: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onOverdue: (invoice: Invoice) => void;
}) {
  const sending = pendingAction === `send-${invoice._id}`;
  const markingSent = pendingAction === `mark-sent-${invoice._id}`;
  const reminding = pendingAction === `reminder-${invoice._id}`;
  const paying = pendingAction === `paid-${invoice._id}`;
  const overduing = pendingAction === `overdue-${invoice._id}`;
  const amending = pendingAction === `amend-${invoice._id}`;

  return (
    <div className="db-action-row">
      {invoice.status === "draft" || invoice.status === "ready" ? (
        <Button
          size="sm"
          className="db-action-primary"
          onClick={() => onSend(invoice)}
          disabled={sending}
        >
          {sending ? <Loader2 className="size-3 animate-spin" /> : null}
          Prepare email
        </Button>
      ) : null}
      {invoice.status === "rejected" ? (
        <Button
          size="sm"
          className="db-action-primary"
          onClick={() => onAmend(row)}
          disabled={amending}
        >
          {amending ? <Loader2 className="size-3 animate-spin" /> : null}
          Amend
        </Button>
      ) : null}
      {invoice.publicToken ? (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="db-action-secondary"
        >
          <a href={`/invoice/${invoice.publicToken}`} target="_blank" rel="noreferrer">
            Client
          </a>
        </Button>
      ) : null}
      {invoice.publicToken && invoice.status !== "paid" ? (
        <Button
          size="sm"
          variant="outline"
          className="db-action-secondary"
          onClick={() => onEmail(invoice)}
        >
          Email
        </Button>
      ) : null}
      {invoice.publicToken &&
      (invoice.status === "ready" || invoice.status === "draft") ? (
        <Button
          size="sm"
          variant="outline"
          className="db-action-secondary"
          onClick={() => onMarkSent(invoice)}
          disabled={markingSent}
        >
          {markingSent ? <Loader2 className="size-3 animate-spin" /> : null}
          Mark sent
        </Button>
      ) : null}
      {isClientActive(invoice.status) ? (
        <Button
          size="sm"
          variant="outline"
          className="db-action-secondary"
          onClick={() => onReminder(invoice)}
          disabled={reminding}
        >
          {reminding ? <Loader2 className="size-3 animate-spin" /> : null}
          Remind
        </Button>
      ) : null}
      {isClientActive(invoice.status) ? (
        <Button
          size="sm"
          className="db-action-primary"
          onClick={() => onMarkPaid(invoice)}
          disabled={paying}
        >
          {paying ? <Loader2 className="size-3 animate-spin" /> : null}
          Mark paid
        </Button>
      ) : null}
      {(invoice.status === "sent" || invoice.status === "viewed") ? (
        <Button
          size="sm"
          variant="outline"
          className="db-action-danger"
          onClick={() => onOverdue(invoice)}
          disabled={overduing}
        >
          {overduing ? <Loader2 className="size-3 animate-spin" /> : null}
          Overdue
        </Button>
      ) : null}
    </div>
  );
}
