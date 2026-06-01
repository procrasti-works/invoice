"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  ReceiptText,
  Upload,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

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

function statusLabel(status: string) {
  if (status === "awaiting_payment") {
    return "Awaiting payment";
  }

  return status.replace("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function ClientInvoicePage({ token }: { token: string }) {
  const data = useQuery(api.invoices.getByToken, { token });
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
  const clientName =
    snapshot?.clientName ?? invoice?.clientName ?? invoice?.client ?? "Client";
  const clientEmail = snapshot?.clientEmail ?? invoice?.clientEmail ?? "";
  const currency = snapshot?.currency ?? invoice?.currency ?? "NAD";
  const subtotal = snapshot?.subtotal ?? invoice?.subtotal ?? snapshot?.amountTotal ?? invoice?.amountTotal ?? invoice?.amount ?? 0;
  const vatAmount = snapshot?.vatAmount ?? invoice?.vatAmount ?? 0;
  const total = snapshot?.total ?? snapshot?.amountTotal ?? invoice?.total ?? invoice?.amountTotal ?? invoice?.amount ?? 0;
  const taxMode = snapshot?.taxMode ?? invoice?.taxMode ?? "no_vat";
  const isTaxInvoice = Boolean(supplierSnapshot?.vatRegistered && taxMode !== "no_vat");
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
          ? "Approved. Payment is separate, use the payment link when you are ready to pay."
          : "Approved. Payment is separate. Use the EFT details below when you are ready to pay.",
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
      setNotice("Payment details submitted. The business will review them and confirm payment.");
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
      setNotice("Rejected. The sender will amend the invoice and send it back.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to reject invoice.");
    } finally {
      setRejecting(false);
    }
  }

  if (data === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f5f5f7] p-6">
        <div className="flex items-center gap-3 rounded-md border border-[#e5e5ea] bg-white px-4 py-3 text-sm text-[#424245]">
          <Loader2 className="size-4 animate-spin" />
          Loading invoice
        </div>
      </main>
    );
  }

  if (data === null || !invoice) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f5f5f7] p-6">
        <section className="w-full max-w-md rounded-lg border border-[#e5e5ea] bg-white p-6 text-center">
          <ReceiptText className="mx-auto size-10 text-[#8a8a8e]" />
          <h1 className="mt-4 text-2xl font-medium text-[#1d1d1f]">
            Invoice link not found
          </h1>
          <p className="mt-2 text-sm text-[#6e6e73]">
            Ask the sender for a fresh invoice link.
          </p>
        </section>
      </main>
    );
  }

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

  return (
    <main className="public-invoice-page min-h-dvh bg-[#f6f7f9] p-4 text-[#17181c] sm:p-6">
      <section className="public-invoice-layout mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="public-invoice-document overflow-hidden rounded-2xl border border-[#e3e6eb] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#edf0f3] p-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#697180]">
                {organization?.name ?? "Invoice Ledger"}
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-[#111318]">
                {isTaxInvoice ? "Tax Invoice" : "Invoice"}
              </h1>
              <p className="mt-2 text-sm text-[#697180]">
                {invoiceNumber} sent to {clientName}
              </p>
            </div>
            <Badge variant="outline" className="w-max rounded-full border-[#e3e6eb] bg-[#f8f9fb] px-3 py-1 text-[#4e5663]">
              {statusLabel(invoice.status)}
            </Badge>
          </div>

          <div className="grid gap-4 border-b border-[#edf0f3] p-6 sm:grid-cols-2">
            <Fact
              label="Supplier"
              value={supplierSnapshot?.name ?? organization?.name ?? "Supplier"}
              detail={[
                supplierSnapshot?.address,
                supplierSnapshot?.vatNumber ? `VAT ${supplierSnapshot.vatNumber}` : "",
              ].filter(Boolean).join(" | ")}
            />
            <Fact
              label="Customer"
              value={clientName}
              detail={[
                clientEmail,
                clientSnapshot?.address,
                clientSnapshot?.vatNumber ? `VAT ${clientSnapshot.vatNumber}` : "",
              ].filter(Boolean).join(" | ")}
            />
          </div>

          <div className="grid gap-4 border-b border-[#edf0f3] p-6 sm:grid-cols-3">
            <Fact label="Invoice number" value={invoiceNumber} />
            <Fact label="Issued" value={snapshot?.issueDate ?? invoice.issueDate ?? "-"} />
            <Fact label="Due" value={snapshot?.dueDate ?? invoice.dueDate} />
          </div>

          <div className="p-6">
            <div className="public-invoice-lines overflow-x-auto rounded-xl border border-[#e3e6eb]">
              <div className="public-invoice-lines-table min-w-[680px]">
                <div className="public-invoice-lines-head grid grid-cols-[minmax(0,1fr)_70px_120px_110px_120px] border-b border-[#edf0f3] bg-[#f8f9fb] px-4 py-3 text-xs font-medium text-[#5f6876]">
                  <span>Description</span>
                  <span>Qty</span>
                  <span className="text-right">Unit price</span>
                  <span className="text-right">VAT</span>
                  <span className="text-right">Line total</span>
                </div>
                {lineItems.map((item) => (
                  <div
                    key={item._id}
                    className="public-invoice-line-row grid grid-cols-[minmax(0,1fr)_70px_120px_110px_120px] border-b border-[#f2f4f7] px-4 py-4 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 truncate">{item.description}</span>
                    <span>{item.quantity}</span>
                    <span className="text-right">{formatMoney(item.unitPrice, currency)}</span>
                    <span className="text-right">{formatMoney(item.vatAmount ?? 0, currency)}</span>
                    <span className="text-right font-medium">
                      {formatMoney(item.lineTotal, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-[280px] rounded-xl border border-[#edf0f3] bg-[#fbfcfd] p-4">
                <div className="flex justify-between text-sm text-[#697180]">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal, currency)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm text-[#697180]">
                  <span>VAT</span>
                  <span>{formatMoney(vatAmount, currency)}</span>
                </div>
                <div className="mt-3 flex justify-between border-t border-[#e3e6eb] pt-3 text-xl font-semibold text-[#111318]">
                  <span>Total</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm font-medium text-[#0b6b4f]">
                  <span>Balance due</span>
                  <span>{formatMoney(balanceDue, currency)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 rounded-xl border border-[#e3e6eb] bg-[#fbfcfd] p-4 text-sm text-[#4e5663]">
              <p>
                <span className="font-medium text-[#111318]">Terms:</span>{" "}
                {snapshot?.terms ?? invoice.terms ?? "Due on receipt."}
              </p>
              <p>
                <span className="font-medium text-[#111318]">Payment:</span>{" "}
                {snapshot?.paymentInstructions ??
                  invoice.paymentInstructions ??
                  "Pay by EFT or bank transfer using the invoice number as reference."}
              </p>
              {bankDetails ? (
                <div className="grid gap-1 rounded-lg border border-[#e3e6eb] bg-white p-3">
                  <p className="font-medium text-[#111318]">EFT details</p>
                  {bankDetails.bankName ? <p>Bank: {bankDetails.bankName}</p> : null}
                  {bankDetails.accountName ? <p>Account name: {bankDetails.accountName}</p> : null}
                  {bankDetails.accountNumber ? <p>Account number: {bankDetails.accountNumber}</p> : null}
                  {bankDetails.branchCode ? <p>Branch code: {bankDetails.branchCode}</p> : null}
                  {bankDetails.swiftCode ? <p>SWIFT: {bankDetails.swiftCode}</p> : null}
                  <p>Reference: {snapshot?.paymentReference ?? invoice.paymentReference ?? invoiceNumber}</p>
                </div>
              ) : null}
              {(snapshot?.notes ?? invoice.notes) ? (
                <p>{snapshot?.notes ?? invoice.notes}</p>
              ) : null}
            </div>
          </div>
        </article>

        <aside className="public-invoice-actions h-max overflow-hidden rounded-2xl border border-[#e3e6eb] bg-white lg:sticky lg:top-6">
          {requiresApproval ? (
            <section className="grid gap-3 border-b border-[#edf0f3] p-5">
              <div>
                <p className="text-sm font-semibold text-[#111318]">Approval</p>
                <p className="mt-1 text-sm text-[#697180]">
                  {approvalComplete
                    ? "Approved. Payment can be sent now."
                    : invoice.status === "rejected"
                      ? "Changes were requested on this invoice."
                      : "Approve this invoice before payment."}
                </p>
              </div>

              {approvalOpen ? (
                <Button
                  type="button"
                  disabled={pending || rejecting}
                  className="h-11 rounded-xl bg-[#111318] text-white hover:bg-[#2b2f36] hover:text-white"
                  onClick={handleApprove}
                >
                  {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Approve invoice
                </Button>
              ) : null}

              {approvalComplete ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Invoice approved.
                </div>
              ) : null}

              {invoice.status === "rejected" ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  {invoice.rejectionReason ??
                    "You rejected this invoice. The sender will amend it and send it back."}
                </div>
              ) : null}

              {approvalOpen ? (
                <div className="grid gap-2">
                  <label
                    htmlFor="rejection-reason"
                    className="text-xs font-medium text-[#4e5663]"
                  >
                    Request changes
                  </label>
                  <textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Tell the sender what needs to change."
                    className="min-h-24 resize-none rounded-xl border border-[#e3e6eb] bg-[#fbfcfd] p-3 text-sm outline-none focus:border-[#5e6ad2] focus:ring-2 focus:ring-[#5e6ad2]/20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || rejecting}
                    className="h-10 rounded-xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                    onClick={handleReject}
                  >
                    {rejecting ? <Loader2 className="animate-spin" /> : <XCircle />}
                    Send request
                  </Button>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="grid gap-4 p-5">
            <div>
              <p className="text-sm font-semibold text-[#111318]">Payment</p>
              <p className="mt-1 text-sm text-[#697180]">
                {hasSubmittedPaymentDetails
                  ? "Payment details have been sent. The invoice remains available to view."
                  : paymentReady
                    ? "Use the payment details, then submit proof."
                    : "Payment unlocks after approval."}
              </p>
            </div>

            {notice ? (
              <p className="rounded-xl border border-[#bed8ff] bg-[#f3f8ff] p-3 text-sm text-[#0c4d9a]">
                {notice}
              </p>
            ) : null}

            {paymentLink && paymentReady && !hasSubmittedPaymentDetails ? (
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl border-[#e3e6eb] bg-white"
              >
                <a href={paymentLink} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Open payment link
                </a>
              </Button>
            ) : null}

            {hasSubmittedPaymentDetails ? (
              <div className="rounded-xl border border-[#d9eadf] bg-[#f4fbf6] p-4 text-sm text-[#28533b]">
                <p className="font-semibold text-[#173d2a]">Payment details submitted</p>
                <p className="mt-1">
                  The business has received the payment details. This invoice is now view-only.
                </p>
                {latestPaymentProof ? (
                  <dl className="mt-4 grid gap-2 text-[#344054]">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#667085]">Amount</dt>
                      <dd className="font-medium">
                        {formatMoney(latestPaymentProof.amount, latestPaymentProof.currency ?? currency)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-[#667085]">Date</dt>
                      <dd className="font-medium">{latestPaymentProof.paymentDate}</dd>
                    </div>
                    {latestPaymentProof.bankReference ? (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[#667085]">Reference</dt>
                        <dd className="truncate font-medium">{latestPaymentProof.bankReference}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}
              </div>
            ) : (
              <form onSubmit={handleSubmitProof} className="grid gap-3">
                <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
                  Payer name
                  <input
                    value={payerName}
                    onChange={(event) => setPayerName(event.target.value)}
                    placeholder={clientName}
                    disabled={!canSubmitProof}
                    className="h-11 rounded-xl border border-[#e3e6eb] bg-white px-3 text-sm outline-none disabled:opacity-50"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
                  Amount
                  <input
                    inputMode="decimal"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    placeholder={String(balanceDue || total)}
                    disabled={!canSubmitProof}
                    className="h-11 rounded-xl border border-[#e3e6eb] bg-white px-3 text-sm outline-none disabled:opacity-50"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
                  Payment date
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    disabled={!canSubmitProof}
                    className="h-11 rounded-xl border border-[#e3e6eb] bg-white px-3 text-sm outline-none disabled:opacity-50"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
                  Bank reference
                  <input
                    value={bankReference}
                    onChange={(event) => setBankReference(event.target.value)}
                    disabled={!canSubmitProof}
                    className="h-11 rounded-xl border border-[#e3e6eb] bg-white px-3 text-sm outline-none disabled:opacity-50"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-[#344054]">
                  Proof file
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    disabled={!canSubmitProof}
                    onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-[#e3e6eb] bg-white px-3 py-2 text-sm disabled:opacity-50"
                  />
                </label>
                <Button
                  type="submit"
                  disabled={submittingProof || !canSubmitProof}
                  className="h-12 rounded-xl bg-[#0b6b4f] text-base text-white hover:bg-[#075b42] hover:text-white"
                >
                  {submittingProof ? <Loader2 className="animate-spin" /> : <Upload />}
                  Submit proof
                </Button>
              </form>
            )}
          </section>

          <section className="grid gap-3 border-t border-[#edf0f3] bg-[#fbfcfd] p-5">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-[#e3e6eb] bg-white"
              onClick={() => window.print()}
            >
              <Download />
              Download / print
            </Button>

            <a
              href={`mailto:?subject=${encodeURIComponent(`${invoiceNumber} question`)}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e3e6eb] bg-white px-4 text-sm font-medium transition-colors hover:bg-[#f6f7f9]"
            >
              <Mail className="size-4" />
              Contact sender
            </a>

            <p className="rounded-xl bg-white p-3 text-xs text-[#697180]">
              Secure invoice link. Payment is confirmed by the sender.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Fact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-[#697180]">{label}</p>
      <p className="mt-1 font-semibold text-[#111318]">{value}</p>
      {detail ? <p className="text-xs text-[#697180]">{detail}</p> : null}
    </div>
  );
}
