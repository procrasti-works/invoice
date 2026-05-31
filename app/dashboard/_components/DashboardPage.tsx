"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  PencilLine,
  ReceiptText,
  Send,
  Users,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type Invoice = Doc<"invoices">;
type InvoiceLineItem = Doc<"invoiceLineItems">;
type InvoiceEvent = Doc<"invoiceEvents">;
type InvoiceStatus = Invoice["status"];
type InvoiceRow = {
  invoice: Invoice;
  events: InvoiceEvent[];
  lineItems: InvoiceLineItem[];
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
};

const statusClasses: Record<InvoiceStatus, string> = {
  draft: "border-[#e5e7eb] bg-white text-[#4b5563]",
  ready: "border-[#b9e7fb] bg-[#eef9fd] text-[#0874a8]",
  sent: "border-[#a8b4ff] bg-[#f1f3ff] text-[#3042a6]",
  viewed: "border-[#d9c7ff] bg-[#f7f1ff] text-[#6833b0]",
  approved: "border-[#bfe8d8] bg-[#ecf8f2] text-[#006545]",
  awaiting_payment: "border-[#f7e09b] bg-[#fff9df] text-[#7d6000]",
  rejected: "border-[#ffc7d1] bg-[#fff0f3] text-[#a51f43]",
  paid: "border-[#bfe8d8] bg-[#ecf8f2] text-[#006545]",
  overdue: "border-[#ffc7d1] bg-[#fff0f3] text-[#a51f43]",
};

function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
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
    invoice.amountTotal ?? invoice.amount ?? 0,
    invoice.currency ?? "USD",
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
  };
}

