"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  ChevronDown,
  ContactRound,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
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
  "db-field-input";
const textAreaClass =
  "db-field-input db-field-textarea";

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
    <div className="db-page db-dashboard-page db-clients-page">
      <section className="db-workview">
        <div className="db-workview-head">
          <div>
            <p className="db-breadcrumb">Payvio <span>/</span> Clients</p>
            <h1 className="db-workview-title">Clients</h1>
          </div>
          <button type="button" className="db-primary-btn db-new-invoice-btn" onClick={focusForm}>
            <Plus className="size-4" /> Add client
          </button>
        </div>

        <div className="db-metric-strip" aria-label="Client metrics">
          <div className="db-metric-cell">
            <span>Total clients</span>
            <strong>{totalClients}</strong>
            <small>{currentWorkspace}</small>
          </div>
          <div className="db-metric-cell">
            <span>People</span>
            <strong>{individualClients}</strong>
            <small>Individual profiles</small>
          </div>
          <div className="db-metric-cell">
            <span>Reachable</span>
            <strong>{reachableClients}</strong>
            <small>Email or phone saved</small>
          </div>
        </div>

        {notice ? (
          <div className="db-notice db-notice-clean">
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="db-clients-layout">
          <form id="client-form" onSubmit={handleSubmit} className="db-card db-clients-form-card">
            <div className="db-panel-header">
              <div>
                <p className="db-panel-kicker">Client profile</p>
                <h2>{editingId ? "Edit client" : "New client"}</h2>
              </div>
              <span className="db-panel-meta">
                <Building2 className="size-3.5" /> Workspace
              </span>
            </div>

            <div className="db-client-form-fields">
              <ClientField label="Client name">
                <input
                  id="client-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className={fieldClass}
                  placeholder="Person, project, or business"
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

            <label className="db-client-active-toggle">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>Active client</span>
            </label>

            <button
              type="button"
              className="db-outline-btn db-client-details-toggle"
              onClick={() => setShowDetails((visible) => !visible)}
            >
              {showDetails ? "Hide details" : "More details"}
              <ChevronDown className={`size-4 transition ${showDetails ? "rotate-180" : ""}`} />
            </button>

            {showDetails ? (
              <div className="db-client-form-fields db-client-form-details">
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

                <div className="db-two-field-grid">
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
              </div>
            ) : null}

            <div className="db-client-form-actions">
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

          <section className="db-card db-clients-list-card">
            <div className="db-panel-header db-clients-list-header">
              <div>
                <p className="db-panel-kicker">Directory</p>
                <h2>Saved clients</h2>
              </div>
              <span className="db-panel-meta">{filteredClients.length} shown</span>
            </div>

            <div className="db-search-bar db-clients-search">
              <Search className="size-4 text-[#9ca3af]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search clients"
                className="db-search-bar-input"
              />
            </div>

          {filteredClients.length === 0 ? (
            <div className="db-empty">
              <Users className="size-10 text-[#d1d5db]" />
              <h3>{search.trim() ? "No matching clients" : "No clients yet"}</h3>
              <p>{search.trim() ? "Clear the search or add a new client." : "Add the first client on the left."}</p>
            </div>
          ) : (
            <div className="db-clients-directory">
              {filteredClients.map((client) => {
                const businessName = cleanBusinessName(client);
                const phone = client.phone?.trim() ?? "";

                return (
                  <article key={client._id} className="db-client-card db-client-directory-card">
                    <div className="db-client-avatar" aria-hidden="true">
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
                      <div className="db-client-contact-list">
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
                        {!client.email && !phone ? (
                          <span className="db-client-email">
                            <ContactRound className="size-3" /> No contact saved
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="db-client-stats">
                      <span className={client.active ?? true ? "db-status-dot-active" : "db-status-dot-muted"}>
                        {client.active ?? true ? "Active" : "Inactive"}
                      </span>
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
      </section>
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
    <label className="db-field">
      {label}
      {children}
    </label>
  );
}
