"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal,
  ReceiptText,
  Search,
  Send,
  Trash2,
  WalletCards,
  XCircle,
} from "@/app/_components/IconPack";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Invoice = Doc<"invoices">;
type Client = Doc<"clients">;
type InvoiceEvent = Doc<"invoiceEvents">;
type InvoiceLineItem = Doc<"invoiceLineItems">;
type PaymentProof = Doc<"paymentProofs">;
type InvoiceStatus = Invoice["status"];
type ViewFilter = "all" | "paid" | "overdue" | "pending" | "draft";
type SortKey = "created" | "due";

type InvoiceRow = {
  invoice: Invoice;
  client: Client | null;
  events: InvoiceEvent[];
  lineItems: InvoiceLineItem[];
  paymentProofs?: PaymentProof[];
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

function isActiveInvoice(status: InvoiceStatus) {
  return ["sent", "viewed", "approved", "awaiting_payment", "overdue"].includes(status);
}

function isDraftInvoice(status: InvoiceStatus) {
  return status === "draft" || status === "ready";
}

function isPendingInvoice(status: InvoiceStatus) {
  return ["sent", "viewed", "approved", "awaiting_payment", "rejected"].includes(status);
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

function dateValue(value?: string, fallbackTime = 0) {
  if (!value) {
    return fallbackTime;
  }

  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? fallbackTime : time;
}

function metricPercent(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

function buildInvoiceEmail(invoice: Invoice, invoiceUrl: string, senderName: string) {
  const clientName = invoice.clientName ?? invoice.client ?? "there";
  const subject = `${invoice.invoiceNumber} from ${senderName}`;
  const body = [
    `Hi ${clientName},`,
    "",
    `Please review ${invoice.invoiceNumber}:`,
    invoiceUrl,
    "",
    "Thanks,",
    senderName,
  ].join("\n");
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: invoice.clientEmail ?? "",
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function DashboardPage() {
  const overview = useQuery(api.invoices.dashboardOverview);
  const invoiceRows = overview?.rows;
  const stats = overview?.stats;
  const workspace = overview?.workspace;
  const sendInvoice = useMutation(api.invoices.send);
  const markSent = useMutation(api.invoices.markSent);
  const markPaid = useMutation(api.invoices.markPaid);
  const scheduleReminder = useMutation(api.invoices.scheduleReminder);
  const updateStatus = useMutation(api.invoices.updateStatus);
  const voidInvoice = useMutation(api.invoices.voidInvoice);
  const reviewPaymentProof = useMutation(api.invoices.reviewPaymentProof);

  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(() => new Set());
  const [pendingAction, setPendingAction] = useState("");
  const [notice, setNotice] = useState("");

  const rows = useMemo(() => (invoiceRows ?? []) as InvoiceRow[], [invoiceRows]);
  const currency = workspace?.defaultCurrency ?? "NAD";

  const filteredRows = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    const matchesView = (invoice: Invoice) => {
      if (activeView === "paid") {
        return invoice.status === "paid";
      }

      if (activeView === "overdue") {
        return invoice.status === "overdue";
      }

      if (activeView === "pending") {
        return isPendingInvoice(invoice.status);
      }

      if (activeView === "draft") {
        return isDraftInvoice(invoice.status);
      }

      return true;
    };

    return rows
      .filter(({ invoice }) => {
        if (!matchesView(invoice)) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          invoice.invoiceNumber,
          invoice.clientName,
          invoice.client,
          invoice.clientEmail,
          invoice.issueDate,
          invoice.dueDate,
          statusLabels[invoice.status],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        const aValue =
          sortBy === "due"
            ? dateValue(a.invoice.dueDate, a.invoice.createdAt)
            : dateValue(a.invoice.issueDate, a.invoice.createdAt);
        const bValue =
          sortBy === "due"
            ? dateValue(b.invoice.dueDate, b.invoice.createdAt)
            : dateValue(b.invoice.issueDate, b.invoice.createdAt);

        return bValue - aValue;
      });
  }, [activeView, invoiceSearch, rows, sortBy]);

  const paidCount = rows.filter(({ invoice }) => invoice.status === "paid").length;
  const overdueRows = rows.filter(({ invoice }) => invoice.status === "overdue");
  const draftRows = rows.filter(({ invoice }) => isDraftInvoice(invoice.status));
  const pendingRows = rows.filter(({ invoice }) => isPendingInvoice(invoice.status));
  const unpaidRows = rows.filter(({ invoice }) => invoice.status !== "paid" && invoice.status !== "void");

  const tabs: { id: ViewFilter; label: string; count: number; tone: string }[] = [
    { id: "all", label: "All Invoice", count: rows.length, tone: "bg-muted text-foreground" },
    { id: "paid", label: "Paid", count: stats?.paidCount ?? paidCount, tone: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-1 dark:ring-teal-400/20" },
    { id: "overdue", label: "Overdue", count: stats?.overdueCount ?? overdueRows.length, tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200 dark:ring-1 dark:ring-red-400/20" },
    { id: "pending", label: "Pending", count: pendingRows.length, tone: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-1 dark:ring-amber-300/20" },
    { id: "draft", label: "Draft", count: draftRows.length, tone: "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-200 dark:ring-1 dark:ring-orange-300/20" },
  ];

  async function handleSend(invoice: Invoice) {
    setPendingAction(`send-${invoice._id}`);
    setNotice("");
    const emailWindow = window.open("", "_blank");
    try {
      const result = await sendInvoice({ id: invoice._id });
      const link = `${window.location.origin}${result.urlPath}`;
      if (emailWindow) {
        emailWindow.location.href = buildInvoiceEmail(invoice, link, workspace?.name ?? "Payvio");
      }
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // The email window still contains the link.
      }
      setNotice("Client link prepared.");
    } catch (error) {
      emailWindow?.close();
      setNotice(error instanceof Error ? error.message : "Unable to prepare invoice.");
    } finally {
      setPendingAction("");
    }
  }

  async function runInvoiceAction(action: string, callback: () => Promise<unknown>, message: string) {
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

  const overdueTotal = overdueRows.reduce((total, { invoice }) => total + invoiceBalance(invoice), 0);
  const draftTotalAmount = draftRows.reduce((total, { invoice }) => total + invoiceTotal(invoice), 0);
  const unpaidTotal = unpaidRows.reduce((total, { invoice }) => total + invoiceBalance(invoice), 0);
  const paidTotal = stats?.totalPaid ?? rows.reduce(
    (total, { invoice }) => total + (invoice.status === "paid" ? invoiceTotal(invoice) : 0),
    0,
  );
  const pipelineTotal = Math.max(paidTotal + unpaidTotal, 0);
  const invoiceTotalBase = Math.max(pipelineTotal, draftTotalAmount, 1);
  const outstandingBase = Math.max(unpaidTotal, 1);

  const metricCards = [
    {
      label: "Overdue amount",
      value: formatMoney(overdueTotal, currency),
      icon: WalletCards,
      iconClassName: "bg-amber-50 text-amber-500 dark:bg-amber-400/15 dark:text-amber-200",
      barClassName: "bg-amber-400 dark:bg-amber-300",
      progress: metricPercent(overdueTotal, outstandingBase),
    },
    {
      label: "Drafted totals",
      value: formatMoney(draftTotalAmount, currency),
      icon: FileText,
      iconClassName: "bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-neutral-200",
      barClassName: "bg-neutral-900 dark:bg-neutral-500",
      progress: metricPercent(draftTotalAmount, invoiceTotalBase),
    },
    {
      label: "Unpaid totals",
      value: formatMoney(unpaidTotal || stats?.totalOutstanding || 0, currency),
      icon: ReceiptText,
      iconClassName: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-200",
      barClassName: "bg-red-600 dark:bg-red-400",
      progress: metricPercent(unpaidTotal || stats?.totalOutstanding || 0, invoiceTotalBase),
    },
    {
      label: "Paid totals",
      value: formatMoney(paidTotal, currency),
      icon: CheckCircle2,
      iconClassName: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-200",
      barClassName: "bg-teal-600 dark:bg-teal-400",
      progress: metricPercent(paidTotal, invoiceTotalBase),
    },
  ];

  const visibleInvoiceIds = filteredRows.map(({ invoice }) => invoice._id);
  const allVisibleSelected =
    visibleInvoiceIds.length > 0 && visibleInvoiceIds.every((id) => selectedInvoiceIds.has(id));

  function toggleInvoiceSelection(id: string, checked: boolean) {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedInvoiceIds((current) => {
      const next = new Set(current);

      visibleInvoiceIds.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });

      return next;
    });
  }

  return (
    <div className="invoice-list-page space-y-4 sm:space-y-[30px]">
      <section className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="min-h-[112px] rounded-lg border border-border bg-card p-3.5 shadow-none sm:min-h-[156px] sm:p-[30px] xl:h-[156px]"
            >
              <div className="flex items-start justify-between gap-3 sm:gap-6">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold leading-tight tracking-normal text-foreground sm:text-[30px] sm:leading-none">
                    {metric.value}
                  </p>
                  <p className="mt-1 truncate text-xs leading-4 text-muted-foreground sm:mt-2 sm:text-[20px] sm:leading-6">{metric.label}</p>
                </div>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg sm:size-[60px]", metric.iconClassName)}>
                  <Icon className="size-5 sm:size-7" />
                </span>
              </div>
              <div className="mt-3 h-1 rounded-full bg-muted sm:mt-[27px]">
                <div
                  className={cn("h-full rounded-full", metric.barClassName)}
                  style={{ width: `${metric.progress}%` }}
                />
              </div>
            </article>
          );
        })}
      </section>

      {notice ? (
        <Card className="rounded-lg bg-background">
          <CardContent className="py-3 text-sm text-muted-foreground">{notice}</CardContent>
        </Card>
      ) : null}

      <section className="rounded-none border-0 bg-transparent p-0 shadow-none sm:min-h-[560px] sm:rounded-lg sm:border sm:border-border sm:bg-card sm:p-[30px]">
        <div className="flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-center xl:justify-between">
          <Tabs value={activeView} onValueChange={(value) => setActiveView(value as ViewFilter)} className="min-w-0">
            <TabsList className="flex h-auto w-full max-w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 pb-1 [scrollbar-width:none] sm:flex-wrap sm:gap-x-9 sm:gap-y-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="h-10 min-w-fit flex-none gap-2 rounded-lg px-3 text-sm text-muted-foreground after:hidden data-active:bg-muted data-active:text-foreground data-active:shadow-none sm:h-12 sm:gap-3 sm:px-4 sm:text-base"
                >
                  <span className="whitespace-nowrap">{tab.label}</span>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold sm:size-9 sm:text-base", tab.tone)}>
                    {tab.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button asChild className="hidden h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white sm:inline-flex">
            <Link href="/dashboard/invoices/create" className="whitespace-nowrap">
              New invoice
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-[30px] lg:flex lg:items-center">
          <label className="relative col-span-2 w-full lg:max-w-[304px]" htmlFor="invoice-search">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="invoice-search"
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              placeholder="Search bill..."
              className="h-11 rounded-lg border-border bg-background pl-12 text-sm shadow-sm sm:text-base"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 min-w-0 rounded-lg px-3 text-sm sm:h-11 sm:px-4 sm:text-base", sortBy === "created" && "bg-muted text-foreground")}
            onClick={() => setSortBy("created")}
          >
            <CalendarDays className="size-4" />
            <span className="truncate">Created Date</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 min-w-0 rounded-lg px-3 text-sm sm:h-11 sm:px-4 sm:text-base", sortBy === "due" && "bg-muted text-foreground")}
            onClick={() => setSortBy("due")}
          >
            <CalendarDays className="size-4" />
            <span className="truncate">Due Date</span>
          </Button>
        </div>

        <div className="mt-4 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin] lg:mt-8 lg:max-h-[430px] lg:overflow-y-auto lg:pr-1">
          {filteredRows.length > 0 ? (
            <>
            <div className="grid gap-3 lg:hidden">
              {filteredRows.map((row) => (
                <InvoiceMobileCard
                  key={row.invoice._id}
                  row={row}
                  currency={currency}
                  pendingAction={pendingAction}
                  onSend={handleSend}
                  onMarkSent={(id) =>
                    runInvoiceAction(`sent-${id}`, () => markSent({ id }), "Invoice marked sent.")
                  }
                  onMarkPaid={(id) =>
                    runInvoiceAction(`paid-${id}`, () => markPaid({ id }), "Invoice marked paid.")
                  }
                  onReminder={(id) =>
                    runInvoiceAction(
                      `reminder-${id}`,
                      () => scheduleReminder({ id }),
                      "Reminder scheduled.",
                    )
                  }
                  onOverdue={(id) =>
                    runInvoiceAction(
                      `overdue-${id}`,
                      () => updateStatus({ id, status: "overdue" }),
                      "Invoice marked overdue.",
                    )
                  }
                  onVoid={(id) =>
                    runInvoiceAction(
                      `void-${id}`,
                      () => voidInvoice({ id, reason: "Voided from invoice list." }),
                      "Invoice voided.",
                    )
                  }
                  onAcceptProof={(proofId) =>
                    runInvoiceAction(
                      `proof-accept-${proofId}`,
                      () => reviewPaymentProof({ proofId, status: "accepted" }),
                      "Payment confirmed.",
                    )
                  }
                  onRejectProof={(proofId) =>
                    runInvoiceAction(
                      `proof-reject-${proofId}`,
                      () => reviewPaymentProof({ proofId, status: "rejected" }),
                      "Payment proof rejected.",
                    )
                  }
                />
              ))}
            </div>
            <Table className="hidden table-fixed text-base lg:table">
              <colgroup>
                <col className="w-11" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[132px]" />
              </colgroup>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="px-3">
                    <Checkbox
                      aria-label="Select visible invoices"
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) => toggleVisibleSelection(checked === true)}
                      className="border-border bg-background"
                    />
                  </TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Id</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Bill From</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Bill To</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Total Cost</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Status</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Created</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Due</TableHead>
                  <TableHead className="h-14 px-3 text-center font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map(({ invoice, paymentProofs }) => {
                  const pendingProofCount = (paymentProofs ?? []).filter((proof) => proof.status === "submitted").length;
                  const invoiceCurrency = invoice.currency ?? currency;

                  return (
                    <TableRow key={invoice._id} className="h-[71px] border-border hover:bg-muted/40">
                      <TableCell className="px-3">
                        <Checkbox
                          aria-label={`Select ${invoice.invoiceNumber}`}
                          checked={selectedInvoiceIds.has(invoice._id)}
                          onCheckedChange={(checked) => toggleInvoiceSelection(invoice._id, checked === true)}
                          className="border-border bg-background"
                        />
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 font-medium text-foreground">
                        <span className="block truncate">{invoice.invoiceNumber}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-foreground">
                        <span className="block truncate">{workspace?.name ?? "Payvio"}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3">
                        <span className="block truncate text-foreground">{invoice.clientName ?? invoice.client ?? "Client"}</span>
                        {pendingProofCount > 0 ? (
                          <span className="mt-1 block text-xs text-muted-foreground">{pendingProofCount} proof pending</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-foreground">
                        <span className="block truncate">{formatMoney(invoiceTotal(invoice), invoiceCurrency)}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3">
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-foreground">
                        <span className="block truncate">{formatDate(invoice.issueDate, invoice.createdAt)}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-foreground">
                        <span className="block truncate">{formatDate(invoice.dueDate)}</span>
                      </TableCell>
                      <TableCell className="px-3">
                        <InvoiceActions
                          invoice={invoice}
                          paymentProofs={paymentProofs ?? []}
                          pendingAction={pendingAction}
                          onSend={handleSend}
                          onMarkSent={(id) =>
                            runInvoiceAction(`sent-${id}`, () => markSent({ id }), "Invoice marked sent.")
                          }
                          onMarkPaid={(id) =>
                            runInvoiceAction(`paid-${id}`, () => markPaid({ id }), "Invoice marked paid.")
                          }
                          onReminder={(id) =>
                            runInvoiceAction(
                              `reminder-${id}`,
                              () => scheduleReminder({ id }),
                              "Reminder scheduled.",
                            )
                          }
                          onOverdue={(id) =>
                            runInvoiceAction(
                              `overdue-${id}`,
                              () => updateStatus({ id, status: "overdue" }),
                              "Invoice marked overdue.",
                            )
                          }
                          onVoid={(id) =>
                            runInvoiceAction(
                              `void-${id}`,
                              () => voidInvoice({ id, reason: "Voided from invoice list." }),
                              "Invoice voided.",
                            )
                          }
                          onAcceptProof={(proofId) =>
                            runInvoiceAction(
                              `proof-accept-${proofId}`,
                              () => reviewPaymentProof({ proofId, status: "accepted" }),
                              "Payment confirmed.",
                            )
                          }
                          onRejectProof={(proofId) =>
                            runInvoiceAction(
                              `proof-reject-${proofId}`,
                              () => reviewPaymentProof({ proofId, status: "rejected" }),
                              "Payment proof rejected.",
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-lg border border-dashed p-6 text-center sm:p-8">
              <div>
                <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">No invoices here</h3>
                <p className="mt-1 text-sm text-muted-foreground">Create a draft to start the pipeline.</p>
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function InvoiceMobileCard({
  row,
  currency,
  pendingAction,
  onSend,
  onMarkSent,
  onMarkPaid,
  onReminder,
  onOverdue,
  onVoid,
  onAcceptProof,
  onRejectProof,
}: {
  row: InvoiceRow;
  currency: string;
  pendingAction: string;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (id: Id<"invoices">) => void;
  onMarkPaid: (id: Id<"invoices">) => void;
  onReminder: (id: Id<"invoices">) => void;
  onOverdue: (id: Id<"invoices">) => void;
  onVoid: (id: Id<"invoices">) => void;
  onAcceptProof: (id: Id<"paymentProofs">) => void;
  onRejectProof: (id: Id<"paymentProofs">) => void;
}) {
  const { invoice, paymentProofs } = row;
  const invoiceCurrency = invoice.currency ?? currency;
  const pendingProofCount = (paymentProofs ?? []).filter((proof) => proof.status === "submitted").length;
  const clientName = invoice.clientName ?? invoice.client ?? "Client";

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/invoices/${invoice._id}`}
            className="block truncate text-base font-semibold text-foreground"
          >
            {invoice.invoiceNumber}
          </Link>
          <p className="mt-1 truncate text-sm text-muted-foreground">{clientName}</p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {formatMoney(invoiceTotal(invoice), invoiceCurrency)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {formatMoney(invoiceBalance(invoice), invoiceCurrency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="mt-1 truncate text-sm text-foreground">{formatDate(invoice.issueDate, invoice.createdAt)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs text-muted-foreground">Due</p>
          <p className="mt-1 truncate text-sm text-foreground">{formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      {pendingProofCount > 0 ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {pendingProofCount} payment proof pending
        </p>
      ) : null}

      <div className="mt-4">
        <InvoiceActions
          invoice={invoice}
          paymentProofs={paymentProofs ?? []}
          pendingAction={pendingAction}
          display="mobile"
          onSend={onSend}
          onMarkSent={onMarkSent}
          onMarkPaid={onMarkPaid}
          onReminder={onReminder}
          onOverdue={onOverdue}
          onVoid={onVoid}
          onAcceptProof={onAcceptProof}
          onRejectProof={onRejectProof}
        />
      </div>
    </article>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const tone: Record<InvoiceStatus, string> = {
    draft: "bg-orange-50 text-orange-600 dark:bg-orange-400/15 dark:text-orange-200",
    ready: "bg-orange-50 text-orange-600 dark:bg-orange-400/15 dark:text-orange-200",
    sent: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-200",
    viewed: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-200",
    approved: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
    awaiting_payment: "bg-amber-50 text-amber-600 dark:bg-amber-400/15 dark:text-amber-200",
    rejected: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-200",
    paid: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
    overdue: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-200",
    void: "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300",
  };

  return (
    <Badge className={cn("h-6 rounded-full border-0 px-3 text-sm font-semibold", tone[status])}>
      {statusLabels[status]}
    </Badge>
  );
}

function InvoiceActions({
  invoice,
  paymentProofs,
  pendingAction,
  onSend,
  onMarkSent,
  onMarkPaid,
  onReminder,
  onOverdue,
  onVoid,
  onAcceptProof,
  onRejectProof,
  display = "icon",
}: {
  invoice: Invoice;
  paymentProofs: PaymentProof[];
  pendingAction: string;
  display?: "icon" | "mobile";
  onSend: (invoice: Invoice) => void;
  onMarkSent: (id: Id<"invoices">) => void;
  onMarkPaid: (id: Id<"invoices">) => void;
  onReminder: (id: Id<"invoices">) => void;
  onOverdue: (id: Id<"invoices">) => void;
  onVoid: (id: Id<"invoices">) => void;
  onAcceptProof: (id: Id<"paymentProofs">) => void;
  onRejectProof: (id: Id<"paymentProofs">) => void;
}) {
  const pendingProof = paymentProofs.find((proof) => proof.status === "submitted") ?? null;
  const sending = pendingAction === `send-${invoice._id}`;
  const reviewing = pendingProof
    ? pendingAction === `proof-accept-${pendingProof._id}` || pendingAction === `proof-reject-${pendingProof._id}`
    : false;
  const clientHref = invoice.publicToken ? `/invoice/${invoice.publicToken}` : "";
  const canSend = isDraftInvoice(invoice.status);
  const canRemind = isActiveInvoice(invoice.status);
  const canVoid = invoice.status !== "paid" && invoice.status !== "void";
  const QuickIcon = pendingProof ? CheckCircle2 : canSend ? Send : canRemind ? Bell : Banknote;
  const quickLabel = pendingProof ? "Confirm payment" : canSend ? "Prepare email" : canRemind ? "Send reminder" : "Mark paid";
  const quickDisabled = !pendingProof && !canSend && !canRemind && invoice.status === "paid";
  const mobileQuickLabel = pendingProof ? "Confirm" : canSend ? "Send" : canRemind ? "Remind" : "Mark paid";

  function runQuickAction() {
    if (pendingProof) {
      onAcceptProof(pendingProof._id);
      return;
    }

    if (canSend) {
      onSend(invoice);
      return;
    }

    if (canRemind) {
      onReminder(invoice._id);
      return;
    }

    if (invoice.status !== "paid") {
      onMarkPaid(invoice._id);
    }
  }

  function renderMoreMenu(triggerClassName: string) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`More actions for ${invoice.invoiceNumber}`}
            className={triggerClassName}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {pendingProof ? (
            <>
              <DropdownMenuItem onSelect={() => onAcceptProof(pendingProof._id)}>
                <CheckCircle2 className="size-4" />
                Confirm payment
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onRejectProof(pendingProof._id)}>
                <XCircle className="size-4" />
                Reject proof
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {canSend ? (
            <DropdownMenuItem onSelect={() => onSend(invoice)}>
              <Send className="size-4" />
              Prepare email
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/invoices/${invoice._id}`}>
              <FileText className="size-4" />
              View details
            </Link>
          </DropdownMenuItem>
          {clientHref ? (
            <DropdownMenuItem asChild>
              <a href={clientHref} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Client view
              </a>
            </DropdownMenuItem>
          ) : null}
          {invoice.publicToken && canSend ? (
            <DropdownMenuItem onSelect={() => onMarkSent(invoice._id)}>
              <Send className="size-4" />
              Mark sent
            </DropdownMenuItem>
          ) : null}
          {canRemind ? (
            <>
              <DropdownMenuItem onSelect={() => onReminder(invoice._id)}>
                <Bell className="size-4" />
                Remind
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMarkPaid(invoice._id)}>
                <Banknote className="size-4" />
                Mark paid
              </DropdownMenuItem>
            </>
          ) : null}
          {invoice.status === "sent" || invoice.status === "viewed" ? (
            <DropdownMenuItem onSelect={() => onOverdue(invoice._id)}>
              <Clock className="size-4" />
              Mark overdue
            </DropdownMenuItem>
          ) : null}
          {canVoid ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onVoid(invoice._id)}>
                <Trash2 className="size-4" />
                Void invoice
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (display === "mobile") {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2">
        <Button
          type="button"
          variant="ghost"
          aria-label={`${quickLabel} for ${invoice.invoiceNumber}`}
          className={cn(
            "h-11 min-w-0 justify-center rounded-lg px-3 text-sm font-semibold",
            pendingProof
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25"
              : "bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-500/15 dark:text-teal-200 dark:hover:bg-teal-500/25",
          )}
          disabled={quickDisabled || sending || reviewing}
          onClick={runQuickAction}
        >
          {sending || reviewing ? <Loader2 className="size-4 animate-spin" /> : <QuickIcon className="size-4" />}
          <span className="truncate">{mobileQuickLabel}</span>
        </Button>

        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={`Open invoice details for ${invoice.invoiceNumber}`}
          className="size-11 rounded-lg bg-neutral-100 text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15 dark:hover:text-white"
        >
          <Link href={`/dashboard/invoices/${invoice._id}`}>
            <Eye className="size-4" />
          </Link>
        </Button>

        {renderMoreMenu("size-11 rounded-lg bg-muted text-foreground hover:bg-neutral-200 hover:text-foreground dark:hover:bg-white/10")}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${quickLabel} for ${invoice.invoiceNumber}`}
        className={cn(
          "size-9 rounded-full text-teal-600 hover:bg-teal-100 hover:text-teal-700 dark:hover:bg-teal-500/25",
          pendingProof
            ? "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25"
            : "bg-teal-50 dark:bg-teal-500/15 dark:text-teal-200",
        )}
        disabled={quickDisabled || sending || reviewing}
        onClick={runQuickAction}
      >
        {sending || reviewing ? <Loader2 className="size-4 animate-spin" /> : <QuickIcon className="size-4" />}
      </Button>

      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label={`Open invoice details for ${invoice.invoiceNumber}`}
        className="size-9 rounded-full bg-neutral-100 text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/15 dark:hover:text-white"
      >
        <Link href={`/dashboard/invoices/${invoice._id}`}>
          <Eye className="size-4" />
        </Link>
      </Button>

      {renderMoreMenu("size-9 rounded-full bg-muted text-foreground hover:bg-neutral-200 hover:text-foreground dark:hover:bg-white/10")}
    </div>
  );
}
