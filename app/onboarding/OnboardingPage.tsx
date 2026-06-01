"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  LogOut,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type EntityType =
  | "sole_proprietor"
  | "close_corporation"
  | "private_company"
  | "partnership"
  | "ngo"
  | "other";

type OnboardingStep = "business" | "legal" | "defaults" | "tax";

type OnboardingForm = {
  name: string;
  legalName: string;
  tradingName: string;
  entityType: EntityType;
  region: string;
  defaultCurrency: string;
  vatRegistered: boolean;
  vatNumber: string;
};

type WheelOption = {
  label: string;
  value: string;
  available: boolean;
  note?: string;
};

const defaultForm: OnboardingForm = {
  name: "",
  legalName: "",
  tradingName: "",
  entityType: "sole_proprietor",
  region: "Namibia",
  defaultCurrency: "NAD",
  vatRegistered: false,
  vatNumber: "",
};

const countryOptions: WheelOption[] = [
  { label: "Namibia", value: "Namibia", available: true },
  { label: "South Africa", value: "South Africa", available: false },
  { label: "Botswana", value: "Botswana", available: false },
  { label: "Zambia", value: "Zambia", available: false },
  { label: "Zimbabwe", value: "Zimbabwe", available: false },
  { label: "Angola", value: "Angola", available: false },
];

const currencyOptions: WheelOption[] = [
  { label: "NAD", value: "NAD", available: true, note: "Namibian dollar" },
  { label: "ZAR", value: "ZAR", available: false, note: "South African rand" },
  { label: "BWP", value: "BWP", available: false, note: "Botswana pula" },
  { label: "ZMW", value: "ZMW", available: false, note: "Zambian kwacha" },
  { label: "USD", value: "USD", available: false, note: "US dollar" },
];

const onboardingSteps: Array<{
  id: OnboardingStep;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: "business",
    label: "Business",
    title: "Name the workspace",
    description: "This is what your team sees in Payvio.",
  },
  {
    id: "legal",
    label: "Legal",
    title: "Add invoice names",
    description: "Use the registered or trading names you need on invoices.",
  },
  {
    id: "defaults",
    label: "Defaults",
    title: "Set local defaults",
    description: "These can be changed later in settings.",
  },
  {
    id: "tax",
    label: "Tax",
    title: "VAT setup",
    description: "Keep this off if you are not VAT registered yet.",
  },
];

