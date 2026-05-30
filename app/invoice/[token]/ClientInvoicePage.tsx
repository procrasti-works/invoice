"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  ReceiptText,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

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
  const viewedRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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
  const invoiceNumber = snapshot?.invoiceNumber ?? invoice?.invoiceNumber ?? "Invoice";
  const clientName =
    snapshot?.clientName ?? invoice?.clientName ?? invoice?.client ?? "Client";
  const clientEmail = snapshot?.clientEmail ?? invoice?.clientEmail ?? "";
  const currency = snapshot?.currency ?? invoice?.currency ?? "USD";
  const total = snapshot?.amountTotal ?? invoice?.amountTotal ?? invoice?.amount ?? 0;

  async function handleApprove() {
    setPending(true);
    setNotice(null);

    try {
      const paymentLink = await approve({ token });
      setNotice(
        paymentLink
          ? "Approved. Payment is separate, use the payment link when you are ready to pay."
          : "Approved. Payment is separate and remains due by the agreed date.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to approve invoice.");
    } finally {
      setPending(false);
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

  return (
    <main className="min-h-dvh bg-[#f5f5f7] p-3 text-[#1d1d1f] sm:p-6">
      <section className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-lg border border-[#e5e5ea] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#e5e5ea] p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium text-[#6e6e73]">
                {organization?.name ?? "Invoice Ledger"}
              </p>
              <h1 className="mt-2 text-3xl font-medium text-[#1d1d1f]">
                {invoiceNumber}
              </h1>
              <p className="mt-1 text-sm text-[#6e6e73]">
                Sent to {clientName}
              </p>
            </div>
            <Badge variant="outline" className="w-max border-cyan-300 bg-cyan-50 text-cyan-800">
              {statusLabel(invoice.status)}
            </Badge>
          </div>

          <div className="grid gap-4 border-b border-[#e5e5ea] p-5 sm:grid-cols-3">
            <Fact label="Client" value={clientName} detail={clientEmail} />
            <Fact label="Issued" value={snapshot?.issueDate ?? invoice.issueDate ?? "-"} />
            <Fact label="Due" value={snapshot?.dueDate ?? invoice.dueDate} />
          </div>

          <div className="p-5">
            <div className="overflow-hidden rounded-md border border-[#e5e5ea]">
              <div className="grid grid-cols-[minmax(0,1fr)_80px_120px] border-b border-[#e5e5ea] bg-[#fbfbfd] px-3 py-2 text-xs font-medium text-[#424245]">
                <span>Item</span>
                <span>Qty</span>
                <span className="text-right">Amount</span>
              </div>
              {lineItems.map((item) => (
                <div
                  key={item._id}
                  className="grid grid-cols-[minmax(0,1fr)_80px_120px] border-b border-[#f2f2f7] px-3 py-3 text-sm last:border-b-0"
                >
                  <span className="min-w-0 truncate">{item.description}</span>
                  <span>{item.quantity}</span>
                  <span className="text-right font-medium">
                    {formatMoney(item.lineTotal, currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <div className="w-full max-w-[260px]">
                <div className="flex justify-between text-sm text-[#6e6e73]">
                  <span>Subtotal</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-[#e5e5ea] pt-3 text-xl font-medium text-[#1d1d1f]">
                  <span>Total</span>
                  <span>{formatMoney(total, currency)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 rounded-md border border-[#e5e5ea] bg-[#fbfbfd] p-4 text-sm text-[#424245]">
              <p>
                <span className="font-medium text-[#1d1d1f]">Terms:</span>{" "}
                {snapshot?.terms ?? invoice.terms ?? "Due on receipt."}
              </p>
              <p>
                <span className="font-medium text-[#1d1d1f]">Payment:</span>{" "}
                {snapshot?.paymentInstructions ??
                  invoice.paymentInstructions ??
                  "Use the payment method agreed with the sender."}
              </p>
              {(snapshot?.notes ?? invoice.notes) ? (
                <p>{snapshot?.notes ?? invoice.notes}</p>
              ) : null}
            </div>
          </div>
        </article>

        <aside className="grid h-max gap-3 rounded-lg border border-[#e5e5ea] bg-white p-4">
          <div>
            <p className="text-sm font-medium text-[#1d1d1f]">Invoice actions</p>
            <p className="mt-1 text-sm text-[#6e6e73]">
              Approve if the invoice is correct. Reject if it needs changes.
              Payment remains separate and is tracked by the sender.
            </p>
          </div>

          {notice ? (
            <p className="rounded-md border border-[#b8d9ff] bg-[#f0f7ff] p-3 text-sm text-[#004b9b]">
              {notice}
            </p>
          ) : null}

          <Button
            type="button"
            disabled={
              pending ||
              rejecting ||
              invoice.status === "approved" ||
              invoice.status === "awaiting_payment" ||
              invoice.status === "rejected" ||
              invoice.status === "paid"
            }
            className="h-10 bg-[#0071e3] text-white hover:bg-[#005bb5] hover:text-white"
            onClick={handleApprove}
          >
            {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {invoice.status === "approved" ||
            invoice.status === "awaiting_payment" ||
            invoice.status === "paid"
              ? "Invoice approved"
              : invoice.status === "rejected"
                ? "Invoice rejected"
              : "Approve invoice"}
          </Button>

          {invoice.status === "rejected" ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {invoice.rejectionReason ??
                "You rejected this invoice. The sender will amend it and send it back."}
            </div>
          ) : null}

          {invoice.status !== "approved" &&
          invoice.status !== "awaiting_payment" &&
          invoice.status !== "rejected" &&
          invoice.status !== "paid" ? (
            <div className="grid gap-2">
              <label
                htmlFor="rejection-reason"
                className="text-xs font-medium text-[#424245]"
              >
                Rejection reason
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Tell the sender what needs to change."
                className="min-h-24 resize-none rounded-md border border-[#e5e5ea] bg-[#fbfbfd] p-3 text-sm outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending || rejecting}
                className="h-10 border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                onClick={handleReject}
              >
                {rejecting ? <Loader2 className="animate-spin" /> : <XCircle />}
                Reject and request changes
              </Button>
            </div>
          ) : null}

          {(snapshot?.paymentLink ?? invoice.paymentLink) ? (
            <Button
              asChild
              variant="outline"
              className="h-10 border-[#e5e5ea] bg-white"
            >
              <a
                href={snapshot?.paymentLink ?? invoice.paymentLink}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink />
                Open payment link
              </a>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="h-10 border-[#e5e5ea] bg-white"
            onClick={() => window.print()}
          >
            <Download />
            Download / print
          </Button>

          <a
            href={`mailto:?subject=${encodeURIComponent(`${invoiceNumber} question`)}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#e5e5ea] bg-white px-4 text-sm font-medium transition-colors hover:bg-[#f2f2f7]"
          >
            <Mail className="size-4" />
            Contact sender
          </a>

          <div className="mt-2 rounded-md bg-[#f5f5f7] p-3 text-xs text-[#6e6e73]">
            This secure link does not create a login. The sender marks the
            invoice paid only after payment is received.
          </div>
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
      <p className="text-xs text-[#6e6e73]">{label}</p>
      <p className="mt-1 font-medium text-[#1d1d1f]">{value}</p>
      {detail ? <p className="text-xs text-[#6e6e73]">{detail}</p> : null}
    </div>
  );
}
