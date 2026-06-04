"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  UserRound,
  WalletCards,
} from "@/app/_components/IconPack";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Client = Doc<"clients">;
type Workspace = Doc<"organizations">;
type TaxMode = "no_vat" | "vat_15" | "zero_rated" | "exempt";

type DraftLineItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const taxModeLabels: Record<TaxMode, string> = {
  no_vat: "No VAT",
  vat_15: "VAT 15%",
  zero_rated: "Zero-rated",
  exempt: "Exempt",
};

function defaultDueDate() {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10);
}

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

function lineAmount(item: DraftLineItem) {
  return Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0);
}

function newLineItem(index: number): DraftLineItem {
  return {
    id: `line-${Date.now()}-${index}`,
    description: "",
    quantity: "1",
    unitPrice: "0",
  };
}

export function CreateInvoicePage() {
  const router = useRouter();
  const workspace = useQuery(api.invoices.workspace) as Workspace | null | undefined;
  const clients = useQuery(api.invoices.listClients) as Client[] | undefined;
  const createDraft = useMutation(api.invoices.createDraft);
  const sendInvoice = useMutation(api.invoices.send);

  const [selectedClientId, setSelectedClientId] = useState("manual");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [currency, setCurrency] = useState("");
  const [taxMode, setTaxMode] = useState<TaxMode | "">("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [terms, setTerms] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [notes, setNotes] = useState("Thank you for your business.");
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([
    { id: "line-1", description: "Monthly service invoice", quantity: "1", unitPrice: "1250" },
  ]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  const activeClients = useMemo(
    () => (clients ?? []).filter((client) => client.active ?? true),
    [clients],
  );
  const defaultTaxMode = (workspace?.vatDefaultTaxMode ?? (workspace?.vatRegistered ? "vat_15" : "no_vat")) as TaxMode;
  const selectedTaxMode = (taxMode || defaultTaxMode) as TaxMode;
  const effectiveTaxMode = workspace?.vatRegistered ? selectedTaxMode : "no_vat";
  const effectiveCurrency = currency || workspace?.defaultCurrency || "NAD";
  const effectiveTerms = terms || workspace?.defaultTerms || "Payment due within 7 days unless otherwise agreed.";
  const effectivePaymentInstructions = paymentInstructions || workspace?.paymentInstructions || "";

  const subtotal = useMemo(
    () => lineItems.reduce((total, item) => total + lineAmount(item), 0),
    [lineItems],
  );
  const vatAmount = effectiveTaxMode === "vat_15" ? subtotal * 0.15 : 0;
  const total = subtotal + vatAmount;

  function applyClient(clientId: string) {
    setSelectedClientId(clientId);

    if (clientId === "manual") {
      return;
    }

    const client = activeClients.find((item) => item._id === clientId);

    if (!client) {
      return;
    }

    setClientName(client.name);
    setClientEmail(client.email);
    setClientPhone(client.phone ?? "");
    setClientAddress(client.address ?? "");
  }

  function updateLine(id: string, patch: Partial<DraftLineItem>) {
    setLineItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addLine() {
    setLineItems((current) => [...current, newLineItem(current.length + 1)]);
  }

  function removeLine(id: string) {
    setLineItems((current) => (current.length > 1 ? current.filter((item) => item.id !== id) : current));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");

    if (!clientName.trim()) {
      setNotice("Add a client name before creating the invoice.");
      return;
    }

    const cleanLineItems = lineItems
      .map((item) => ({
        description: item.description.trim() || "Invoice item",
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      }))
      .filter((item) => item.quantity > 0);

    if (cleanLineItems.length === 0) {
      setNotice("Add at least one invoice item.");
      return;
    }

    const billableTotal = cleanLineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    if (billableTotal <= 0) {
      setNotice("Add at least one billable item with an amount.");
      return;
    }

    setPending(true);
    try {
      const created = await createDraft({
        clientId: selectedClientId !== "manual" ? (selectedClientId as Id<"clients">) : undefined,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        dueDate,
        currency: effectiveCurrency,
        taxMode: effectiveTaxMode,
        terms: effectiveTerms.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentInstructions: effectivePaymentInstructions.trim() || undefined,
        requiresApproval,
        lineItems: cleanLineItems,
      });
      await sendInvoice({ id: created.id });
      router.push(`/dashboard/invoices/${created.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create invoice.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-[30px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Button asChild variant="outline" className="mb-4 h-10 rounded-lg px-4">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Invoice list
            </Link>
          </Button>
          <h1 className="text-[30px] font-semibold leading-tight tracking-normal text-foreground">Create invoice</h1>
          <p className="mt-1 text-base text-muted-foreground">{workspace?.name ?? "Workspace"}</p>
        </div>
      </div>

      {notice ? (
        <div className="rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          {notice}
        </div>
      ) : null}

      <form
        id="create-invoice-form"
        className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px]"
        onSubmit={handleCreate}
      >
          <section className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]">
            <div className="grid gap-8">
            <FormSection
              icon={<UserRound className="size-5" />}
              title="Bill to"
              description="Choose an existing client or enter billing details."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Field label="Client">
                  <Select value={selectedClientId} onValueChange={applyClient}>
                    <SelectTrigger className="h-11 w-full rounded-lg border-border bg-background text-base">
                      <SelectValue placeholder="Choose client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">New client</SelectItem>
                      {activeClients.map((client) => (
                        <SelectItem key={client._id} value={client._id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Name">
                  <Input
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    className="h-11 rounded-lg border-border bg-background text-base"
                    placeholder="Client name"
                    required
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    className="h-11 rounded-lg border-border bg-background text-base"
                    placeholder="client@email.com"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={clientPhone}
                    onChange={(event) => setClientPhone(event.target.value)}
                    className="h-11 rounded-lg border-border bg-background text-base"
                    placeholder="Optional"
                  />
                </Field>
                <Field className="lg:col-span-2" label="Address">
                  <Textarea
                    value={clientAddress}
                    onChange={(event) => setClientAddress(event.target.value)}
                    className="min-h-[88px] rounded-lg border-border bg-background text-base"
                    placeholder="Client billing address"
                  />
                </Field>
              </div>
            </FormSection>

            <Separator />

            <FormSection
              icon={<ReceiptText className="size-5" />}
              title="Invoice details"
              description="Set due date, currency, VAT, and approval."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Due date">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="h-11 rounded-lg border-border bg-background pl-10 text-base"
                    />
                  </div>
                </Field>
                <Field label="Currency">
                  <Input
                    value={effectiveCurrency}
                    onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))}
                    className="h-11 rounded-lg border-border bg-background text-base uppercase"
                    maxLength={3}
                  />
                </Field>
                <Field label="Tax">
                  <Select value={effectiveTaxMode} onValueChange={(value) => setTaxMode(value as TaxMode)}>
                    <SelectTrigger className="h-11 w-full rounded-lg border-border bg-background text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vat_15">VAT 15%</SelectItem>
                      <SelectItem value="zero_rated">Zero-rated</SelectItem>
                      <SelectItem value="exempt">Exempt</SelectItem>
                      <SelectItem value="no_vat">No VAT</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-sm">
                <Checkbox
                  checked={requiresApproval}
                  onCheckedChange={(checked) => setRequiresApproval(checked === true)}
                  className="mt-0.5 border-border bg-background"
                />
                <span>
                  <span className="block text-base font-semibold text-foreground">Client approval</span>
                  <span className="text-muted-foreground">Ask the client to approve before payment.</span>
                </span>
              </label>
            </FormSection>

            <Separator />

            <FormSection
              icon={<FileText className="size-5" />}
              title="Line items"
              description="Add the work, products, or services being billed."
            >
              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-lg border border-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_110px] xl:grid-cols-[minmax(0,1fr)_100px_150px_44px]"
                  >
                    <Field label={index === 0 ? "Description" : "Item"}>
                      <Input
                        value={item.description}
                        onChange={(event) => updateLine(item.id, { description: event.target.value })}
                        className="h-11 rounded-lg border-border bg-background text-base"
                        placeholder="Invoice item"
                      />
                    </Field>
                    <Field label="Qty">
                      <Input
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) => updateLine(item.id, { quantity: event.target.value })}
                        className="h-11 rounded-lg border-border bg-background text-base"
                      />
                    </Field>
                    <Field label="Unit price">
                      <Input
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) => updateLine(item.id, { unitPrice: event.target.value })}
                        className="h-11 rounded-lg border-border bg-background text-base"
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 rounded-lg sm:mt-6 xl:mt-6"
                      disabled={lineItems.length === 1}
                      aria-label="Remove line"
                      onClick={() => removeLine(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="h-11 rounded-lg px-4" onClick={addLine}>
                  <Plus className="size-4" />
                  Add item
                </Button>
              </div>
            </FormSection>

            <Separator />

            <FormSection
              icon={<WalletCards className="size-5" />}
              title="Payment and notes"
              description="Keep the message short and ready to send."
            >
              <div className="grid gap-4">
                <Field label="Terms">
                  <Input
                    value={effectiveTerms}
                    onChange={(event) => setTerms(event.target.value)}
                    className="h-11 rounded-lg border-border bg-background text-base"
                    placeholder="Payment due within 7 days"
                  />
                </Field>
                <Field label="Payment instructions">
                  <Textarea
                    value={effectivePaymentInstructions}
                    onChange={(event) => setPaymentInstructions(event.target.value)}
                    className="min-h-[96px] rounded-lg border-border bg-background text-base"
                    placeholder="Bank or payment details"
                  />
                </Field>
                <Field label="Notes">
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="min-h-[96px] rounded-lg border-border bg-background text-base"
                    placeholder="Optional note"
                  />
                </Field>
              </div>
            </FormSection>
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px] xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[22px] font-semibold leading-7 text-foreground">Invoice preview</p>
              <p className="text-sm text-muted-foreground">{effectiveCurrency}</p>
            </div>
            <span className="grid size-[60px] place-items-center rounded-lg bg-red-50 text-red-600">
              <ReceiptText className="size-7" />
            </span>
          </div>

          <div className="mt-8 space-y-5">
            <PreviewRow label="Bill from" value={workspace?.name ?? "Workspace"} />
            <PreviewRow label="Bill to" value={clientName || "Client"} detail={clientEmail || "No email"} />
            <PreviewRow label="Due" value={dueDate || "-"} />
          </div>

          <Separator className="my-7" />

          <div className="space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{item.description || "Invoice item"}</p>
                  <p className="text-muted-foreground">
                    {Number(item.quantity) || 0} x {formatMoney(Number(item.unitPrice) || 0, effectiveCurrency)}
                  </p>
                </div>
                <p className="shrink-0 font-medium text-foreground">{formatMoney(lineAmount(item), effectiveCurrency)}</p>
              </div>
            ))}
          </div>

          <Separator className="my-7" />

          <div className="space-y-3 text-sm">
            <SummaryRow label="Subtotal" value={formatMoney(subtotal, effectiveCurrency)} />
            <SummaryRow label={taxModeLabels[effectiveTaxMode]} value={formatMoney(vatAmount, effectiveCurrency)} />
            <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-base">
              <span className="font-semibold text-foreground">Total</span>
              <strong className="text-xl text-foreground">{formatMoney(total, effectiveCurrency)}</strong>
            </div>
          </div>

          <Button
            type="submit"
            form="create-invoice-form"
            className="mt-7 h-11 w-full rounded-lg bg-neutral-950 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Create invoice
          </Button>
          </aside>
        </form>
    </div>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground">{icon}</span>
        <div>
          <h2 className="text-lg font-semibold leading-6 text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label className="block truncate text-sm font-semibold text-foreground">{label}</Label>
      {children}
    </div>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <strong className="font-medium text-foreground">{value}</strong>
    </div>
  );
}