export function OnboardingPage({
  createMode = false,
  nextPath = "/dashboard",
}: {
  createMode?: boolean;
  nextPath?: string;
}) {
  const router = useRouter();
  const state = useQuery(api.organizations.onboardingState);
  const createWorkspace = useMutation(api.organizations.createFromOnboarding);
  const acceptInvitation = useMutation(api.organizations.acceptInvitationById);
  const { signOut } = useAuthActions();
  const [form, setForm] = useState<OnboardingForm>(defaultForm);
  const [activeStep, setActiveStep] = useState<OnboardingStep>("business");
  const [pending, setPending] = useState(false);
  const [joiningId, setJoiningId] =
    useState<Id<"organizationInvitations"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (state?.organization && !createMode) {
      router.replace(nextPath);
    }
  }, [createMode, nextPath, router, state?.organization]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = getFormError(form);
    if (validationError) {
      setError(validationError.message);
      setActiveStep(validationError.step);
      return;
    }

    setPending(true);

    try {
      await createWorkspace({
        name: form.name,
        legalName: form.legalName,
        tradingName: form.tradingName,
        entityType: form.entityType,
        region: form.region,
        defaultCurrency: form.defaultCurrency,
        vatRegistered: form.vatRegistered,
        vatNumber: form.vatNumber,
        createSeparate: createMode || showCreateForm,
      });
      router.replace(nextPath);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create workspace.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleJoin(invitationId: Id<"organizationInvitations">) {
    setError(null);
    setJoiningId(invitationId);

    try {
      await acceptInvitation({ invitationId });
      router.replace(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to join workspace.");
    } finally {
      setJoiningId(null);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function goToNextStep() {
    setError(null);

    const validationError = getStepError(activeStep, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextStep = nextOnboardingStep(activeStep);
    if (nextStep) {
      setActiveStep(nextStep);
    }
  }

  function goToPreviousStep() {
    setError(null);

    const previousStep = previousOnboardingStep(activeStep);
    if (previousStep) {
      setActiveStep(previousStep);
    }
  }

  const loginNext = createMode
    ? `/onboarding?mode=create&next=${encodeURIComponent(nextPath)}`
    : `/onboarding?next=${encodeURIComponent(nextPath)}`;

  if (state === undefined || (state?.organization && !createMode)) {
    return <OnboardingLoading />;
  }

  if (!state.authenticated) {
    return (
      <OnboardingShell>
        <CenteredPanel>
          <OnboardingBrand />
          <SetupPanel
            title="Log in to continue"
            description="Workspace setup is tied to your account."
            action={
              <Button
                type="button"
                onClick={() =>
                  router.replace(`/login?next=${encodeURIComponent(loginNext)}`)
                }
                className="h-12 w-full rounded-full bg-[#6570d9] text-white hover:bg-[#7580ef]"
              >
                Log in
              </Button>
            }
          />
        </CenteredPanel>
      </OnboardingShell>
    );
  }

  const pendingInvitations = state.pendingInvitations.filter(
    (invitation) => !invitation.expired,
  );
  const hasActiveInvitations = pendingInvitations.length > 0;
  const showInvitationChoice =
    hasActiveInvitations && !showCreateForm && !createMode;
  const showBusinessForm = createMode || !hasActiveInvitations || showCreateForm;
  const userEmail =
    typeof state.user?.email === "string" ? state.user.email : "Signed in";

  return (
    <OnboardingShell>
      <CenteredPanel>
        <OnboardingBrand />

        <div className="grid justify-items-center gap-1.5 text-center">
          <h1 className="text-[1.45rem] font-semibold leading-tight text-[#202124]">
            {showInvitationChoice
              ? "Join workspace"
              : createMode
                ? "New organization"
              : "Set up Payvio"}
          </h1>
          <p className="max-w-[250px] text-sm leading-6 text-[#6f737d]">
            {showInvitationChoice
              ? "Accept the invite or create a separate workspace."
              : createMode
                ? "Use the same setup flow."
              : "Finish your workspace in a few steps."}
          </p>
        </div>

        {error ? <ErrorNotice>{error}</ErrorNotice> : null}

        {showInvitationChoice ? (
          <InvitationPopup
            invitations={pendingInvitations}
            joiningId={joiningId}
            onJoin={handleJoin}
            onCreate={() => {
              setError(null);
              setShowCreateForm(true);
              setActiveStep("business");
            }}
          />
        ) : null}

        {showBusinessForm ? (
          <WorkspacePopup
            activeStep={activeStep}
            form={form}
            hasActiveInvitations={!createMode && hasActiveInvitations}
            pending={pending}
            onBackToInvitation={() => {
              setError(null);
              setShowCreateForm(false);
              setActiveStep("business");
            }}
            onChange={setForm}
            onPrevious={goToPreviousStep}
            onNext={goToNextStep}
            onSubmit={handleCreate}
          />
        ) : null}

        <footer className="mt-1 flex w-full items-center justify-center gap-3 text-center text-xs text-[#7d8088]">
          <span className="min-w-0 truncate">{userEmail}</span>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#4f5cc9] hover:text-[#3946ad]"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </footer>
      </CenteredPanel>
    </OnboardingShell>
  );
}

function InvitationPopup({
  invitations,
  joiningId,
  onJoin,
  onCreate,
}: {
  invitations: Array<{
    _id: Id<"organizationInvitations">;
    organizationName: string;
    role: string;
  }>;
  joiningId: Id<"organizationInvitations"> | null;
  onJoin: (invitationId: Id<"organizationInvitations">) => void;
  onCreate: () => void;
}) {
  return (
    <div className="grid w-full gap-4 rounded-[8px] border border-[#e0e2ea] bg-white/95 p-4 shadow-[0_22px_70px_rgb(18_20_28_/_12%)] backdrop-blur">
      <div className="grid gap-3">
        {invitations.map((invitation) => (
          <div
            key={invitation._id}
            className="grid gap-3 rounded-[8px] border border-[#e5e7ef] bg-[#fbfbfc] p-3"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-[#eef0ff] text-[#6570d9]">
                <Users className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#202124]">
                  {invitation.organizationName}
                </p>
                <p className="mt-0.5 text-xs text-[#71747c]">
                  Invited as {roleLabel(invitation.role)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              disabled={joiningId === invitation._id}
              onClick={() => onJoin(invitation._id)}
              className="h-11 rounded-full bg-[#6570d9] text-white hover:bg-[#7580ef]"
            >
              {joiningId === invitation._id ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              Join workspace
            </Button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="justify-self-center text-sm font-semibold text-[#4f5cc9] hover:text-[#3946ad]"
      >
        Create a separate workspace
      </button>
    </div>
  );
}

function WorkspacePopup({
  activeStep,
  form,
  hasActiveInvitations,
  pending,
  onBackToInvitation,
  onChange,
  onPrevious,
  onNext,
  onSubmit,
}: {
  activeStep: OnboardingStep;
  form: OnboardingForm;
  hasActiveInvitations: boolean;
  pending: boolean;
  onBackToInvitation: () => void;
  onChange: React.Dispatch<React.SetStateAction<OnboardingForm>>;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeIndex = onboardingSteps.findIndex((step) => step.id === activeStep);
  const currentStep = onboardingSteps[activeIndex] ?? onboardingSteps[0];
  const isFinalStep = activeStep === "tax";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isFinalStep) {
      onSubmit(event);
      return;
    }

    event.preventDefault();
    onNext();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid w-full gap-5 rounded-[8px] border border-[#e0e2ea] bg-white/95 p-5 shadow-[0_22px_70px_rgb(18_20_28_/_12%)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6570d9]">
            {currentStep.label}
          </p>
          <h2 className="text-lg font-semibold leading-tight text-[#202124]">
            {currentStep.title}
          </h2>
          <p className="text-sm leading-6 text-[#71747c]">
            {currentStep.description}
          </p>
        </div>

        {hasActiveInvitations ? (
          <button
            type="button"
            onClick={onBackToInvitation}
            className="rounded-full p-2 text-[#7a7e89] hover:bg-[#ececef] hover:text-[#202124]"
            aria-label="Back to invitation"
          >
            <ArrowLeft className="size-4" />
          </button>
        ) : null}
      </div>

      <StepDots activeIndex={activeIndex} />

      {activeStep === "business" ? (
        <BusinessFields form={form} onChange={onChange} />
      ) : null}

      {activeStep === "legal" ? (
        <LegalFields form={form} onChange={onChange} />
      ) : null}

      {activeStep === "defaults" ? (
        <DefaultFields form={form} onChange={onChange} />
      ) : null}

      {activeStep === "tax" ? (
        <TaxFields form={form} onChange={onChange} />
      ) : null}

      <div className="grid gap-3">
        {isFinalStep ? (
          <Button
            type="submit"
            disabled={pending}
            className="h-12 rounded-full bg-[#6570d9] text-white hover:bg-[#7580ef]"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            Create workspace
          </Button>
        ) : (
          <Button
            type="submit"
            className="h-12 rounded-full bg-[#6570d9] text-white hover:bg-[#7580ef]"
          >
            Continue
            <ChevronRight />
          </Button>
        )}

        {activeIndex > 0 ? (
          <button
            type="button"
            onClick={onPrevious}
            disabled={pending}
            className="justify-self-center text-sm font-semibold text-[#4a4d55] hover:text-[#4f5cc9] disabled:opacity-60"
          >
            Back
          </button>
        ) : null}
      </div>
    </form>
  );
}

function BusinessFields({
  form,
  onChange,
}: {
  form: OnboardingForm;
  onChange: React.Dispatch<React.SetStateAction<OnboardingForm>>;
}) {
  return (
    <div className="grid gap-4">
      <OnboardingField label="Business name" htmlFor="business-name">
        <Input
          id="business-name"
          value={form.name}
          onChange={(event) =>
            onChange((current) => ({ ...current, name: event.target.value }))
          }
          className="h-11 rounded-[10px] border-[#dfe1e8] bg-white text-[#17181c] focus-visible:border-[#6570d9] focus-visible:ring-[#6570d9]/15"
          placeholder="Acme Trading"
          required
        />
      </OnboardingField>

      <OnboardingField label="Entity type" htmlFor="entity-type">
        <select
          id="entity-type"
          value={form.entityType}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              entityType: event.target.value as EntityType,
            }))
          }
          className="h-11 rounded-[10px] border border-[#dfe1e8] bg-white px-3 text-sm text-[#17181c] outline-none transition-colors focus:border-[#6570d9] focus:ring-3 focus:ring-[#6570d9]/15"
        >
          <option value="sole_proprietor">Sole proprietor</option>
          <option value="close_corporation">Close corporation</option>
          <option value="private_company">Private company</option>
          <option value="partnership">Partnership</option>
          <option value="ngo">NGO</option>
          <option value="other">Other</option>
        </select>
      </OnboardingField>
    </div>
  );
}

function LegalFields({
  form,
  onChange,
}: {
  form: OnboardingForm;
  onChange: React.Dispatch<React.SetStateAction<OnboardingForm>>;
}) {
  return (
    <div className="grid gap-4">
      <OnboardingField label="Legal name" htmlFor="legal-name">
        <Input
          id="legal-name"
          value={form.legalName}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              legalName: event.target.value,
            }))
          }
          className="h-11 rounded-[10px] border-[#dfe1e8] bg-white text-[#17181c] focus-visible:border-[#6570d9] focus-visible:ring-[#6570d9]/15"
          placeholder="Registered name"
        />
      </OnboardingField>

      <OnboardingField label="Trading name" htmlFor="trading-name">
        <Input
          id="trading-name"
          value={form.tradingName}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              tradingName: event.target.value,
            }))
          }
          className="h-11 rounded-[10px] border-[#dfe1e8] bg-white text-[#17181c] focus-visible:border-[#6570d9] focus-visible:ring-[#6570d9]/15"
          placeholder="Public name"
        />
      </OnboardingField>
    </div>
  );
}

