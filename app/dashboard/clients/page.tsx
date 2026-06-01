"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  ChevronDown,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { usePlan } from "@/lib/plan";
import { LockedPage } from "../_components/DashboardShell";

type Client = Doc<"clients">;
type Workspace = Doc<"organizations">;

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

const fieldClass =
  "h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]";
const textAreaClass =
  "min-h-20 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none transition focus:border-[#111827]";

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

export default function ClientsPage() {
  const { canAccess } = usePlan();
  const workspace = useQuery(api.invoices.workspace) as Workspace | null | undefined;
  const clients = useQuery(api.invoices.listClients) as Client[] | undefined;
  const upsertClient = useMutation(api.invoices.upsertClient);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<Id<"clients"> | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [showDetails, setShowDetails] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = useMemo(() => clients ?? [], [clients]);
  const totalClients = rows.length;
  const individualClients = rows.filter((client) => !cleanBusinessName(client)).length;
  const reachableClients = rows.filter((client) => contactCount(client) > 0).length;
  const currentWorkspace = workspaceName(workspace);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((client) =>
      [
        client.name,
        cleanBusinessName(client),
        client.contactName,
        client.email,
        client.phone,
        client.vatNumber,
        client.taxId,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [rows, search]);

  if (!canAccess("clients")) {
    return <LockedPage feature="Clients" requiredPlan="Starter" />;
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setShowDetails(false);
  }

  function focusForm() {
    document.getElementById("client-form")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => document.getElementById("client-name")?.focus(), 120);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();

    if (!name) {
      setNotice("Client name is required.");
      return;
    }

    setPending(true);
    setNotice(null);

    try {
      await upsertClient({
        id: editingId ?? undefined,
        ...form,
        name,
      });
      resetForm();
      setNotice(editingId ? "Client updated." : "Client added to this workspace.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save client.");
    } finally {
      setPending(false);
    }
  }

  function editClient(client: Client) {
    setEditingId(client._id);
    setForm(clientToForm(client));
    setShowDetails(true);
    focusForm();
  }

  return (
    <div className="db-page">
      <div className="db-page-header">
        <div>
          <p className="db-page-eyebrow">Linked to {currentWorkspace}</p>
          <h1 className="db-page-title">Clients</h1>
        </div>
        <button type="button" className="db-primary-btn" onClick={focusForm}>
          <Plus className="size-4" /> Add client
        </button>
      </div>

      {notice ? (
        <div className="db-notice" style={{ marginBottom: "18px" }}>
          {notice}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form id="client-form" onSubmit={handleSubmit} className="db-card grid content-start gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="db-card-title">
                <UserRound className="size-4" /> {editingId ? "Edit client" : "New client"}
              </p>
              <p className="mt-1 text-[13px] text-[#6b7280]">
                {editingId ? "Update this workspace client." : "Add a person or organization."}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#e5e7eb] px-2 py-1 text-[12px] font-medium text-[#6b7280]">
              <Building2 className="size-3.5" /> Workspace
            </span>
          </div>

          <div className="grid gap-3">
            <ClientField label="Client name">
              <input
                id="client-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className={fieldClass}
                placeholder="Person, family, project, or business"
                required
              />
            </ClientField>

            <ClientField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className={fieldClass}
                placeholder="Optional"
              />
            </ClientField>

            <ClientField label="Phone">
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className={fieldClass}
                placeholder="Optional"
              />
            </ClientField>

            <ClientField label="Business or group">
              <input
                value={form.businessName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, businessName: event.target.value }))
                }
                className={fieldClass}
                placeholder="Optional"
              />
            </ClientField>
          </div>

          <button
            type="button"
            className="db-outline-btn w-max"
            onClick={() => setShowDetails((visible) => !visible)}
          >
            {showDetails ? "Hide details" : "More details"}
            <ChevronDown className={`size-4 transition ${showDetails ? "rotate-180" : ""}`} />
          </button>

          {showDetails ? (
            <div className="grid gap-3">
              <ClientField label="Contact person">
                <input
                  value={form.contactName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, contactName: event.target.value }))
                  }
                  className={fieldClass}
                  placeholder="Optional"
                />
              </ClientField>

              <ClientField label="Address">
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, address: event.target.value }))
                  }
                  className={textAreaClass}
                  placeholder="Optional"
                />
              </ClientField>

              <div className="grid gap-3 sm:grid-cols-2">
                <ClientField label="VAT number">
                  <input
                    value={form.vatNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, vatNumber: event.target.value }))
                    }
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </ClientField>
                <ClientField label="Tax ID">
                  <input
                    value={form.taxId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, taxId: event.target.value }))
                    }
                    className={fieldClass}
                    placeholder="Optional"
                  />
                </ClientField>
              </div>

              <ClientField label="Payment terms">
                <input
                  value={form.paymentTerms}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, paymentTerms: event.target.value }))
                  }
                  className={fieldClass}
                  placeholder="Optional"
                />
              </ClientField>

              <ClientField label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className={textAreaClass}
                  placeholder="Optional"
                />
              </ClientField>

              <label className="flex items-center gap-2 text-[13px] font-medium text-[#374151]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                  className="size-4 rounded border-[#d1d5db]"
                />
                Active client
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="db-primary-btn">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editingId ? "Save client" : totalClients === 0 ? "Add first client" : "Add client"}
            </button>
            {editingId ? (
              <button type="button" className="db-outline-btn" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="grid content-start gap-4">
          <div className="db-search-bar">
            <Search className="size-4 text-[#9ca3af]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients..."
              className="db-search-bar-input"
            />
          </div>

          <div className="db-stat-row">
            <div className="db-stat-card">
              <p className="db-stat-label">Total clients</p>
              <p className="db-stat-value">{totalClients}</p>
            </div>
            <div className="db-stat-card">
              <p className="db-stat-label">People</p>
              <p className="db-stat-value">{individualClients}</p>
            </div>
            <div className="db-stat-card">
              <p className="db-stat-label">Reachable</p>
              <p className="db-stat-value">{reachableClients}</p>
            </div>
          </div>

          {clients === undefined ? (
            <div className="db-empty">
              <Loader2 className="size-9 animate-spin text-[#d1d5db]" />
              <h3>Loading clients</h3>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="db-empty">
              <Users className="size-10 text-[#d1d5db]" />
              <h3>{search.trim() ? "No matching clients" : "No clients yet"}</h3>
              <p>{search.trim() ? "Clear the search or add a new client." : "Add the first client on the left."}</p>
            </div>
          ) : (
            <div className="db-clients-grid">
              {filteredClients.map((client) => {
                const businessName = cleanBusinessName(client);
                const phone = client.phone?.trim() ?? "";

                return (
                  <article key={client._id} className="db-client-card">
                    <div className="db-client-avatar">
                      {client.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="db-client-info">
                      <button
                        type="button"
                        className="db-client-name text-left"
                        onClick={() => editClient(client)}
                      >
                        {client.name}
                      </button>
                      <p className="mt-1 text-[12px] text-[#6b7280]">
                        {businessName || "Person client"}
                      </p>
                      <div className="mt-2 grid gap-1">
                        {client.email ? (
                          <a className="db-client-email" href={`mailto:${client.email}`}>
                            <Mail className="size-3" /> {client.email}
                          </a>
                        ) : null}
                        {phone ? (
                          <a className="db-client-email" href={`tel:${phone}`}>
                            <Phone className="size-3" /> {phone}
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="db-client-stats">
                      <span>{client.active ?? true ? "Active" : "Inactive"}</span>
                      <button type="button" className="db-outline-btn" onClick={() => editClient(client)}>
                        Edit
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
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
    <label className="grid gap-1.5 text-[13px] font-medium text-[#374151]">
      {label}
      {children}
    </label>
  );
}
