"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ContactRound,
  Loader2,
  Mail,
  MailCheck,
  Phone,
  Plus,
  Save,
  Search,
  Users,
} from "@/app/_components/IconPack";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type Client = Doc<"clients">;
type Workspace = Doc<"organizations">;
type ViewFilter = "all" | "active" | "business" | "noContact" | "inactive";
type SortKey = "newest" | "name";

type ClientForm = {
  name: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  vatNumber: string;
  taxId: string;
  paymentTerms: string;
  notes: string;
  active: boolean;
};

const emptyForm: ClientForm = {
  name: "",
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  vatNumber: "",
  taxId: "",
  paymentTerms: "",
  notes: "",
  active: true,
};

const fieldClass = "h-11 rounded-lg border-border bg-background text-base shadow-sm";
const textAreaClass = "min-h-24 rounded-lg border-border bg-background text-base shadow-sm";

function cleanBusinessName(client: Client) {
  const name = client.name.trim();
  const businessName = (client.businessName ?? client.company ?? "").trim();

  return businessName && businessName !== name ? businessName : "";
}

function clientToForm(client: Client): ClientForm {
  return {
    name: client.name,
    businessName: cleanBusinessName(client),
    contactName: client.contactName ?? "",
    email: client.email,
    phone: client.phone ?? "",
    address: client.address ?? "",
    vatNumber: client.vatNumber ?? "",
    taxId: client.taxId ?? "",
    paymentTerms: client.paymentTerms ?? "",
    notes: client.notes ?? "",
    active: client.active ?? true,
  };
}

function workspaceName(workspace: Workspace | null | undefined) {
  return (
    workspace?.tradingName?.trim() ||
    workspace?.legalName?.trim() ||
    workspace?.name?.trim() ||
    "Workspace"
  );
}

function contactCount(client: Client) {
  return [client.email, client.phone].filter((value) => value?.trim()).length;
}