function DefaultFields({
  form,
  onChange,
}: {
  form: OnboardingForm;
  onChange: React.Dispatch<React.SetStateAction<OnboardingForm>>;
}) {
  return (
    <div className="grid gap-4">
      <WheelPicker
        id="region"
        label="Country"
        options={countryOptions}
        value={form.region}
        onChange={(region) =>
          onChange((current) => ({ ...current, region }))
        }
      />

      <WheelPicker
        id="currency"
        label="Currency"
        options={currencyOptions}
        value={form.defaultCurrency}
        onChange={(defaultCurrency) =>
          onChange((current) => ({ ...current, defaultCurrency }))
        }
      />
    </div>
  );
}

function WheelPicker({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-xs font-semibold text-[#3b3d43]">
        {label}
      </Label>
      <button
        id={id}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-[#dfe1e8] bg-white px-3 text-left text-sm text-[#17181c] outline-none transition-colors hover:border-[#c9cce0] focus:border-[#6570d9] focus:ring-3 focus:ring-[#6570d9]/15"
      >
        <span className="min-w-0">
          <span className="block truncate text-base">{selectedOption.label}</span>
          {selectedOption.note ? (
            <span className="block truncate text-xs text-[#7a7e89]">
              {selectedOption.note}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={[
            "size-4 shrink-0 text-[#7a7e89] transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div className="relative overflow-hidden rounded-[12px] border border-[#dfe1e8] bg-[#fbfbfc] p-2 shadow-[inset_0_1px_0_rgb(255_255_255),0_12px_35px_rgb(18_20_28_/_8%)]">
          <div className="pointer-events-none absolute inset-x-2 top-1/2 h-11 -translate-y-1/2 rounded-[10px] border border-[#d7daf7] bg-white/80 shadow-[0_6px_18px_rgb(101_112_217_/_10%)]" />
          <div
            role="listbox"
            aria-label={label}
            aria-activedescendant={`${id}-${selectedOption.value}`}
            className="relative grid max-h-[168px] snap-y snap-mandatory gap-1 overflow-y-auto pr-1 [scrollbar-color:#b8bdf0_transparent] [scrollbar-width:thin]"
          >
            {options.map((option) => {
              const selected = option.value === selectedOption.value;

              return (
                <button
                  key={option.value}
                  id={`${id}-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={!option.available}
                  disabled={!option.available}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={[
                    "grid min-h-11 snap-center grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors",
                    selected
                      ? "bg-[#eef0ff] text-[#202124]"
                      : "text-[#4a4d55] hover:bg-white",
                    option.available
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-45",
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {option.label}
                    </span>
                    {option.note ? (
                      <span className="block truncate text-xs text-[#7a7e89]">
                        {option.note}
                      </span>
                    ) : null}
                  </span>
                  {option.available ? (
                    selected ? (
                      <Check className="size-4 text-[#6570d9]" />
                    ) : null
                  ) : (
                    <span className="rounded-full bg-[#ececef] px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#7a7e89]">
                      Not available yet
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <input type="hidden" name={id} value={selectedOption.value} />
    </div>
  );
}

function TaxFields({
  form,
  onChange,
}: {
  form: OnboardingForm;
  onChange: React.Dispatch<React.SetStateAction<OnboardingForm>>;
}) {
  return (
    <div className="grid gap-4">
      <label className="flex items-start gap-3 rounded-[10px] border border-[#dfe1e8] bg-[#fbfbfc] p-3">
        <input
          type="checkbox"
          checked={form.vatRegistered}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              vatRegistered: event.target.checked,
            }))
          }
          className="mt-1 size-4 accent-[#6570d9]"
        />
        <span className="grid gap-1">
          <span className="text-sm font-semibold text-[#202124]">
            VAT registered
          </span>
          <span className="text-sm leading-5 text-[#71747c]">
            Show VAT details on invoices.
          </span>
        </span>
      </label>

      {form.vatRegistered ? (
        <OnboardingField label="VAT number" htmlFor="vat-number">
          <Input
            id="vat-number"
            value={form.vatNumber}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                vatNumber: event.target.value,
              }))
            }
            className="h-11 rounded-[10px] border-[#dfe1e8] bg-white text-[#17181c] focus-visible:border-[#6570d9] focus-visible:ring-[#6570d9]/15"
          />
        </OnboardingField>
      ) : null}
    </div>
  );
}

function StepDots({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex items-center gap-2" aria-label="Setup progress">
      {onboardingSteps.map((step, index) => (
        <span
          key={step.id}
          className={[
            "h-1.5 rounded-full transition-all",
            index === activeIndex
              ? "w-8 bg-[#6570d9]"
              : index < activeIndex
                ? "w-3 bg-[#a7adeb]"
                : "w-3 bg-[#e2e3e9]",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden bg-[#fbfbfc] px-5 py-8 text-[#15161a]">
      {children}
    </main>
  );
}

function CenteredPanel({ children }: { children: ReactNode }) {
  return (
    <section className="relative z-10 grid w-full max-w-[360px] justify-items-center gap-6">
      {children}
    </section>
  );
}

function OnboardingBrand() {
  return (
    <div className="grid size-[54px] place-items-center text-[#111216]">
      <Image
        src="/payvio-logo.svg"
        alt="Payvio"
        width={54}
        height={54}
        className="size-[54px] object-contain"
        priority
      />
    </div>
  );
}

function OnboardingLoading() {
  return (
    <OnboardingShell>
      <CenteredPanel>
        <OnboardingBrand />
        <p className="text-sm text-[#6f737d]">Loading setup...</p>
      </CenteredPanel>
    </OnboardingShell>
  );
}

function OnboardingField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-[#3b3d43]">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SetupPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <>
      <div className="grid justify-items-center gap-2 text-center">
        <h1 className="text-[1.38rem] font-semibold leading-tight text-[#202124]">
          {title}
        </h1>
        <p className="max-w-[260px] text-sm leading-6 text-[#6f737d]">
          {description}
        </p>
      </div>
      <div className="grid w-full gap-4 rounded-[8px] border border-[#e0e2ea] bg-white/95 p-5 shadow-[0_22px_70px_rgb(18_20_28_/_12%)] backdrop-blur">
        {action}
      </div>
    </>
  );
}

function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p
      className="w-full rounded-[8px] border border-[#f1b8b8] bg-[#fff4f4] px-3 py-2 text-sm leading-5 text-[#a62b2b]"
      aria-live="polite"
    >
      {children}
    </p>
  );
}

function getStepError(step: OnboardingStep, form: OnboardingForm) {
  if (step === "business" && !form.name.trim()) {
    return "Business name is required.";
  }

  if (step === "defaults" && !/^[A-Z]{3}$/.test(form.defaultCurrency)) {
    return "Currency must be a 3-letter code.";
  }

  return null;
}

function getFormError(form: OnboardingForm) {
  for (const step of onboardingSteps) {
    const message = getStepError(step.id, form);

    if (message) {
      return { step: step.id, message };
    }
  }

  return null;
}

function nextOnboardingStep(step: OnboardingStep) {
  const index = onboardingSteps.findIndex((candidate) => candidate.id === step);
  return onboardingSteps[index + 1]?.id ?? null;
}

function previousOnboardingStep(step: OnboardingStep) {
  const index = onboardingSteps.findIndex((candidate) => candidate.id === step);
  return onboardingSteps[index - 1]?.id ?? null;
}

function roleLabel(role: string) {
  if (role === "admin") {
    return "admin";
  }

  if (role === "finance") {
    return "finance";
  }

  if (role === "viewer") {
    return "viewer";
  }

  return "member";
}
