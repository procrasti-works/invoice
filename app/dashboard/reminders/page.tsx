"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  MailCheck,
  Phone,
  Search,
  Users,
  WalletCards,
} from "@/app/_components/IconPack";
import type { LucideIcon } from "@/app/_components/IconPack";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type Invoice = Doc<"invoices">;
type Client = Doc<"clients">;
type Reminder = Doc<"reminders">;
type ReminderRow = {
  invoice: Invoice;
  client: Client | null;
  reminders: Reminder[];
};
type ReminderKind = "reminder" | "overdue";
type ViewFilter = "all" | "overdue" | "active" | "scheduled";
type SortKey = "due" | "last";

const statusLabels: Record<Invoice["status"], string> = {
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

function formatCount(value: number) {
  return new Intl.NumberFormat("en-NA").format(value);
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

function formatDueDate(value?: string) {
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

function formatReminderDate(timestamp?: number) {
  if (!timestamp) {
    return "Not sent";
  }

  return new Intl.DateTimeFormat("en-NA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function dateValue(value?: string, fallbackTime = 0) {
  if (!value) {
    return fallbackTime;
  }

  const time = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? fallbackTime : time;
}

function invoiceTotal(invoice: Invoice) {
  return invoice.balanceDue ?? invoice.total ?? invoice.amountTotal ?? invoice.amount ?? 0;
}

function rowClientName(row: ReminderRow) {
  return row.client?.name ?? row.invoice.clientName ?? row.invoice.client ?? "Client";
}

function rowClientEmail(row: ReminderRow) {
  return row.client?.email ?? row.invoice.clientEmail ?? "";
}

function rowClientPhone(row: ReminderRow) {
  return row.client?.phone ?? row.invoice.clientSnapshot?.phone ?? "";
}

function latestReminder(row: ReminderRow) {
  return row.reminders[0] ?? null;
}

function hasScheduledReminder(row: ReminderRow) {
  return row.reminders.some((reminder) => reminder.status === "scheduled");
}

function metricPercent(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

function gmailHref(to: string, subject: string, body: string) {
  const params = new URLSearchParams({
    body,
    fs: "1",
    su: subject,
    to,
    view: "cm",
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}

function buildFollowUpDraft(
  row: ReminderRow,
  invoiceUrl: string,
  senderName: string,
  kind: ReminderKind,
) {
  const { invoice } = row;
  const clientName = rowClientName(row);
  const amount = formatMoney(invoiceTotal(invoice), invoice.currency ?? "NAD");
  const subject =
    kind === "overdue"
      ? `Overdue invoice ${invoice.invoiceNumber}`
      : `Reminder: ${invoice.invoiceNumber}`;
  const body =
    kind === "overdue"
      ? [
          `Hi ${clientName},`,
          "",
          `${invoice.invoiceNumber} for ${amount} is now overdue.`,
          `You can review it here: ${invoiceUrl}`,
          "",
          "Please arrange payment or reply if anything needs attention.",
          "",
          "Thanks,",
          senderName,
        ].join("\n")
      : [
          `Hi ${clientName},`,
          "",
          `Reminder for ${invoice.invoiceNumber} for ${amount}, due ${invoice.dueDate}.`,
          `You can review it here: ${invoiceUrl}`,
          "",
          "Please approve it or reply with any questions.",
          "",
          "Thanks,",
          senderName,
        ].join("\n");

  return {
    body,
    gmailHref: gmailHref(rowClientEmail(row), subject, body),
    subject,
  };
}

export default function RemindersPage() {
  const { canAccess } = usePlan();
  const reminderRows = useQuery(api.invoices.listReminderQueue) as ReminderRow[] | undefined;
  const workspace = useQuery(api.invoices.workspace);
  const scheduleReminder = useMutation(api.invoices.scheduleReminder);
  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("due");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => reminderRows ?? [], [reminderRows]);
  const isLoading = reminderRows === undefined;
  const currency = workspace?.defaultCurrency ?? rows[0]?.invoice.currency ?? "NAD";
  const overdueRows = rows.filter(({ invoice }) => invoice.status === "overdue");
  const activeRows = rows.filter(({ invoice }) => invoice.status !== "overdue");
  const scheduledRows = rows.filter(hasScheduledReminder);
  const scheduledCount = rows.reduce(
    (total, row) =>
      total + row.reminders.filter((reminder) => reminder.status === "scheduled").length,
    0,
  );
  const linkedClientCount = rows.filter((row) => row.client !== null).length;
  const totalOutstanding = rows.reduce((total, { invoice }) => total + invoiceTotal(invoice), 0);
  const overdueTotal = overdueRows.reduce((total, { invoice }) => total + invoiceTotal(invoice), 0);
  const countBase = Math.max(rows.length, linkedClientCount, scheduledCount, 1);
  const amountBase = Math.max(totalOutstanding, overdueTotal, 1);
  const senderName =
    workspace?.tradingName?.trim() ||
    workspace?.legalName?.trim() ||
    workspace?.name?.trim() ||
    "Payvio";

  const tabs: { id: ViewFilter; label: string; count: number; tone: string }[] = [
    { id: "all", label: "All Reminders", count: rows.length, tone: "bg-muted text-foreground" },
    { id: "overdue", label: "Overdue", count: overdueRows.length, tone: "bg-red-100 text-red-700" },
    { id: "active", label: "Active", count: activeRows.length, tone: "bg-amber-100 text-amber-700" },
    { id: "scheduled", label: "Scheduled", count: scheduledRows.length, tone: "bg-teal-100 text-teal-700" },
  ];

  const metricCards = [
    {
      barClassName: "bg-amber-400",
      detail: "Ready to follow up",
      icon: Bell,
      iconClassName: "bg-amber-50 text-amber-500",
      label: "Open follow-ups",
      progress: metricPercent(rows.length, countBase),
      value: formatCount(rows.length),
    },
    {
      barClassName: "bg-red-600",
      detail: `${formatCount(overdueRows.length)} invoices past due`,
      icon: WalletCards,
      iconClassName: "bg-red-50 text-red-600",
      label: "Overdue amount",
      progress: metricPercent(overdueTotal, amountBase),
      value: formatMoney(overdueTotal, currency),
    },
    {
      barClassName: "bg-teal-600",
      detail: "Prepared follow-ups",
      icon: MailCheck,
      iconClassName: "bg-teal-50 text-teal-600",
      label: "Scheduled",
      progress: metricPercent(scheduledCount, countBase),
      value: formatCount(scheduledCount),
    },
    {
      barClassName: "bg-neutral-900",
      detail: "Saved client profiles",
      icon: Users,
      iconClassName: "bg-neutral-100 text-neutral-700",
      label: "Linked clients",
      progress: metricPercent(linkedClientCount, countBase),
      value: formatCount(linkedClientCount),
    },
  ];

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (activeView === "overdue" && row.invoice.status !== "overdue") {
          return false;
        }

        if (activeView === "active" && row.invoice.status === "overdue") {
          return false;
        }

        if (activeView === "scheduled" && !hasScheduledReminder(row)) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          row.invoice.invoiceNumber,
          row.invoice.dueDate,
          row.invoice.currency,
          statusLabels[row.invoice.status],
          rowClientName(row),
          rowClientEmail(row),
          rowClientPhone(row),
          formatMoney(invoiceTotal(row.invoice), row.invoice.currency ?? currency),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sortBy === "last") {
          return (latestReminder(b)?.createdAt ?? 0) - (latestReminder(a)?.createdAt ?? 0);
        }

        return dateValue(a.invoice.dueDate, a.invoice.createdAt) - dateValue(b.invoice.dueDate, b.invoice.createdAt);
      });
  }, [activeView, currency, rows, search, sortBy]);

  if (!canAccess("reminders")) {
    return <LockedPage feature="Reminders" requiredPlan="Starter" />;
  }

  async function handleReminder(row: ReminderRow, kind: ReminderKind) {
    const { invoice } = row;

    if (!invoice.publicToken) {
      setNotice("Prepare the invoice link before sending a reminder.");
      return;
    }

    setPending(`${kind}-${invoice._id}`);
    setNotice(null);
    const emailWindow = window.open("", "_blank");

    try {
      const link = `${window.location.origin}/invoice/${invoice.publicToken}`;
      const draft = buildFollowUpDraft(row, link, senderName, kind);

      await scheduleReminder({
        id: invoice._id,
        message:
          kind === "overdue"
            ? `Overdue notice prepared for ${rowClientName(row)}.`
            : `Reminder prepared for ${rowClientName(row)}.`,
      });

      if (emailWindow) {
        emailWindow.location.href = draft.gmailHref;
      }

      setNotice(
        kind === "overdue"
          ? `${invoice.invoiceNumber} overdue email opened.`
          : `${invoice.invoiceNumber} reminder email opened.`,
      );
    } catch (error) {
      emailWindow?.close();
      setNotice(error instanceof Error ? error.message : "Unable to prepare reminder.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="db-reminders-page invoice-list-page space-y-4 sm:space-y-[30px]">
      <section className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4" aria-label="Reminder metrics">
        {metricCards.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      {notice ? (
        <Card className="rounded-lg bg-background">
          <CardContent className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{notice}</span>
          </CardContent>
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
          <Button asChild className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white">
            <Link href="/dashboard/invoices/create" className="whitespace-nowrap">
              New invoice
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-[30px] lg:flex lg:items-center">
          <label className="relative col-span-2 w-full lg:max-w-[304px]" htmlFor="reminder-search">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reminder-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reminder..."
              className="h-11 rounded-lg border-border bg-background pl-12 text-sm shadow-sm sm:text-base"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 min-w-0 rounded-lg px-3 text-sm sm:h-11 sm:px-4 sm:text-base", sortBy === "due" && "bg-muted text-foreground")}
            onClick={() => setSortBy("due")}
          >
            <CalendarDays className="size-4" />
            <span className="truncate">Due Date</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 min-w-0 rounded-lg px-3 text-sm sm:h-11 sm:px-4 sm:text-base", sortBy === "last" && "bg-muted text-foreground")}
            onClick={() => setSortBy("last")}
          >
            <Clock className="size-4" />
            <span className="truncate">Last Reminder</span>
          </Button>
        </div>

        <div className="mt-4 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin] lg:mt-8 lg:max-h-[520px] lg:overflow-y-auto lg:pr-1">
          {isLoading ? (
            <ReminderLoadingRows />
          ) : filteredRows.length > 0 ? (
            <>
            <div className="grid gap-3 lg:hidden">
              {filteredRows.map((row) => (
                <ReminderMobileCard
                  key={row.invoice._id}
                  row={row}
                  pending={pending}
                  onSend={handleReminder}
                />
              ))}
            </div>
            <div className="hidden lg:block">
              <ReminderTable rows={filteredRows} pending={pending} onSend={handleReminder} />
            </div>
            </>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-lg border border-dashed p-6 text-center sm:p-8">
              <div>
                <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">No reminders here</h3>
                <p className="mt-1 text-sm text-muted-foreground">Sent and overdue invoices will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  barClassName,
  detail,
  icon: Icon,
  iconClassName,
  label,
  progress,
  value,
}: {
  barClassName: string;
  detail: string;
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  progress: number;
  value: string;
}) {
  return (
    <article className="min-h-[112px] rounded-lg border border-border bg-card p-3.5 shadow-none sm:min-h-[156px] sm:p-[30px] xl:h-[156px]">
      <div className="flex items-start justify-between gap-3 sm:gap-6">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold leading-tight tracking-normal text-foreground sm:text-[30px] sm:leading-none">
            {value}
          </p>
          <p className="mt-1 truncate text-xs leading-4 text-muted-foreground sm:mt-2 sm:text-[20px] sm:leading-6">{label}</p>
        </div>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg sm:size-[60px]", iconClassName)}>
          <Icon className="size-5 sm:size-7" />
        </span>
      </div>
      <div className="mt-3 h-1 rounded-full bg-muted sm:mt-[27px]">
        <div
          className={cn("h-full rounded-full", barClassName)}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="sr-only">{detail}</p>
    </article>
  );
}

function ReminderMobileCard({
  row,
  pending,
  onSend,
}: {
  row: ReminderRow;
  pending: string | null;
  onSend: (row: ReminderRow, kind: ReminderKind) => void;
}) {
  const { invoice } = row;
  const latest = latestReminder(row);
  const email = rowClientEmail(row);
  const phone = rowClientPhone(row);
  const amount = formatMoney(invoiceTotal(invoice), invoice.currency ?? "NAD");
  const kind: ReminderKind = invoice.status === "overdue" ? "overdue" : "reminder";
  const isPending = pending === `${kind}-${invoice._id}`;

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
          <p className="mt-1 truncate text-sm text-muted-foreground">{rowClientName(row)}</p>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{amount}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs text-muted-foreground">Due</p>
          <p className="mt-1 truncate text-sm text-foreground">{formatDueDate(invoice.dueDate)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Last</p>
          <p className="mt-1 truncate text-sm text-foreground">{formatReminderDate(latest?.createdAt)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs text-muted-foreground">Mode</p>
          <p className="mt-1 truncate text-sm text-foreground">
            {hasScheduledReminder(row) ? "Scheduled" : "Manual"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <Mail className="size-4 shrink-0" />
          <span className="truncate">{email || "No email"}</span>
        </span>
        {phone ? (
          <span className="flex min-w-0 items-center gap-2">
            <Phone className="size-4 shrink-0" />
            <span className="truncate">{phone}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-[44px_44px_minmax(0,1fr)] gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={`Open invoice details for ${invoice.invoiceNumber}`}
          className="size-11 rounded-lg bg-neutral-100 text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950"
        >
          <Link href={`/dashboard/invoices/${invoice._id}`}>
            <Eye className="size-4" />
          </Link>
        </Button>
        {invoice.publicToken ? (
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={`Open client view for ${invoice.invoiceNumber}`}
            className="size-11 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          >
            <a href={`/invoice/${invoice.publicToken}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${invoice.invoiceNumber} has no client link`}
            className="size-11 rounded-lg bg-muted text-muted-foreground"
            disabled
          >
            <ExternalLink className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          aria-label={`${kind === "overdue" ? "Prepare overdue email" : "Prepare reminder email"} for ${invoice.invoiceNumber}`}
          className={cn(
            "h-11 min-w-0 justify-center rounded-lg px-3 text-sm font-semibold",
            kind === "overdue"
              ? "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
              : "bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700",
          )}
          disabled={isPending}
          onClick={() => onSend(row, kind)}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
          <span className="truncate">{kind === "overdue" ? "Overdue" : "Remind"}</span>
        </Button>
      </div>
    </article>
  );
}

function ReminderTable({
  rows,
  pending,
  onSend,
}: {
  rows: ReminderRow[];
  pending: string | null;
  onSend: (row: ReminderRow, kind: ReminderKind) => void;
}) {
  return (
    <Table className="table-fixed text-base">
      <colgroup>
        <col className="w-[13%]" />
        <col className="w-[15%]" />
        <col className="w-[20%]" />
        <col className="w-[11%]" />
        <col className="w-[13%]" />
        <col className="w-[13%]" />
        <col className="w-[9%]" />
        <col className="w-[132px]" />
      </colgroup>
      <TableHeader className="sticky top-0 z-10 bg-card">
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Invoice</TableHead>
          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Client</TableHead>
          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Contact</TableHead>
          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Amount</TableHead>
          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Due</TableHead>
          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Last reminder</TableHead>
          <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Status</TableHead>
          <TableHead className="h-14 px-3 text-center font-semibold text-foreground">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const { invoice } = row;
          const latest = latestReminder(row);
          const email = rowClientEmail(row);
          const phone = rowClientPhone(row);
          const amount = formatMoney(invoiceTotal(invoice), invoice.currency ?? "NAD");
          const kind: ReminderKind = invoice.status === "overdue" ? "overdue" : "reminder";
          const isPending = pending === `${kind}-${invoice._id}`;

          return (
            <TableRow key={invoice._id} className="h-[71px] border-border hover:bg-muted/40">
              <TableCell className="overflow-hidden px-3 font-medium text-foreground">
                <span className="block truncate">{invoice.invoiceNumber}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {hasScheduledReminder(row) ? "Scheduled follow-up" : "Manual follow-up"}
                </span>
              </TableCell>
              <TableCell className="overflow-hidden px-3">
                <span className="block truncate text-foreground">{rowClientName(row)}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {row.client ? "Client profile" : "Invoice only"}
                </span>
              </TableCell>
              <TableCell className="overflow-hidden px-3">
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{email || "No email"}</span>
                </span>
                {phone ? (
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="size-3.5 shrink-0" />
                    <span className="truncate">{phone}</span>
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="overflow-hidden px-3 text-foreground">
                <span className="block truncate">{amount}</span>
              </TableCell>
              <TableCell className="overflow-hidden px-3 text-foreground">
                <span className="block truncate">{formatDueDate(invoice.dueDate)}</span>
              </TableCell>
              <TableCell className="overflow-hidden px-3 text-foreground">
                <span className="block truncate">{formatReminderDate(latest?.createdAt)}</span>
              </TableCell>
              <TableCell className="overflow-hidden px-3">
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="px-3">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    aria-label={`Open invoice details for ${invoice.invoiceNumber}`}
                    className="size-9 rounded-full bg-neutral-100 text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950"
                  >
                    <Link href={`/dashboard/invoices/${invoice._id}`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                  {invoice.publicToken ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      aria-label={`Open client view for ${invoice.invoiceNumber}`}
                      className="size-9 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                    >
                      <a href={`/invoice/${invoice.publicToken}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${kind === "overdue" ? "Prepare overdue email" : "Prepare reminder email"} for ${invoice.invoiceNumber}`}
                    className={cn(
                      "size-9 rounded-full hover:text-teal-700",
                      kind === "overdue"
                        ? "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                        : "bg-teal-50 text-teal-600 hover:bg-teal-100",
                    )}
                    disabled={isPending}
                    onClick={() => onSend(row, kind)}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  const tone: Record<Invoice["status"], string> = {
    approved: "bg-teal-50 text-teal-700",
    awaiting_payment: "bg-amber-50 text-amber-600",
    draft: "bg-orange-50 text-orange-600",
    overdue: "bg-red-50 text-red-600",
    paid: "bg-teal-50 text-teal-700",
    ready: "bg-orange-50 text-orange-600",
    rejected: "bg-red-50 text-red-600",
    sent: "bg-amber-50 text-amber-600",
    viewed: "bg-amber-50 text-amber-600",
    void: "bg-neutral-100 text-neutral-600",
  };

  return (
    <Badge className={cn("h-6 rounded-full border-0 px-3 text-sm font-semibold", tone[status])}>
      {statusLabels[status]}
    </Badge>
  );
}

function ReminderLoadingRows() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-[71px] rounded-lg border border-border bg-muted/60" />
      ))}
    </div>
  );
}