function formatDate(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function metricPercent(value: number, max: number) {
  if (max <= 0 || value <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

function clientInitial(client: Client) {
  return client.name.trim().slice(0, 1).toUpperCase() || "C";
}

function isActiveClient(client: Client) {
  return client.active ?? true;
}

function hasContact(client: Client) {
  return contactCount(client) > 0;
}

function matchesQuery(client: Client, query: string) {
  if (!query) {
    return true;
  }

  const values = [
    client.name,
    cleanBusinessName(client),
    client.contactName,
    client.email,
    client.phone,
    client.vatNumber,
    client.taxId,
    client.paymentTerms,
  ].filter((value): value is string => Boolean(value));

  return values.some((value) => value.toLowerCase().includes(query));
}

export default function ClientsPage() {
  const { canAccess } = usePlan();
  const workspace = useQuery(api.invoices.workspace) as Workspace | null | undefined;
  const clients = useQuery(api.invoices.listClients) as Client[] | undefined;
  const upsertClient = useMutation(api.invoices.upsertClient);
  const [activeView, setActiveView] = useState<ViewFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<Id<"clients"> | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const rows = useMemo(() => clients ?? [], [clients]);
  const loading = clients === undefined;
  const totalClients = rows.length;
  const activeClients = rows.filter(isActiveClient).length;
  const inactiveClients = totalClients - activeClients;
  const businessClients = rows.filter((client) => cleanBusinessName(client)).length;
  const reachableClients = rows.filter(hasContact).length;
  const currentWorkspace = workspaceName(workspace);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows
      .filter((client) => {
        if (activeView === "active" && !isActiveClient(client)) {
          return false;
        }

        if (activeView === "inactive" && isActiveClient(client)) {
          return false;
        }

        if (activeView === "business" && !cleanBusinessName(client)) {
          return false;
        }

        if (activeView === "noContact" && hasContact(client)) {
          return false;
        }

        return matchesQuery(client, query);
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }

        return b.createdAt - a.createdAt;
      });
  }, [activeView, rows, search, sortBy]);

  if (!canAccess("clients")) {
    return <LockedPage feature="Clients" requiredPlan="Starter" />;
  }

  const tabs: { id: ViewFilter; label: string; count: number; tone: string }[] = [
    { id: "all", label: "All Clients", count: totalClients, tone: "bg-muted text-foreground" },
    { id: "active", label: "Active", count: activeClients, tone: "bg-teal-100 text-teal-700" },
    { id: "business", label: "Business", count: businessClients, tone: "bg-amber-100 text-amber-700" },
    { id: "noContact", label: "No Contact", count: totalClients - reachableClients, tone: "bg-red-100 text-red-700" },
    { id: "inactive", label: "Inactive", count: inactiveClients, tone: "bg-neutral-100 text-neutral-700" },
  ];

  const metricCards = [
    {
      label: "Total clients",
      value: totalClients.toString(),
      detail: currentWorkspace,
      icon: Users,
      iconClassName: "bg-neutral-100 text-neutral-700",
      barClassName: "bg-neutral-900",
      progress: metricPercent(totalClients, Math.max(totalClients, 1)),
    },
    {
      label: "Active clients",
      value: activeClients.toString(),
      detail: `${inactiveClients} inactive`,
      icon: CheckCircle2,
      iconClassName: "bg-teal-50 text-teal-600",
      barClassName: "bg-teal-600",
      progress: metricPercent(activeClients, Math.max(totalClients, 1)),
    },
    {
      label: "Reachable",
      value: reachableClients.toString(),
      detail: "Email or phone saved",
      icon: MailCheck,
      iconClassName: "bg-amber-50 text-amber-600",
      barClassName: "bg-amber-400",
      progress: metricPercent(reachableClients, Math.max(totalClients, 1)),
    },
    {
      label: "Business profiles",
      value: businessClients.toString(),
      detail: "Company details saved",
      icon: Building2,
      iconClassName: "bg-red-50 text-red-600",
      barClassName: "bg-red-600",
      progress: metricPercent(businessClients, Math.max(totalClients, 1)),
    },
  ];

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDetails(false);
    setFormError("");
  }

  function openNewClient() {
    resetForm();
    setNotice(null);
    setDialogOpen(true);
  }

  function editClient(client: Client) {
    setEditingId(client._id);
    setForm(clientToForm(client));
    setShowDetails(true);
    setFormError("");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();

    if (!name) {
      setFormError("Client name is required.");
      return;
    }

    const wasEditing = editingId !== null;
    setPending(true);
    setNotice(null);
    setFormError("");

    try {
      await upsertClient({
        id: editingId ?? undefined,
        ...form,
        name,
      });
      closeDialog();
      setNotice(wasEditing ? "Client updated." : "Client added to this workspace.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save client.");
    } finally {
      setPending(false);
    }
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
                  <p className="mt-1 hidden truncate text-sm text-muted-foreground sm:block">{metric.detail}</p>
                </div>
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg sm:size-[60px]", metric.iconClassName)}>
                  <Icon className="size-5 sm:size-7" />
                </span>
              </div>
              <div className="mt-3 h-1 rounded-full bg-muted sm:mt-[23px]">
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
          <CardContent className="py-3 text-sm text-muted-foreground" aria-live="polite">
            {notice}
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
          <Button
            type="button"
            className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
            onClick={openNewClient}
          >
            <Plus className="size-5" />
            New client
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-[30px] lg:flex lg:items-center">
          <label className="relative col-span-2 w-full lg:max-w-[304px]" htmlFor="client-search">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="client-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients..."
              className="h-11 rounded-lg border-border bg-background pl-12 text-sm shadow-sm sm:text-base"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 min-w-0 rounded-lg px-3 text-sm sm:h-11 sm:px-4 sm:text-base", sortBy === "newest" && "bg-muted text-foreground")}
            onClick={() => setSortBy("newest")}
          >
            <CalendarDays className="size-4" />
            <span className="truncate">Newest</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn("h-10 min-w-0 rounded-lg px-3 text-sm sm:h-11 sm:px-4 sm:text-base", sortBy === "name" && "bg-muted text-foreground")}
            onClick={() => setSortBy("name")}
          >
            <Users className="size-4" />
            <span className="truncate">Name</span>
          </Button>
          <Badge variant="secondary" className="col-span-2 h-10 rounded-lg border-0 px-4 text-sm font-semibold sm:h-11 sm:text-base lg:ml-auto">
            {loading ? "Loading" : `${filteredClients.length} shown`}
          </Badge>
        </div>

        <div className="mt-4 [scrollbar-color:color-mix(in_oklch,var(--foreground)_35%,transparent)_transparent] [scrollbar-width:thin] lg:mt-8 lg:max-h-[430px] lg:overflow-auto lg:pr-1">
          {loading ? (
            <div className="grid min-h-52 place-items-center rounded-lg border border-dashed p-8 text-center">
              <div>
                <Loader2 className="mx-auto mb-3 size-8 animate-spin text-muted-foreground" />
                <h3 className="font-medium">Loading clients</h3>
                <p className="mt-1 text-sm text-muted-foreground">Fetching your workspace directory.</p>
              </div>
            </div>
          ) : filteredClients.length > 0 ? (
            <>
            <div className="grid gap-3 lg:hidden">
              {filteredClients.map((client) => (
                <ClientMobileCard
                  key={client._id}
                  client={client}
                  onEdit={editClient}
                />
              ))}
            </div>
            <Table className="hidden min-w-[980px] table-fixed text-base lg:table">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[22%]" />
                <col className="w-[18%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Client</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Contact</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Billing info</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Created</TableHead>
                  <TableHead className="h-14 overflow-hidden px-3 font-semibold text-foreground">Status</TableHead>
                  <TableHead className="h-14 px-3 text-center font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const businessName = cleanBusinessName(client);
                  const phone = client.phone?.trim() ?? "";
                  const email = client.email.trim();
                  const billingInfo = [client.vatNumber, client.taxId, client.paymentTerms]
                    .filter((value): value is string => Boolean(value?.trim()))
                    .join(" / ");

                  return (
                    <TableRow key={client._id} className="h-[71px] border-border hover:bg-muted/40">
                      <TableCell className="overflow-hidden px-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                            {clientInitial(client)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">{client.name}</span>
                            <span className="mt-1 block truncate text-sm text-muted-foreground">
                              {businessName || "Person client"}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3">
                        <div className="min-w-0 space-y-1 text-sm">
                          {email ? (
                            <a className="flex min-w-0 items-center gap-2 text-foreground hover:text-muted-foreground" href={`mailto:${email}`}>
                              <Mail className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{email}</span>
                            </a>
                          ) : null}
                          {phone ? (
                            <a className="flex min-w-0 items-center gap-2 text-foreground hover:text-muted-foreground" href={`tel:${phone}`}>
                              <Phone className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{phone}</span>
                            </a>
                          ) : null}
                          {!email && !phone ? (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <ContactRound className="size-4" />
                              No contact
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-foreground">
                        <span className="block truncate">{billingInfo || "Not saved"}</span>
                        {client.contactName ? (
                          <span className="mt-1 block truncate text-sm text-muted-foreground">{client.contactName}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="overflow-hidden px-3 text-foreground">
                        <span className="block truncate">{formatDate(client.createdAt)}</span>
                      </TableCell>
                      <TableCell className="overflow-hidden px-3">
                        <ClientStatusBadge active={isActiveClient(client)} />
                      </TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center justify-center gap-2">
                          {email ? (
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              aria-label={`Email ${client.name}`}
                              className="size-9 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700"
                            >
                              <a href={`mailto:${email}`}>
                                <Mail className="size-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`${client.name} has no email`}
                              className="size-9 rounded-full bg-muted text-muted-foreground"
                              disabled
                            >
                              <Mail className="size-4" />
                            </Button>
                          )}
                          {phone ? (
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              aria-label={`Call ${client.name}`}
                              className="size-9 rounded-full bg-neutral-100 text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950"
                            >
                              <a href={`tel:${phone}`}>
                                <Phone className="size-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`${client.name} has no phone`}
                              className="size-9 rounded-full bg-muted text-muted-foreground"
                              disabled
                            >
                              <Phone className="size-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${client.name}`}
                            className="size-9 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                            onClick={() => editClient(client)}
                          >
                            <ContactRound className="size-4" />
                          </Button>
                        </div>
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
                <Users className="mx-auto mb-3 size-8 text-muted-foreground" />
                <h3 className="font-medium">{search.trim() ? "No matching clients" : "No clients here"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search.trim() ? "Clear the search or add a new client." : "Add a client to start your directory."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent
          className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg p-0 sm:max-w-3xl"
          showCloseButton={!pending}
        >
          <form onSubmit={handleSubmit}>
            <DialogHeader className="border-b border-border p-5 sm:p-6">
              <DialogTitle className="text-xl font-semibold">
                {editingId ? "Edit client" : "New client"}
              </DialogTitle>
              <DialogDescription>Save the details used on invoices and reminders.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 p-5 sm:p-6">
              {formError ? (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" aria-live="polite">
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <ClientField label="Client name">
                  <Input
                    id="client-name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className={fieldClass}
                    placeholder="Person or business"
                    required
                  />
                </ClientField>
                <ClientField label="Business or group">
                  <Input
                    value={form.businessName}
                    onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </ClientField>
                <ClientField label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </ClientField>
                <ClientField label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </ClientField>
              </div>

              <label className="flex h-11 items-center gap-3 rounded-lg border border-border bg-background px-3 text-sm font-medium">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, active: checked === true }))}
                />
                <span>Active client</span>
              </label>

              <Button
                type="button"
                variant="outline"
                className="h-11 justify-between rounded-lg text-base"
                onClick={() => setShowDetails((visible) => !visible)}
              >
                Billing details
                <ChevronDown className={cn("size-4 transition", showDetails && "rotate-180")} />
              </Button>

              {showDetails ? (
                <div className="grid gap-4">
                  <Separator />
                  <div className="grid gap-4 md:grid-cols-2">
                    <ClientField label="Contact person">
                      <Input
                        value={form.contactName}
                        onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                        className={fieldClass}
                        placeholder="Optional"
                      />
                    </ClientField>
                    <ClientField label="Payment terms">
                      <Input
                        value={form.paymentTerms}
                        onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))}
                        className={fieldClass}
                        placeholder="Optional"
                      />
                    </ClientField>
                    <ClientField label="VAT number">
                      <Input
                        value={form.vatNumber}
                        onChange={(event) => setForm((current) => ({ ...current, vatNumber: event.target.value }))}
                        className={fieldClass}
                        placeholder="Optional"
                      />
                    </ClientField>
                    <ClientField label="Tax ID">
                      <Input
                        value={form.taxId}
                        onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))}
                        className={fieldClass}
                        placeholder="Optional"
                      />
                    </ClientField>
                  </div>
                  <ClientField label="Address">
                    <Textarea
                      value={form.address}
                      onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                      className={textAreaClass}
                      placeholder="Optional"
                    />
                  </ClientField>
                  <ClientField label="Notes">
                    <Textarea
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      className={textAreaClass}
                      placeholder="Optional"
                    />
                  </ClientField>
                </div>
              ) : null}
            </div>

            <DialogFooter className="border-t border-border p-5 sm:p-6">
              <Button type="button" variant="outline" className="h-11 rounded-lg" onClick={closeDialog} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-11 rounded-lg bg-neutral-950 px-5 text-base font-semibold !text-white hover:bg-neutral-800 hover:!text-white"
                disabled={pending}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : editingId ? <Save className="size-4" /> : <Plus className="size-4" />}
                {editingId ? "Save client" : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientMobileCard({
  client,
  onEdit,
}: {
  client: Client;
  onEdit: (client: Client) => void;
}) {
  const businessName = cleanBusinessName(client);
  const phone = client.phone?.trim() ?? "";
  const email = client.email.trim();
  const billingInfo = [client.vatNumber, client.taxId, client.paymentTerms]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" / ");

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold text-foreground">
            {clientInitial(client)}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-base font-semibold text-foreground">{client.name}</strong>
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {businessName || "Person client"}
            </span>
          </span>
        </div>
        <ClientStatusBadge active={isActiveClient(client)} />
      </div>

      <div className="mt-4 grid gap-2 rounded-lg bg-muted/60 p-3 text-sm">
        {email ? (
          <a className="flex min-w-0 items-center gap-2 text-foreground" href={`mailto:${email}`}>
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{email}</span>
          </a>
        ) : null}
        {phone ? (
          <a className="flex min-w-0 items-center gap-2 text-foreground" href={`tel:${phone}`}>
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{phone}</span>
          </a>
        ) : null}
        {!email && !phone ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <ContactRound className="size-4" />
            No contact
          </span>
        ) : null}
        <span className="block truncate text-muted-foreground">{billingInfo || "Billing info not saved"}</span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-w-0 justify-center rounded-lg bg-amber-50 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          onClick={() => onEdit(client)}
        >
          <ContactRound className="size-4" />
          <span className="truncate">Edit</span>
        </Button>
        <Button
          asChild={Boolean(email)}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={email ? `Email ${client.name}` : `${client.name} has no email`}
          className="size-11 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700 disabled:bg-muted disabled:text-muted-foreground"
          disabled={!email}
        >
          {email ? (
            <a href={`mailto:${email}`}>
              <Mail className="size-4" />
            </a>
          ) : (
            <Mail className="size-4" />
          )}
        </Button>
        <Button
          asChild={Boolean(phone)}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={phone ? `Call ${client.name}` : `${client.name} has no phone`}
          className="size-11 rounded-lg bg-neutral-100 text-neutral-950 hover:bg-neutral-200 hover:text-neutral-950 disabled:bg-muted disabled:text-muted-foreground"
          disabled={!phone}
        >
          {phone ? (
            <a href={`tel:${phone}`}>
              <Phone className="size-4" />
            </a>
          ) : (
            <Phone className="size-4" />
          )}
        </Button>
      </div>
    </article>
  );
}

function ClientField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ClientStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-full border-0 px-3 text-sm font-semibold",
        active ? "bg-teal-50 text-teal-700" : "bg-neutral-100 text-neutral-600",
      )}
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
