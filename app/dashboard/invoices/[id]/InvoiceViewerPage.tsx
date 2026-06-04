"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  ReceiptText,
  Send,
  Trash2,
  UserRound,
  WalletCards,
  XCircle,
} from "@/app/_components/IconPack";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Invoice = Doc<"invoices">;
type InvoiceStatus = Invoice["status"];
type InvoiceLine = Doc<"invoiceLineItems"> | Doc<"invoiceSnapshotLineItems">;
type PaymentProof = Doc<"paymentProofs">;

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

function taxModeLabel(value?: string) {
  const labels: Record<string, string> = {
    no_vat: "No VAT",
    vat_15: "VAT 15%",
    zero_rated: "Zero-rated",
    exempt: "Exempt",
  };

  return value ? labels[value] ?? value : "VAT";
}

function formatMoney(amount: number, currency = "NAD") {
  try {
    return new Intl.NumberFormat("en-NA", {
      currency,
      maximumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function invoiceTotal(invoice: Invoice) {
  return invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function invoiceBalance(invoice: Invoice) {
  return invoice.balanceDue ?? (invoice.status === "paid" ? 0 : invoiceTotal(invoice));
}

function formatDate(value?: string, fallbackTime?: number) {
  const date = value
    ? new Date(`${value}T00:00:00`)
    : fallbackTime
      ? new Date(fallbackTime)
      : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function gmailDraftHref(to: string, subject: string, body: string) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildClientEmailDraft({
  invoiceNumber,
  clientEmail,
  clientName,
  publicHref,
  workspaceName,
}: {
  invoiceNumber: string;
  clientEmail: string;
  clientName: string;
  publicHref: string;
  workspaceName: string;
}) {
  const subject = `${invoiceNumber} from ${workspaceName}`;
  const body = [
    `Hi ${clientName || "there"},`,
    "",
    `Please review ${invoiceNumber}:`,
    publicHref,
    "",
    "Thanks,",
    workspaceName,
  ].join("\n");

  return gmailDraftHref(clientEmail, subject, body);
}

function buildReminderEmailDraft({
  amountDue,
  clientEmail,
  clientName,
  dueDate,
  invoiceNumber,
  isOverdue,
  publicHref,
  workspaceName,
}: {
  amountDue: string;
  clientEmail: string;
  clientName: string;
  dueDate: string;
  invoiceNumber: string;
  isOverdue: boolean;
  publicHref: string;
  workspaceName: string;
}) {
  const subject = isOverdue ? `Overdue invoice ${invoiceNumber}` : `Reminder: ${invoiceNumber}`;
  const body = isOverdue
    ? [
        `Hi ${clientName || "there"},`,
        "",
        `${invoiceNumber} for ${amountDue} is now overdue.`,
        `You can review it here: ${publicHref}`,
        "",
        "Please arrange payment or reply if anything needs attention.",
        "",
        "Thanks,",
        workspaceName,
      ].join("\n")
    : [
        `Hi ${clientName || "there"},`,
        "",
        `Reminder for ${invoiceNumber} for ${amountDue}, due ${dueDate}.`,
        `You can review it here: ${publicHref}`,
        "",
        "Please approve it or reply with any questions.",
        "",
        "Thanks,",
        workspaceName,
      ].join("\n");

  return gmailDraftHref(clientEmail, subject, body);
}

export function InvoiceViewerPage({ invoiceId }: { invoiceId: string }) {
  const data = useQuery(api.invoices.getDetails, { id: invoiceId as Id<"invoices"> });
  const sendInvoice = useMutation(api.invoices.send);
  const markSent = useMutation(api.invoices.markSent);
  const markPaid = useMutation(api.invoices.markPaid);
  const scheduleReminder = useMutation(api.invoices.scheduleReminder);
  const voidInvoice = useMutation(api.invoices.voidInvoice);
  const reviewPaymentProof = useMutation(api.invoices.reviewPaymentProof);
  const [pendingAction, setPendingAction] = useState("");
  const [notice, setNotice] = useState("");

  const invoice = data?.invoice;
  const organization = data?.organization;
  const snapshot = data?.snapshot;
  const client = data?.client;
  const lineItems: InvoiceLine[] = data?.snapshotLineItems.length ? data.snapshotLineItems : data?.lineItems ?? [];
  const pendingProof = data?.paymentProofs.find((proof) => proof.status === "submitted") ?? null;

  async function runAction(action: string, callback: () => Promise<unknown>, message: string) {
    setPendingAction(action);
    setNotice("");

    try {
      await callback();
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setPendingAction("");
    }
  }

  async function copyClientLink(path: string) {
    const url = `${window.location.origin}${path}`;

    try {
      await navigator.clipboard.writeText(url);
      setNotice("Client link copied.");
    } catch {
      setNotice(url);
    }
  }

  async function prepareClientLink(currentInvoice: Invoice) {
    await runAction(
      `send-${currentInvoice._id}`,
      async () => {
        const result = await sendInvoice({ id: currentInvoice._id });
        await copyClientLink(result.urlPath);
      },
      "Client link prepared.",
    );
  }

  if (data === undefined) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading invoice
        </div>
      </div>
    );
  }

  if (data === null || !invoice || !organization) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Invoice not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">Open the invoice list and choose another invoice.</p>
          <Button asChild className="mt-5 rounded-lg">
            <Link href="/dashboard">Invoice list</Link>
          </Button>
        </section>
      </div>
    );
  }

  const currency = snapshot?.currency ?? invoice.currency ?? organization.defaultCurrency ?? "NAD";
  const subtotal = snapshot?.subtotal ?? invoice.subtotal ?? invoiceTotal(invoice);
  const vatAmount = snapshot?.vatAmount ?? invoice.vatAmount ?? 0;
  const total = snapshot?.total ?? snapshot?.amountTotal ?? invoiceTotal(invoice);
  const balanceDue = snapshot?.balanceDue ?? invoiceBalance(invoice);
  const invoiceNumber = snapshot?.invoiceNumber ?? invoice.invoiceNumber;
  const clientName = snapshot?.clientName ?? invoice.clientName ?? invoice.client ?? client?.name ?? "Client";
  const workspaceName = organization.name;
  const currentInvoiceId = invoice._id;
  const currentInvoiceStatus = invoice.status;
  const currentDueDate = snapshot?.dueDate ?? invoice.dueDate;
  const publicPath = invoice.publicToken ? `/invoice/${invoice.publicToken}` : "";
  const supplierSnapshot = snapshot?.supplierSnapshot ?? invoice.supplierSnapshot ?? null;
  const clientSnapshot = snapshot?.clientSnapshot ?? invoice.clientSnapshot ?? null;
  const bankDetails = snapshot?.bankDetails ?? invoice.bankDetails ?? null;
  const paymentInstructions = snapshot?.paymentInstructions ?? invoice.paymentInstructions ?? organization.paymentInstructions;
  const paymentReference = snapshot?.paymentReference ?? invoice.paymentReference ?? invoiceNumber;
  const canPrepare = !invoice.publicToken || !invoice.snapshotId;
  const canMarkSent = Boolean(invoice.publicToken && invoice.status !== "sent" && invoice.status !== "viewed" && invoice.status !== "paid" && invoice.status !== "void");
  const canMarkPaid = invoice.status !== "paid" && invoice.status !== "void";
  const canRemind = ["sent", "viewed", "approved", "awaiting_payment", "overdue"].includes(invoice.status);
  const canVoid = invoice.status !== "paid" && invoice.status !== "void";
  const clientEmail = snapshot?.clientEmail ?? invoice.clientEmail ?? client?.email ?? "";

  function openEmailDraft() {
    if (!publicPath) {
      return;
    }

    const publicHref = `${window.location.origin}${publicPath}`;
    const emailHref = buildClientEmailDraft({
      invoiceNumber,
      clientEmail,
      clientName,
      publicHref,
      workspaceName,
    });

    window.open(emailHref, "_blank", "noopener,noreferrer");
    setNotice("Email draft opened.");
  }

  async function handleScheduleReminder() {
    if (!publicPath) {
      setNotice("Prepare the invoice link before sending a reminder.");
      return;
    }

    const action = `reminder-${currentInvoiceId}`;
    const emailWindow = window.open("", "_blank");

    setPendingAction(action);
    setNotice("");

    try {
      const publicHref = `${window.location.origin}${publicPath}`;
      const isOverdue = currentInvoiceStatus === "overdue";
      const emailHref = buildReminderEmailDraft({
        amountDue: formatMoney(balanceDue, currency),
        clientEmail,
        clientName,
        dueDate: formatDate(currentDueDate),
        invoiceNumber,
        isOverdue,
        publicHref,
        workspaceName,
      });

      await scheduleReminder({
        id: currentInvoiceId,
        message: isOverdue
          ? `Overdue notice prepared for ${clientName}.`
          : `Reminder prepared for ${clientName}.`,
      });

      if (emailWindow) {
        emailWindow.location.href = emailHref;
      } else {
        window.open(emailHref, "_blank", "noopener,noreferrer");
      }

      setNotice(isOverdue ? `${invoiceNumber} overdue email opened.` : `${invoiceNumber} reminder email opened.`);
    } catch (error) {
      emailWindow?.close();
      setNotice(error instanceof Error ? error.message : "Unable to prepare reminder.");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <div className="space-y-[30px]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Button asChild variant="outline" className="mb-4 h-10 rounded-lg px-4">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Invoice list
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] font-semibold leading-tight tracking-normal text-foreground">
              {invoiceNumber}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-base text-muted-foreground">
            {clientName} - issued {formatDate(snapshot?.issueDate ?? invoice.issueDate, invoice.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {publicPath ? (
            <>
              <Button type="button" variant="outline" className="h-11 rounded-lg px-4" onClick={() => copyClientLink(publicPath)}>
                <Copy className="size-4" />
                Copy link
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-lg px-4">
                <a href={publicPath} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Client view
                </a>
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-lg px-4" onClick={openEmailDraft}>
                <Mail className="size-4" />
                Email
              </Button>
            </>
          ) : null}
          {canPrepare ? (
            <Button
              type="button"
              className="h-11 rounded-lg bg-neutral-950 px-5 font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
              disabled={pendingAction === `send-${invoice._id}`}
              onClick={() => prepareClientLink(invoice)}
            >
              {pendingAction === `send-${invoice._id}` ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Prepare send
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<ReceiptText className="size-7" />} label="Invoice total" value={formatMoney(total, currency)} tone="red" />
        <MetricCard icon={<WalletCards className="size-7" />} label="Balance due" value={formatMoney(balanceDue, currency)} tone="amber" />
        <MetricCard icon={<CalendarDays className="size-7" />} label="Due date" value={formatDate(snapshot?.dueDate ?? invoice.dueDate)} tone="teal" />
        <MetricCard icon={<UserRound className="size-7" />} label="Client" value={clientName} tone="neutral" />
      </section>

      <section className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
        <article className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[22px] font-semibold leading-7 text-foreground">Invoice preview</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {currency} / {invoiceNumber}
              </p>
            </div>
            <span className="grid size-[60px] shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
              <ReceiptText className="size-7" />
            </span>
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-3">
            <PreviewRow
              label="Bill from"
              value={supplierSnapshot?.name ?? organization.name}
              detail={supplierSnapshot?.legalName ?? supplierSnapshot?.vatNumber ?? undefined}
            />
            <PreviewRow
              label="Bill to"
              value={clientName}
              detail={snapshot?.clientEmail ?? invoice.clientEmail ?? client?.email ?? "No email"}
            />
            <PreviewRow label="Due" value={formatDate(currentDueDate)} />
          </div>

          <Separator className="my-7" />

          <div className="space-y-3">
            {lineItems.length > 0 ? (
              lineItems.map((item) => (
                <div key={item._id} className="flex items-start justify-between gap-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.description}</p>
                    <p className="text-muted-foreground">
                      {item.quantity} x {formatMoney(item.unitPrice, currency)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium text-foreground">{formatMoney(item.lineTotal, currency)}</p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                No line items saved.
              </p>
            )}
          </div>

          <Separator className="my-7" />

          <div className="ml-auto max-w-[420px] space-y-3 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
            <SummaryRow label={taxModeLabel(invoice.taxMode)} value={formatMoney(vatAmount, currency)} />
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-base">
              <span className="font-semibold text-foreground">Total</span>
              <strong className="text-xl text-foreground">{formatMoney(total, currency)}</strong>
            </div>
            <SummaryRow label="Balance due" value={formatMoney(balanceDue, currency)} strong />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <PreviewRow label="Issued" value={formatDate(snapshot?.issueDate ?? invoice.issueDate)} />
            <PreviewRow label="Created" value={formatDateTime(invoice.createdAt)} />
            <PreviewRow
              label={supplierSnapshot?.vatRegistered && invoice.taxMode !== "no_vat" ? "Tax invoice" : "Invoice"}
              value={statusLabels[invoice.status]}
            />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <DetailPanel
              title="Bill from details"
              rows={[
                ["Name", supplierSnapshot?.name ?? organization.name],
                ["Legal name", supplierSnapshot?.legalName],
                ["Address", supplierSnapshot?.address],
                ["Tax ID", supplierSnapshot?.taxId],
                ["VAT", supplierSnapshot?.vatNumber],
                ["Phone", supplierSnapshot?.phone],
              ]}
            />
            <DetailPanel
              title="Bill to details"
              rows={[
                ["Name", clientName],
                ["Email", snapshot?.clientEmail ?? invoice.clientEmail ?? client?.email],
                ["Business", clientSnapshot?.businessName ?? client?.businessName],
                ["Contact", clientSnapshot?.contactName ?? client?.contactName],
                ["Address", clientSnapshot?.address ?? client?.address],
                ["Tax ID", clientSnapshot?.taxId ?? client?.taxId],
                ["VAT", clientSnapshot?.vatNumber ?? client?.vatNumber],
                ["Phone", clientSnapshot?.phone ?? client?.phone],
              ]}
            />
            <DetailPanel
              title="Terms and notes"
              rows={[
                ["Terms", snapshot?.terms ?? invoice.terms],
                ["Notes", snapshot?.notes ?? invoice.notes],
                ["Requires approval", invoice.requiresApproval ? "Yes" : "No"],
                ["Rejection reason", invoice.rejectionReason],
              ]}
            />
            <DetailPanel
              title="Payment details"
              rows={[
                ["Instructions", paymentInstructions],
                ["Reference", paymentReference],
                ["Payment link", snapshot?.paymentLink ?? invoice.paymentLink],
                ["Bank", bankDetails?.bankName],
                ["Account name", bankDetails?.accountName],
                ["Account number", bankDetails?.accountNumber],
                ["Branch code", bankDetails?.branchCode],
                ["SWIFT", bankDetails?.swiftCode],
              ]}
            />
          </div>
        </article>

        <aside className="space-y-7">
          <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
            <p className="text-[22px] font-semibold leading-7 text-foreground">Actions</p>
            <div className="mt-5 grid gap-3">
              {canMarkSent ? (
                <ActionButton
                  icon={<Send className="size-4" />}
                  label="Mark sent"
                  pending={pendingAction === `sent-${invoice._id}`}
                  onClick={() =>
                    runAction(`sent-${invoice._id}`, () => markSent({ id: invoice._id }), "Invoice marked sent.")
                  }
                />
              ) : null}
              {canRemind ? (
                <ActionButton
                  icon={<Bell className="size-4" />}
                  label="Send reminder"
                  pending={pendingAction === `reminder-${invoice._id}`}
                  onClick={handleScheduleReminder}
                />
              ) : null}
              {canMarkPaid ? (
                <ActionButton
                  icon={<Banknote className="size-4" />}
                  label="Mark paid"
                  pending={pendingAction === `paid-${invoice._id}`}
                  onClick={() =>
                    runAction(`paid-${invoice._id}`, () => markPaid({ id: invoice._id }), "Invoice marked paid.")
                  }
                />
              ) : null}
              <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={() => window.print()}>
                <Download className="size-4" />
                Print / download
              </Button>
              {canVoid ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={pendingAction === `void-${invoice._id}`}
                  onClick={() =>
                    runAction(
                      `void-${invoice._id}`,
                      () => voidInvoice({ id: invoice._id, reason: "Voided from invoice viewer." }),
                      "Invoice voided.",
                    )
                  }
                >
                  {pendingAction === `void-${invoice._id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Void invoice
                </Button>
              ) : null}
            </div>
          </section>

          {pendingProof ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-none sm:p-[30px]">
              <p className="text-[22px] font-semibold leading-7 text-amber-950">Payment proof pending</p>
              <p className="mt-1 text-sm text-amber-800">
                {pendingProof.payerName} submitted {formatMoney(pendingProof.amount, pendingProof.currency)}.
              </p>
              <div className="mt-5 grid gap-3">
                <Button
                  type="button"
                  className="h-11 rounded-lg bg-neutral-950 font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
                  disabled={pendingAction === `proof-accept-${pendingProof._id}`}
                  onClick={() =>
                    runAction(
                      `proof-accept-${pendingProof._id}`,
                      () => reviewPaymentProof({ proofId: pendingProof._id, status: "accepted" }),
                      "Payment confirmed.",
                    )
                  }
                >
                  {pendingAction === `proof-accept-${pendingProof._id}` ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Confirm payment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={pendingAction === `proof-reject-${pendingProof._id}`}
                  onClick={() =>
                    runAction(
                      `proof-reject-${pendingProof._id}`,
                      () => reviewPaymentProof({ proofId: pendingProof._id, status: "rejected" }),
                      "Payment proof rejected.",
                    )
                  }
                >
                  {pendingAction === `proof-reject-${pendingProof._id}` ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                  Reject proof
                </Button>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
            <p className="text-[22px] font-semibold leading-7 text-foreground">Status timeline</p>
            <div className="mt-5 grid gap-3">
              <TimelineStep icon={<FileText className="size-4" />} label="Created" value={formatDateTime(invoice.createdAt)} done />
              <TimelineStep icon={<Send className="size-4" />} label="Sent" value={formatDateTime(invoice.sentAt)} done={Boolean(invoice.sentAt)} />
              <TimelineStep icon={<ExternalLink className="size-4" />} label="Viewed" value={formatDateTime(invoice.viewedAt)} done={Boolean(invoice.viewedAt)} />
              <TimelineStep icon={<CheckCircle2 className="size-4" />} label="Approved" value={formatDateTime(invoice.approvedAt)} done={Boolean(invoice.approvedAt)} />
              <TimelineStep icon={<Banknote className="size-4" />} label="Paid" value={formatDateTime(invoice.paidAt)} done={Boolean(invoice.paidAt)} />
            </div>
          </section>

          <RecordsSection
            title="Payment records"
            empty="No payment records yet."
            items={(data.paymentRecords ?? []).map((record) => ({
              id: record._id,
              title: `${formatMoney(record.amount, record.currency)} - ${record.status}`,
              detail: [
                record.provider,
                record.providerReference ? `Ref ${record.providerReference}` : "",
                formatDateTime(record.createdAt),
              ].filter(Boolean).join(" | "),
            }))}
          />

          <RecordsSection
            title="Payment proofs"
            empty="No payment proofs submitted."
            items={(data.paymentProofs ?? []).map((proof: PaymentProof) => ({
              id: proof._id,
              title: `${formatMoney(proof.amount, proof.currency)} - ${proof.status}`,
              detail: [
                proof.payerName,
                proof.paymentDate,
                proof.bankReference ? `Ref ${proof.bankReference}` : "",
                proof.fileName,
              ].filter(Boolean).join(" | "),
            }))}
          />

          <RecordsSection
            title="Activity"
            empty="No activity yet."
            items={(data.events ?? []).map((event) => ({
              id: event._id,
              title: event.message,
              detail: [
                event.actorType,
                event.actorName,
                formatDateTime(event.createdAt),
              ].filter(Boolean).join(" | "),
            }))}
          />
        </aside>
      </section>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const tone: Record<InvoiceStatus, string> = {
    draft: "bg-orange-50 text-orange-600",
    ready: "bg-orange-50 text-orange-600",
    sent: "bg-amber-50 text-amber-600",
    viewed: "bg-amber-50 text-amber-600",
    approved: "bg-teal-50 text-teal-700",
    awaiting_payment: "bg-amber-50 text-amber-600",
    rejected: "bg-red-50 text-red-600",
    paid: "bg-teal-50 text-teal-700",
    overdue: "bg-red-50 text-red-600",
    void: "bg-neutral-100 text-neutral-600",
  };

  return (
    <Badge className={cn("h-6 rounded-full border-0 px-3 text-sm font-semibold", tone[status])}>
      {statusLabels[status]}
    </Badge>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "amber" | "neutral" | "red" | "teal";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-500",
    neutral: "bg-neutral-100 text-neutral-700",
    red: "bg-red-50 text-red-600",
    teal: "bg-teal-50 text-teal-600",
  };

  return (
    <article className="min-h-[156px] rounded-lg border border-border bg-card p-[30px] shadow-none">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="truncate text-[26px] font-semibold leading-none tracking-normal text-foreground">{value}</p>
          <p className="mt-2 truncate text-[18px] leading-6 text-muted-foreground">{label}</p>
        </div>
        <span className={cn("grid size-[60px] shrink-0 place-items-center rounded-lg", tones[tone])}>{icon}</span>
      </div>
    </article>
  );
}

function DetailPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string | undefined | null | boolean]>;
}) {
  const visibleRows = rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <dl className="mt-4 grid gap-3">
        {visibleRows.length > 0 ? (
          visibleRows.map(([label, value]) => (
            <div key={label} className="grid gap-1">
              <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
              <dd className="break-words text-sm text-foreground">{String(value)}</dd>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No details saved.</p>
        )}
      </dl>
    </section>
  );
}

function PreviewRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-foreground">{value}</p>
      {detail ? <p className="mt-1 truncate text-sm text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1 text-sm", strong ? "font-semibold text-foreground" : "text-muted-foreground")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  pending,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  pending?: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" className="h-11 rounded-lg" disabled={pending} onClick={onClick}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </Button>
  );
}

function TimelineStep({
  icon,
  label,
  value,
  done,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", done ? "bg-teal-50 text-teal-700" : "bg-muted text-muted-foreground")}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function RecordsSection({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string; detail: string }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
      <p className="text-[22px] font-semibold leading-7 text-foreground">{title}</p>
      <div className="mt-5 grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}
