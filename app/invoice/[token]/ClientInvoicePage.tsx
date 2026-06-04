"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useMutation, usePreloadedQuery, type Preloaded } from "convex/react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  ReceiptText,
  Upload,
  XCircle,
} from "@/app/_components/IconPack";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

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

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function statusLabel(status: string) {
  if (status === "awaiting_payment") {
    return "Awaiting payment";
  }

  return status.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (status === "paid" || status === "approved" || status === "awaiting_payment") {
    return "bg-teal-50 text-teal-700";
  }

  if (status === "overdue" || status === "rejected") {
    return "bg-red-50 text-red-600";
  }

  if (status === "void") {
    return "bg-neutral-100 text-neutral-600";
  }

  return "bg-orange-50 text-orange-600";
}

function taxModeLabel(value?: string) {
  const labels: Record<string, string> = {
    no_vat: "No VAT",
    vat_15: "VAT 15%",
    zero_rated: "Zero-rated",
    exempt: "Exempt",
  };

  return value ? labels[value] ?? value : "VAT";
}

export function ClientInvoicePage({
  token,
  preloadedInvoice,
}: {
  token: string;
  preloadedInvoice: Preloaded<typeof api.invoices.getByToken>;
}) {
  const data = usePreloadedQuery(preloadedInvoice);
  const markViewed = useMutation(api.invoices.markViewedByToken);
  const approve = useMutation(api.invoices.approveByToken);
  const reject = useMutation(api.invoices.rejectByToken);
  const generateUploadUrl = useMutation(api.invoices.generatePaymentProofUploadUrl);
  const submitPaymentProof = useMutation(api.invoices.submitPaymentProofByToken);
  const viewedRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [payerName, setPayerName] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankReference, setBankReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submittedToken, setSubmittedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!data || viewedRef.current) {
      return;
    }

    viewedRef.current = true;
    void markViewed({ token });
  }, [data, markViewed, token]);

  const invoice = data?.invoice;
  const snapshot = data?.snapshot;
  const organization = data?.organization;
  const lineItems = useMemo(() => data?.lineItems ?? [], [data?.lineItems]);
  const supplierSnapshot = snapshot?.supplierSnapshot ?? invoice?.supplierSnapshot ?? null;
  const clientSnapshot = snapshot?.clientSnapshot ?? invoice?.clientSnapshot ?? null;
  const invoiceNumber = snapshot?.invoiceNumber ?? invoice?.invoiceNumber ?? "Invoice";
  const clientName = snapshot?.clientName ?? invoice?.clientName ?? invoice?.client ?? "Client";
  const clientEmail = snapshot?.clientEmail ?? invoice?.clientEmail ?? "";
  const currency = snapshot?.currency ?? invoice?.currency ?? "NAD";
  const subtotal = snapshot?.subtotal ?? invoice?.subtotal ?? snapshot?.amountTotal ?? invoice?.amountTotal ?? invoice?.amount ?? 0;
  const vatAmount = snapshot?.vatAmount ?? invoice?.vatAmount ?? 0;
  const total = snapshot?.total ?? snapshot?.amountTotal ?? invoice?.total ?? invoice?.amountTotal ?? invoice?.amount ?? 0;
  const taxMode = snapshot?.taxMode ?? invoice?.taxMode ?? "no_vat";
  const balanceDue = snapshot?.balanceDue ?? invoice?.balanceDue ?? (invoice?.status === "paid" ? 0 : total);
  const bankDetails = snapshot?.bankDetails ?? invoice?.bankDetails ?? null;
  const requiresApproval = snapshot?.requiresApproval ?? invoice?.requiresApproval ?? false;
  const paymentProofs = data?.paymentProofs ?? [];
  const latestPaymentProof = paymentProofs[0] ?? null;
  const hasSubmittedPaymentDetails = submittedToken === token || paymentProofs.length > 0;

  async function handleApprove() {
    setPending(true);
    setNotice(null);

    try {
      const paymentLink = await approve({ token });
      setNotice(
        paymentLink
          ? "Approved. Use the payment link when you are ready."
          : "Approved. Use the EFT details when you are ready.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to approve invoice.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingProof(true);
    setNotice(null);

    try {
      let storageId: Id<"_storage"> | undefined;

      if (proofFile) {
        const uploadUrl = await generateUploadUrl({ token });
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": proofFile.type || "application/octet-stream" },
          body: proofFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Proof upload failed");
        }

        const uploadJson = (await uploadResponse.json()) as { storageId: string };
        storageId = uploadJson.storageId as Id<"_storage">;
      }

      await submitPaymentProof({
        token,
        payerName: payerName || clientName,
        amount: Number(paymentAmount) || balanceDue || total,
        paymentDate,
        bankReference,
        storageId,
        fileName: proofFile?.name,
      });
      setProofFile(null);
      setBankReference("");
      setSubmittedToken(token);
      setNotice("Payment details submitted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to submit payment proof.");
    } finally {
      setSubmittingProof(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    setNotice(null);

    try {
      await reject({
        token,
        reason: rejectionReason,
      });
      setNotice("Request sent.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to reject invoice.");
    } finally {
      setRejecting(false);
    }
  }

  if (data === null || !invoice) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <ReceiptText className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Invoice link not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">Ask the sender for a fresh invoice link.</p>
        </section>
      </main>
    );
  }

  const issueDate = snapshot?.issueDate ?? invoice.issueDate;
  const dueDate = snapshot?.dueDate ?? invoice.dueDate;
  const supplierName = supplierSnapshot?.name ?? organization?.name ?? "Supplier";
  const isTaxInvoice = Boolean(supplierSnapshot?.vatRegistered && taxMode !== "no_vat");
  const approvalComplete =
    invoice.status === "approved" ||
    invoice.status === "awaiting_payment" ||
    invoice.status === "paid";
  const approvalOpen =
    requiresApproval &&
    !approvalComplete &&
    invoice.status !== "rejected" &&
    invoice.status !== "paid";
  const paymentReady = !requiresApproval || approvalComplete;
  const canSubmitProof =
    paymentReady &&
    !hasSubmittedPaymentDetails &&
    invoice.status !== "paid" &&
    invoice.status !== "rejected";
  const paymentLink = snapshot?.paymentLink ?? invoice.paymentLink;
  const paymentSubmitted = hasSubmittedPaymentDetails || invoice.status === "paid";
  const paymentInstructions =
    snapshot?.paymentInstructions ??
    invoice.paymentInstructions ??
    "Pay by EFT or bank transfer using the invoice number as reference.";
  const paymentReference = snapshot?.paymentReference ?? invoice.paymentReference ?? invoiceNumber;
  const notes = snapshot?.notes ?? invoice.notes;

  return (
    <main className="client-invoice-page min-h-dvh bg-muted/40 p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1180px] space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{supplierName}</p>
            <p className="text-xs text-muted-foreground">{invoiceNumber}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            <SmallButton type="button" onClick={() => window.print()}>
              <Download className="size-3.5" />
              Print
            </SmallButton>
            <SmallButton asChild>
              <a href={`mailto:?subject=${encodeURIComponent(`${invoiceNumber} question`)}`}>
                <Mail className="size-3.5" />
                Email
              </a>
            </SmallButton>
          </div>
        </header>

        {notice ? (
          <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
            {notice}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <article className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="grid size-10 place-items-center rounded-lg bg-red-50 text-red-600">
                  <ReceiptText className="size-5" />
                </span>
                <h1 className="mt-5 text-[34px] font-semibold leading-none tracking-normal text-foreground">
                  {isTaxInvoice ? "Tax Invoice" : "Invoice"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{invoiceNumber}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 sm:min-w-[220px] sm:text-right">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Amount due</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{formatMoney(balanceDue, currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(dueDate)}</p>
              </div>
            </div>

            <Separator className="my-8" />

            <div className="grid gap-5 md:grid-cols-2">
              <PartyBlock
                title="From"
                name={supplierName}
                lines={[
                  supplierSnapshot?.legalName,
                  supplierSnapshot?.address,
                  supplierSnapshot?.vatNumber ? `VAT ${supplierSnapshot.vatNumber}` : undefined,
                  supplierSnapshot?.phone,
                ]}
              />
              <PartyBlock
                title="Bill to"
                name={clientName}
                lines={[
                  clientEmail,
                  clientSnapshot?.businessName,
                  clientSnapshot?.address,
                  clientSnapshot?.vatNumber ? `VAT ${clientSnapshot.vatNumber}` : undefined,
                  clientSnapshot?.phone,
                ]}
              />
            </div>

            <div className="mt-7 grid gap-3 border-y border-border py-4 sm:grid-cols-3">
              <InvoiceMeta label="Issued" value={formatDate(issueDate)} />
              <InvoiceMeta label="Due" value={formatDate(dueDate)} />
              <InvoiceMeta label="Currency" value={currency} />
            </div>

            <section className="mt-7">
              <div className="hidden grid-cols-[minmax(0,1fr)_72px_120px_120px] gap-4 border-b border-border pb-3 text-xs font-semibold uppercase text-muted-foreground md:grid">
                <span>Description</span>
                <span>Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Total</span>
              </div>
              <div className="divide-y divide-border">
                {lineItems.length > 0 ? (
                  lineItems.map((item) => (
                    <div key={item._id} className="grid gap-2 py-4 text-sm md:grid-cols-[minmax(0,1fr)_72px_120px_120px] md:gap-4">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-foreground">{item.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{taxModeLabel(item.taxMode ?? taxMode)}</p>
                      </div>
                      <div className="flex justify-between gap-3 md:block">
                        <span className="text-xs font-semibold uppercase text-muted-foreground md:hidden">Qty</span>
                        <span className="text-foreground">{item.quantity}</span>
                      </div>
                      <div className="flex justify-between gap-3 md:block md:text-right">
                        <span className="text-xs font-semibold uppercase text-muted-foreground md:hidden">Unit</span>
                        <span className="text-foreground">{formatMoney(item.unitPrice, currency)}</span>
                      </div>
                      <div className="flex justify-between gap-3 font-medium md:block md:text-right">
                        <span className="text-xs font-semibold uppercase text-muted-foreground md:hidden">Total</span>
                        <span>{formatMoney(item.lineTotal, currency)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-5 text-sm text-muted-foreground">No line items saved.</p>
                )}
              </div>
            </section>

            <div className="mt-7 flex justify-end">
              <div className="w-full max-w-[360px] space-y-2">
                <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
                <SummaryRow label={taxModeLabel(taxMode)} value={formatMoney(vatAmount, currency)} />
                <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                  <span className="font-semibold text-foreground">Total</span>
                  <strong className="text-xl text-foreground">{formatMoney(total, currency)}</strong>
                </div>
                <SummaryRow label="Balance due" value={formatMoney(balanceDue, currency)} strong />
              </div>
            </div>

            <Separator className="my-8" />

            <div className="grid gap-4 md:grid-cols-2">
              <InfoPanel
                title="Payment"
                rows={[
                  ["Instructions", paymentInstructions],
                  ["Reference", paymentReference],
                  ["Bank", bankDetails?.bankName],
                  ["Account name", bankDetails?.accountName],
                  ["Account number", bankDetails?.accountNumber],
                  ["Branch code", bankDetails?.branchCode],
                  ["SWIFT", bankDetails?.swiftCode],
                ]}
              />
              <InfoPanel
                title="Notes"
                rows={[
                  ["Terms", snapshot?.terms ?? invoice.terms ?? "Due on receipt."],
                  ["Note", notes],
                  ["Approval", requiresApproval ? "Required" : "Not required"],
                  ["Request", invoice.rejectionReason],
                ]}
              />
            </div>
          </article>

          <aside className="space-y-3 lg:sticky lg:top-6">
            <section className="rounded-lg border border-border bg-card p-4 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Actions</p>
                <span className="text-xs text-muted-foreground">{statusLabel(invoice.status)}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ClientFlowStep label="Received" state="done" />
                <ClientFlowStep
                  label="Review"
                  state={approvalComplete || !requiresApproval ? "done" : approvalOpen ? "active" : "waiting"}
                />
                <ClientFlowStep label="Payment" state={paymentSubmitted ? "done" : paymentReady ? "active" : "waiting"} />
              </div>

              {requiresApproval ? (
                <div className="mt-4 space-y-2">
                  {approvalOpen ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <SmallButton
                          type="button"
                          className="bg-neutral-950 !text-white hover:bg-neutral-800 hover:!text-white"
                          disabled={pending || rejecting}
                          onClick={handleApprove}
                        >
                          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                          Approve
                        </SmallButton>
                        <SmallButton
                          type="button"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={pending || rejecting}
                          onClick={handleReject}
                        >
                          {rejecting ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                          Request
                        </SmallButton>
                      </div>
                      <Textarea
                        id="rejection-reason"
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder="Reason for changes"
                        className="min-h-20 resize-none rounded-lg border-border bg-background text-sm"
                      />
                    </>
                  ) : null}

                  {approvalComplete ? (
                    <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700">
                      Approved.
                    </p>
                  ) : null}

                  {invoice.status === "rejected" ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                      {invoice.rejectionReason ?? "Changes requested."}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-border bg-card p-4 shadow-none">
              <p className="text-sm font-semibold text-foreground">Payment proof</p>

              {paymentLink && paymentReady && !hasSubmittedPaymentDetails ? (
                <SmallButton asChild className="mt-3">
                  <a href={paymentLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    Pay
                  </a>
                </SmallButton>
              ) : null}

              {hasSubmittedPaymentDetails ? (
                <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-700">
                  <p className="font-semibold">Submitted</p>
                  {latestPaymentProof ? (
                    <dl className="mt-2 grid gap-1">
                      <ProofRow label="Amount" value={formatMoney(latestPaymentProof.amount, latestPaymentProof.currency ?? currency)} />
                      <ProofRow label="Date" value={latestPaymentProof.paymentDate} />
                      {latestPaymentProof.bankReference ? <ProofRow label="Ref" value={latestPaymentProof.bankReference} /> : null}
                    </dl>
                  ) : null}
                </div>
              ) : (
                <form onSubmit={handleSubmitProof} className="mt-3 grid gap-2">
                  <Field label="Name">
                    <Input
                      value={payerName}
                      onChange={(event) => setPayerName(event.target.value)}
                      placeholder={clientName}
                      disabled={!canSubmitProof}
                      className="h-9 rounded-lg border-border bg-background text-sm disabled:opacity-50"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Amount">
                      <Input
                        inputMode="decimal"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        placeholder={String(balanceDue || total)}
                        disabled={!canSubmitProof}
                        className="h-9 rounded-lg border-border bg-background text-sm disabled:opacity-50"
                      />
                    </Field>
                    <Field label="Date">
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(event) => setPaymentDate(event.target.value)}
                        disabled={!canSubmitProof}
                        className="h-9 rounded-lg border-border bg-background text-sm disabled:opacity-50"
                      />
                    </Field>
                  </div>
                  <Field label="Reference">
                    <Input
                      value={bankReference}
                      onChange={(event) => setBankReference(event.target.value)}
                      disabled={!canSubmitProof}
                      className="h-9 rounded-lg border-border bg-background text-sm disabled:opacity-50"
                    />
                  </Field>
                  <Field label="File">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={!canSubmitProof}
                      onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                      className="w-full rounded-lg border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                    />
                  </Field>
                  <SmallButton
                    type="submit"
                    className="bg-neutral-950 !text-white hover:bg-neutral-800 hover:!text-white"
                    disabled={submittingProof || !canSubmitProof}
                  >
                    {submittingProof ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    Submit
                  </SmallButton>
                </form>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("h-6 rounded-full border-0 px-3 text-sm font-semibold", statusTone(status))}>
      {statusLabel(status)}
    </Badge>
  );
}

function SmallButton({ className, variant = "outline", ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      className={cn("h-8 rounded-lg border-border bg-background px-3 text-xs font-medium shadow-none", className)}
      {...props}
    />
  );
}

function PartyBlock({
  title,
  name,
  lines,
}: {
  title: string;
  name: string;
  lines: Array<string | undefined | null>;
}) {
  const visibleLines = lines.filter((line): line is string => Boolean(line && line.trim()));

  return (
    <section>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{name}</p>
      {visibleLines.length > 0 ? (
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          {visibleLines.map((line) => (
            <p key={line} className="break-words">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InvoiceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
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

function InfoPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string | undefined | null | boolean]>;
}) {
  const visibleRows = rows.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

  return (
    <section>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <dl className="mt-3 grid gap-2">
        {visibleRows.length > 0 ? (
          visibleRows.map(([label, value]) => (
            <div key={label} className="grid gap-0.5">
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

function ClientFlowStep({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "waiting";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border border-border bg-background px-2.5 text-xs text-muted-foreground",
        state === "active" && "border-neutral-950 text-foreground",
        state === "done" && "border-teal-100 bg-teal-50 text-teal-700",
      )}
    >
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-teal-700/70">{label}</dt>
      <dd className="truncate font-medium text-teal-800">{value}</dd>
    </div>
  );
}
