"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CheckCircle2, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

type Workspace = Doc<"organizations">;
type SettingsForm = {
  name: string;
  defaultCurrency: string;
  paymentInstructions: string;
  paymentLink: string;
};

const defaultSettings: SettingsForm = {
  name: "My company",
  defaultCurrency: "USD",
  paymentInstructions:
    "Pay by bank transfer, card link, or the payment method agreed with the sender.",
  paymentLink: "",
};

function settingsFromWorkspace(workspace: Workspace | null): SettingsForm {
  if (!workspace) {
    return defaultSettings;
  }

  return {
    name: workspace.name,
    defaultCurrency: workspace.defaultCurrency,
    paymentInstructions: workspace.paymentInstructions,
    paymentLink: workspace.paymentLink ?? "",
  };
}

export function SettingsPage() {
  const workspace = useQuery(api.invoices.workspace);
  const loading = workspace === undefined;

  const workspaceVersion = workspace
    ? `${workspace._id}:${workspace.updatedAt}`
    : "new";

  return (
    <div className="h-[calc(100dvh-1rem)] min-h-0 overflow-y-auto bg-[#f4f4f2] lg:h-[calc(100dvh-2rem)]">
      <header className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-4 bg-[#f4f4f2]/95 px-5 pb-4 pt-6 backdrop-blur sm:px-6">
        <div className="min-w-0">
          <p className="text-[15px] font-normal leading-5 text-[#686b70]">
            Workspace settings
          </p>
          <h1 className="truncate text-[29px] font-semibold leading-[1.08] text-[#050505]">
            Settings
          </h1>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 shrink-0 border-[#deded8] bg-[#f2f2ef] hover:bg-[#ecece8]"
        >
          <Link href="/dashboard">
            <ArrowLeft />
            Dashboard
          </Link>
        </Button>
      </header>

      <div className="px-5 pb-6 sm:px-6">
        {loading ? (
          <section className="grid max-w-3xl gap-3 rounded-lg border border-[#deded8] bg-[#f6f6f4] p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 rounded-lg bg-[#f1f1ee]" />
            ))}
          </section>
        ) : (
          <SettingsEditor
            key={workspaceVersion}
            workspace={workspace}
            initialForm={settingsFromWorkspace(workspace)}
          />
        )}
      </div>
    </div>
  );
}

function SettingsEditor({
  workspace,
  initialForm,
}: {
  workspace: Workspace | null;
  initialForm: SettingsForm;
}) {
  const updateWorkspace = useMutation(api.invoices.updateWorkspace);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!/^[A-Z]{3}$/.test(form.defaultCurrency)) {
      setError("Currency must be a 3-letter code.");
      return;
    }

    setPending(true);

    try {
      await updateWorkspace({
        name: form.name,
        defaultCurrency: form.defaultCurrency,
        paymentInstructions: form.paymentInstructions,
        paymentLink: form.paymentLink,
      });
      setNotice(workspace ? "Settings saved." : "Workspace created.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save settings.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-3xl gap-5 rounded-lg border border-[#deded8] bg-[#f6f6f4] p-5"
    >
      {notice ? (
        <p className="flex items-center gap-2 rounded-lg border border-[#bfe8d8] bg-[#ecf8f2] p-3 text-sm text-[#006545]">
          <CheckCircle2 className="size-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[#ffc7d1] bg-[#fff0f3] p-3 text-sm text-[#a51f43]">
          {error}
        </p>
      ) : null}

      <SettingsField label="Workspace name" htmlFor="workspace-name">
        <Input
          id="workspace-name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal"
        />
      </SettingsField>

      <SettingsField label="Default currency" htmlFor="default-currency">
        <Input
          id="default-currency"
          value={form.defaultCurrency}
          maxLength={3}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              defaultCurrency: event.target.value.toUpperCase(),
            }))
          }
          className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal uppercase"
        />
      </SettingsField>

      <SettingsField label="Payment instructions" htmlFor="payment-instructions">
        <textarea
          id="payment-instructions"
          value={form.paymentInstructions}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              paymentInstructions: event.target.value,
            }))
          }
          className="min-h-28 w-full resize-y rounded-lg border border-[#d7d7d1] bg-[#f1f1ee] px-3 py-2 text-[13px] font-normal outline-none transition-colors focus:border-[#009b68] focus:ring-2 focus:ring-[#009b68]/20"
        />
      </SettingsField>

      <SettingsField label="Default payment link" htmlFor="payment-link">
        <Input
          id="payment-link"
          type="url"
          value={form.paymentLink}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              paymentLink: event.target.value,
            }))
          }
          placeholder="https://pay.example.com"
          className="h-10 border-[#d7d7d1] bg-[#f1f1ee] text-[13px] font-normal"
        />
      </SettingsField>

      <Button
        type="submit"
        disabled={pending}
        className="h-10 w-full bg-[#009b68] text-white hover:bg-[#00875b] hover:text-white sm:w-max"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Save settings
      </Button>
    </form>
  );
}

function SettingsField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-[#505258]">
        {label}
      </Label>
      {children}
    </div>
  );
}