export function DashboardPage() {
  const invoiceRows = useQuery(api.invoices.list);
  const stats = useQuery(api.invoices.stats);
  const workspace = useQuery(api.invoices.workspace);
  const createDraft = useMutation(api.invoices.createDraft);
  const amendInvoice = useMutation(api.invoices.amend);
  const sendInvoice = useMutation(api.invoices.send);
  const markSent = useMutation(api.invoices.markSent);
  const markPaid = useMutation(api.invoices.markPaid);
  const scheduleReminder = useMutation(api.invoices.scheduleReminder);
  const updateStatus = useMutation(api.invoices.updateStatus);

  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [clientName, setClientName] = useState("Acme Operations");
  const [clientEmail, setClientEmail] = useState("billing@acme.test");
  const [description, setDescription] = useState("Monthly service invoice");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("1250");
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
  const isLoading = invoiceRows === undefined || stats === undefined;

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

  const clients = useMemo(() => {
    const byEmail = new Map<
      string,
      { name: string; email: string; value: number; invoices: number }
    >();

    rows.forEach(({ invoice }) => {
      const email = invoice.clientEmail ?? "no-email";
      const current = byEmail.get(email) ?? {
        name: invoice.clientName ?? invoice.client ?? "Client",
        email,
        value: 0,
        invoices: 0,
      };
      current.value += invoice.amountTotal ?? invoice.amount ?? 0;
      current.invoices += 1;
      byEmail.set(email, current);
    });

    return Array.from(byEmail.values()).slice(0, 6);
  }, [rows]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Client link copied.");
    } catch {
      setNotice(value);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create");
    setNotice(null);
    setClientLink(null);
    setEmailDraft(null);

    const payload = {
      clientName,
      clientEmail,
      dueDate,
      currency: workspace?.defaultCurrency ?? "USD",
      paymentInstructions,
      paymentLink: paymentLink || workspace?.paymentLink || "",
      terms,
      notes,
      lineItems: [
        {
          description,
          quantity: Number(quantity) || 1,
          unitPrice: Number(unitPrice) || 0,
        },
      ],
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

  function handleAmend(row: InvoiceRow) {
    const { invoice, lineItems } = row;
    const firstLineItem = lineItems[0];

    setEditingInvoiceId(invoice._id);
    setClientName(invoice.clientName ?? invoice.client ?? "Client");
    setClientEmail(invoice.clientEmail ?? "");
    setDescription(firstLineItem?.description ?? "Revised invoice item");
    setQuantity(String(firstLineItem?.quantity ?? 1));
    setUnitPrice(String(firstLineItem?.unitPrice ?? invoice.amountTotal ?? invoice.amount ?? 0));
    setDueDate(invoice.dueDate || defaultDueDate());
    setPaymentLink(invoice.paymentLink ?? "");
    setPaymentInstructions(invoice.paymentInstructions ?? "");
    setTerms(invoice.terms ?? "Due on receipt unless otherwise agreed.");
    setNotes(invoice.notes ?? "Updated after client feedback.");
    setNotice(`Amending ${invoice.invoiceNumber}. Save the amendment, then send it again.`);
    setClientLink(null);
    setEmailDraft(null);
    document.getElementById("new-invoice")?.scrollIntoView({ behavior: "smooth" });
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

  return (
    <div className="min-h-0 overflow-y-auto bg-[#f9fafb]">
      <header className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-4 bg-[#f9fafb]/95 px-5 pb-5 pt-6 backdrop-blur sm:px-5">
        <div className="min-w-0">
          <p className="text-[15px] font-normal leading-5 text-[#9ca3af]">
            Invoice pipeline
          </p>
          <h1 className="truncate text-[29px] font-semibold leading-[1.08] text-[#111827]">
            Send, approve, and close client invoices
          </h1>
        </div>
        <Button
          asChild
          className="h-9 shrink-0 bg-[#009b68] px-4 text-[13px] font-semibold text-white hover:bg-[#00875b] hover:text-white"
        >
          <a href="#new-invoice">
            <FileText />
            New Invoice
          </a>
        </Button>
      </header>

      <div className="grid gap-5 px-5 pb-6 sm:px-5 pt-2">
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={WalletCards}
            label="Outstanding"
            value={formatMoney(stats?.totalOutstanding ?? 0)}
            detail={`${stats?.awaitingClientCount ?? 0} with the client`}
            tone="mint"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Paid"
            value={formatMoney(stats?.totalPaid ?? 0)}
            detail={`${stats?.paidCount ?? 0} closed invoices`}
            tone="blue"
          />
          <MetricCard
            icon={Mail}
            label="Active"
            value={String(stats?.invoiceCount ?? 0)}
            detail="Drafts through paid"
            tone="yellow"
          />
          <MetricCard
            icon={Clock3}
            label="Overdue"
            value={String(stats?.overdueCount ?? 0)}
            detail="Needs follow-up"
            tone="pink"
          />
        </section>

        {notice || clientLink ? (
          <section className="flex flex-col gap-2 rounded-lg border border-[#bfe8d8] bg-[#f0fdf4] rounded-2xl p-3 text-sm text-[#006545] sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words">{notice ?? clientLink}</span>
            {clientLink ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-[#bfe8d8] bg-white text-[#006545] hover:bg-[#f3f4f6]"
                  onClick={() => copyText(clientLink)}
                >
                  <Copy />
                  Copy
                </Button>
                {emailDraft ? (
                  <>
                    <Button
                      asChild
                      size="sm"
                      className="h-8 bg-[#009b68] text-white hover:bg-[#00875b]"
                    >
                      <a href={emailDraft.gmailHref} target="_blank" rel="noreferrer">
                        <Mail />
                        Open email
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-8 border-[#bfe8d8] bg-white text-[#006545] hover:bg-[#f3f4f6]"
                    >
                      <a href={emailDraft.mailtoHref}>
                        <Mail />
                        Email app
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 border-[#bfe8d8] bg-white text-[#006545] hover:bg-[#f3f4f6]"
                      onClick={() =>
                        copyText(`${emailDraft.subject}\n\n${emailDraft.body}`)
                      }
                    >
                      <Copy />
                      Copy email
                    </Button>
                  </>
                ) : null}
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 border-[#bfe8d8] bg-white text-[#006545] hover:bg-[#f3f4f6]"
                >
                  <a href={clientLink} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Open
                  </a>
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        <section
          id="new-invoice"
          className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"
        >
          <div className="flex min-h-[76px] flex-col justify-center border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-4 sm:px-5">
              <p className="text-[16px] font-semibold leading-tight text-[#111827]">
                {editingInvoiceId ? "Amend invoice" : "New Invoice"}
              </p>
              <p className="mt-1 max-w-2xl text-[14px] font-normal leading-5 text-[#6b7280]">
                Create the packet, preview it, then prepare an email draft with the secure client link.
              </p>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.72fr)]">
          <form onSubmit={handleCreate} className="grid content-start gap-4 p-5 sm:p-6">

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client name">
                <Input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
              <Field label="Client email">
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(event) => setClientEmail(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_150px]">
              <Field label="Line item">
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
              <Field label="Qty">
                <Input
                  inputMode="decimal"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
              <Field label="Unit price">
                <Input
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Due date">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
              <Field label="Payment link">
                <Input
                  value={paymentLink}
                  onChange={(event) => setPaymentLink(event.target.value)}
                  placeholder="https://pay.example.com/invoice"
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
            </div>

            <Field label="Payment instructions">
              <Input
                value={paymentInstructions}
                onChange={(event) => setPaymentInstructions(event.target.value)}
                placeholder={workspace?.paymentInstructions ?? "Bank transfer or agreed payment method"}
                className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Terms">
                <Input
                  value={terms}
                  onChange={(event) => setTerms(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
              <Field label="Note">
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="h-10 border-[#d7d7d1] bg-white border-[#e5e7eb] px-3 text-[13px] font-normal"
                />
              </Field>
            </div>

            <Button
              type="submit"
              disabled={pendingAction === "create"}
              className="h-10 w-full bg-[#009b68] px-4 text-[13px] font-semibold text-white hover:bg-[#00875b] hover:text-white sm:w-max"
            >
              {pendingAction === "create" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ReceiptText />
              )}
              {editingInvoiceId ? "Save amendment" : "Create draft"}
            </Button>
            {editingInvoiceId ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full border-[#e5e7eb] bg-white sm:w-max hover:bg-[#f3f4f6]"
                onClick={clearAmendment}
              >
                Cancel amendment
              </Button>
            ) : null}
          </form>

          <InvoicePreview
            clientName={clientName}
            clientEmail={clientEmail}
            description={description}
            quantity={Number(quantity) || 0}
            unitPrice={Number(unitPrice) || 0}
            dueDate={dueDate}
            terms={terms}
            notes={notes}
            paymentInstructions={
              paymentInstructions || workspace?.paymentInstructions || "Payment instructions appear here."
            }
            paymentLink={paymentLink || workspace?.paymentLink || ""}
            currency={workspace?.defaultCurrency ?? "USD"}
          />
          </div>
        </section>

        <section
          id="invoices"
          className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm"
        >
          <div className="flex min-h-[76px] flex-col gap-3 border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[16px] font-semibold text-[#111827]">Invoices</p>
              <p className="mt-1 text-[14px] font-normal leading-5 text-[#6b7280]">
                Track the exact client state from draft to paid.
              </p>
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-[#f3f4f6] p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveView(tab.id)}
                  className={cn(
                    "inline-flex min-h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-[#4b5563] transition-colors hover:bg-[#e2e8f0] hover:text-[#111827]",
                    activeView === tab.id &&
                      "bg-[#f7f7f5] text-black ring-1 ring-[#d8d8d2] hover:bg-[#f7f7f5] hover:text-[#111827]",
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      activeView === tab.id
                        ? "bg-[#f3f4f6] text-[#4b5563]"
                        : "bg-[#f4f4f1] text-[#4b5563]",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 rounded-lg bg-[#f9fafb]" />
              ))}
            </div>
          ) : filteredRows.length ? (
            <Table className="text-[13px]">
              <TableHeader className="bg-[#f9fafb]">
                <TableRow className="border-[#f3f4f6] hover:bg-transparent">
                  <TableHead className="h-11 px-5 font-medium text-[#111827]">Invoice</TableHead>
                  <TableHead className="h-11 font-medium text-[#111827]">Client</TableHead>
                  <TableHead className="h-11 font-medium text-[#111827]">State</TableHead>
                  <TableHead className="h-11 font-medium text-[#111827]">Last activity</TableHead>
                  <TableHead className="h-11 font-medium text-right text-[#111827]">Amount</TableHead>
                  <TableHead className="h-11 pr-5 font-medium text-right text-[#111827]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const { invoice, events } = row;

                  return (
                  <TableRow
                    key={invoice._id}
                    className="border-[#e5e7eb] align-top hover:bg-[#f9fafb]"
                  >
                    <TableCell className="px-5 py-4">
                      <div className="font-medium text-[#111827]">
                        {invoice.invoiceNumber}
                      </div>
                      <div className="mt-1 text-[11px] text-[#6b7280]">
                        Due {invoice.dueDate}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="font-medium text-[#111827]">
                        {invoice.clientName ?? invoice.client ?? "Client"}
                      </div>
                      <div className="mt-1 text-[11px] text-[#6b7280]">
                        {invoice.clientEmail ?? "No email"}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant="outline"
                        className={cn("border", statusClasses[invoice.status])}
                      >
                        {statusLabels[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[230px] py-4 text-[#4b5563]">
                      {events[0]?.message ?? "No activity yet."}
                    </TableCell>
                    <TableCell className="py-4 text-right font-medium text-[#111827]">
                      {formatMoney(
                        invoice.amountTotal ?? invoice.amount ?? 0,
                        invoice.currency ?? workspace?.defaultCurrency ?? "USD",
                      )}
                    </TableCell>
                    <TableCell className="py-4 pr-5">
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
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="grid min-h-[270px] place-items-center px-5 py-12 text-center">
              <div>
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f3f4f6] text-[#111827]">
                <FileText className="size-6 stroke-[1.8]" />
              </span>
                <h3 className="mt-5 text-[20px] font-semibold text-[#111827]">
                  No invoices in this view
                </h3>
                <p className="mt-3 text-[16px] text-[#6b7280]">
                  Create one invoice and send the client link from this pipeline.
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section id="clients" className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
            <div className="border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-4">
              <p className="text-[16px] font-semibold text-[#111827]">Clients</p>
              <p className="mt-1 text-[14px] font-normal leading-5 text-[#6b7280]">
                Client records are created from sent invoices so the workflow stays fast.
              </p>
            </div>
            <div className={cn("p-5", clients.length ? "grid gap-3 md:grid-cols-2" : "grid min-h-[260px] place-items-center text-center")}>
              {clients.length ? (
                clients.map((client) => (
                  <article key={client.email} className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm p-4">
                    <p className="truncate text-[14px] font-medium text-[#111827]">
                      {client.name}
                    </p>
                    <p className="mt-1 truncate text-[13px] text-[#6b7280]">{client.email}</p>
                    <p className="mt-4 text-[13px] font-medium text-[#111827]">
                      {formatMoney(client.value)} across {client.invoices} invoice{client.invoices === 1 ? "" : "s"}
                    </p>
                  </article>
                ))
              ) : (
                <div>
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f3f4f6] text-[#111827]">
                    <Users className="size-6 stroke-[1.8]" />
                  </span>
                  <p className="mt-5 text-[20px] font-semibold text-[#111827]">No clients found</p>
                  <p className="mt-3 text-[16px] text-[#6b7280]">Clients appear after the first draft.</p>
                </div>
              )}
            </div>
          </section>

          <section id="reminders" className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
            <div className="border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-4">
              <p className="text-[16px] font-semibold text-[#111827]">Reminders</p>
              <p className="mt-1 text-[14px] font-normal leading-5 text-[#6b7280]">
                Open an email draft with a ready reminder or overdue note. The owner sends it from their email.
              </p>
            </div>
            <div className={cn("p-5", rows.some(({ invoice }) => isClientActive(invoice.status)) ? "grid gap-3" : "grid min-h-[260px] place-items-center text-center")}>
              {rows.filter(({ invoice }) => isClientActive(invoice.status)).slice(0, 5).map(({ invoice }) => (
                <div
                  key={invoice._id}
                  className="flex flex-col gap-2 rounded-2xl border border-[#e5e7eb] bg-white shadow-sm p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-[14px] font-medium text-[#111827]">
                      {invoice.invoiceNumber} - {invoice.clientName ?? invoice.client}
                    </p>
                    <p className="text-[13px] text-[#6b7280]">
                      {statusLabels[invoice.status]} - due {invoice.dueDate}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-[#e5e7eb] bg-white text-xs hover:bg-[#f3f4f6]"
                    onClick={() => handleReminder(invoice)}
                  >
                    <Bell />
                    Email reminder
                  </Button>
                </div>
              ))}
              {!rows.some(({ invoice }) => isClientActive(invoice.status)) ? (
                <div>
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f3f4f6] text-[#111827]">
                    <Bell className="size-6 stroke-[1.8]" />
                  </span>
                  <p className="mt-5 text-[20px] font-semibold text-[#111827]">No reminders found</p>
                  <p className="mt-3 text-[16px] text-[#6b7280]">
                    Active sent invoices will show up here.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-[13px] font-medium text-[#374151]">
      {label}
      {children}
    </label>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "mint",
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  detail: string;
  tone?: "mint" | "blue" | "yellow" | "pink";
}) {
  const toneClasses = {
    mint: "bg-[#bce9d8] text-[#00805a]",
    blue: "bg-[#aee2fb] text-[#0677aa]",
    yellow: "bg-[#ffca32] text-[#7c6500]",
    pink: "bg-[#ff8ea7] text-[#a51f43]",
  }[tone];

  return (
    <article className="h-[172px] overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
      <div className="flex h-[66px] items-center justify-between gap-3 border-b border-[#e5e7eb] bg-[#f9fafb] px-5">
        <p className="text-[15px] font-medium leading-none text-[#4b5563]">{label}</p>
        <span
          className={cn(
            "flex size-[38px] items-center justify-center rounded-[9px]",
            toneClasses,
          )}
        >
          <Icon className="size-4 stroke-[1.9]" />
        </span>
      </div>
      <div className="px-5 pt-6">
        <p className="text-[30px] font-semibold leading-none text-[#111827]">
          {value}
        </p>
        <p className="mt-4 text-[18px] font-normal leading-none text-[#6b7280]">{detail}</p>
      </div>
    </article>
  );
}

function InvoicePreview({
  clientName,
  clientEmail,
  description,
  quantity,
  unitPrice,
  dueDate,
  terms,
  notes,
  paymentInstructions,
  paymentLink,
  currency,
}: {
  clientName: string;
  clientEmail: string;
  description: string;
  quantity: number;
  unitPrice: number;
  dueDate: string;
  terms: string;
  notes: string;
  paymentInstructions: string;
  paymentLink: string;
  currency: string;
}) {
  const total = Math.max(0, quantity) * Math.max(0, unitPrice);

  return (
    <aside className="border-t border-[#e5e7eb] bg-[#f9fafb] p-5 xl:border-l xl:border-t-0">
      <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
        <div className="flex h-[66px] items-center justify-between gap-4 border-b border-[#e5e7eb] bg-[#f9fafb] px-5">
          <div>
            <p className="text-[14px] font-medium text-[#4b5563]">Invoice preview</p>
          </div>
          <Badge variant="outline" className="border-[#bfe8d8] bg-[#ecf8f2] px-3 py-1 text-xs font-semibold text-[#006545]">
            Ready packet
          </Badge>
        </div>

        <div className="p-5">
          <h2 className="text-[28px] font-semibold leading-none text-[#111827]">Invoice</h2>

          <div className="mt-7 grid gap-4 border-y border-[#e5e7eb] py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[#6b7280]">Bill to</p>
            <p className="mt-2 text-[15px] font-medium leading-tight text-[#111827]">{clientName || "Client"}</p>
            <p className="text-xs text-[#6b7280]">{clientEmail || "client@email.com"}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-[#6b7280]">Due</p>
            <p className="mt-2 text-[15px] font-medium leading-tight text-[#111827]">{dueDate}</p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_104px] border-b border-[#e5e7eb] bg-[#f3f4f6] px-4 py-3 text-xs font-semibold text-[#374151]">
            <span>Item</span>
            <span>Qty</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_64px_104px] px-4 py-4 text-sm">
            <span className="min-w-0 truncate">{description || "Invoice item"}</span>
            <span>{quantity || 1}</span>
            <span className="text-right font-medium">{formatMoney(total, currency)}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-[240px]">
            <div className="flex justify-between text-sm text-[#6b7280]">
              <span>Subtotal (excl. VAT)</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-[#6b7280]">
              <span>VAT (15%)</span>
              <span>{formatMoney(total * 0.15, currency)}</span>
            </div>
            <div className="mt-3 flex justify-between border-t border-[#e5e7eb] pt-3 text-[18px] font-semibold leading-none text-[#111827]">
              <span>Total (incl. VAT)</span>
              <span>{formatMoney(total * 1.15, currency)}</span>
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 text-sm leading-6 text-[#374151]">
          <p>
            <span className="font-medium text-[#111827]">Terms:</span> {terms}
          </p>
          <p>
            <span className="font-medium text-[#111827]">Payment:</span>{" "}
            {paymentLink ? "Payment button included." : paymentInstructions}
          </p>
          <p>{notes}</p>
        </div>
        </div>
      </div>
    </aside>
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
  onAmend: (row: InvoiceRow) => void;
  onReminder: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onOverdue: (invoice: Invoice) => void;
}) {
  const sending = pendingAction === `send-${invoice._id}`;
  const markingSent = pendingAction === `mark-sent-${invoice._id}`;
  const reminding = pendingAction === `reminder-${invoice._id}`;
  const paying = pendingAction === `paid-${invoice._id}`;
  const overduing = pendingAction === `overdue-${invoice._id}`;

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {invoice.status === "draft" || invoice.status === "ready" ? (
        <Button
          size="sm"
          className="h-8 bg-[#009b68] text-xs text-white hover:bg-[#00875b] hover:text-white"
          onClick={() => onSend(invoice)}
          disabled={sending}
        >
          {sending ? <Loader2 className="animate-spin" /> : <Mail />}
          Prepare email
        </Button>
      ) : null}
      {invoice.status === "rejected" ? (
        <Button
          size="sm"
          className="h-8 bg-[#009b68] text-xs text-white hover:bg-[#00875b] hover:text-white"
          onClick={() => onAmend(row)}
        >
          <PencilLine />
          Amend
        </Button>
      ) : null}
      {invoice.publicToken ? (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 border-[#e5e7eb] bg-white px-2 text-xs hover:bg-[#f3f4f6]"
        >
          <a href={`/invoice/${invoice.publicToken}`} target="_blank" rel="noreferrer">
            <ExternalLink />
            Client
          </a>
        </Button>
      ) : null}
      {invoice.publicToken && invoice.status !== "paid" ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-[#e5e7eb] bg-white px-2 text-xs hover:bg-[#f3f4f6]"
          onClick={() => onEmail(invoice)}
        >
          <Mail />
          Email
        </Button>
      ) : null}
      {invoice.publicToken &&
      (invoice.status === "ready" || invoice.status === "draft") ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-[#b9e7fb] bg-white px-2 text-xs text-[#0874a8] hover:bg-[#eef9fd]"
          onClick={() => onMarkSent(invoice)}
          disabled={markingSent}
        >
          {markingSent ? <Loader2 className="animate-spin" /> : <Send />}
          Mark sent
        </Button>
      ) : null}
      {isClientActive(invoice.status) ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-[#e5e7eb] bg-white px-2 text-xs hover:bg-[#f3f4f6]"
          onClick={() => onReminder(invoice)}
          disabled={reminding}
        >
          {reminding ? <Loader2 className="animate-spin" /> : <Bell />}
          Remind
        </Button>
      ) : null}
      {isClientActive(invoice.status) ? (
        <Button
          size="sm"
          className="h-8 bg-[#009b68] px-2 text-xs text-white hover:bg-[#00875b]"
          onClick={() => onMarkPaid(invoice)}
          disabled={paying}
        >
          {paying ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Mark paid
        </Button>
      ) : null}
      {(invoice.status === "sent" || invoice.status === "viewed") ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-[#ffc7d1] bg-white px-2 text-xs text-[#a51f43] hover:bg-[#fff0f3]"
          onClick={() => onOverdue(invoice)}
          disabled={overduing}
        >
          {overduing ? <Loader2 className="animate-spin" /> : <Clock3 />}
          Overdue
        </Button>
      ) : null}
    </div>
  );
}
