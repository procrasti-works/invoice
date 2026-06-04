"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LogOut,
  Users,
} from "@/app/_components/IconPack";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
                className="h-11 w-full"
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
          <h1 className="text-[1.45rem] font-semibold leading-tight text-foreground">
            {showInvitationChoice
              ? "Join workspace"
              : createMode
                ? "New organization"
              : "Set up Payvio"}
          </h1>
          <p className="max-w-[250px] text-sm leading-6 text-muted-foreground">
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

        <footer className="mt-1 flex w-full items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{userEmail}</span>
          <span aria-hidden="true">/</span>
          <Button
            type="button"
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
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
    <Card className="w-full shadow-sm">
      <CardContent className="grid gap-4 p-4">
        <div className="grid gap-3">
        {invitations.map((invitation) => (
          <Card
            key={invitation._id}
            className="bg-muted/30 shadow-none"
          >
            <CardContent className="grid gap-3 p-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground">
                  <Users className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {invitation.organizationName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Invited as {roleLabel(invitation.role)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                disabled={joiningId === invitation._id}
                onClick={() => onJoin(invitation._id)}
                className="h-11"
              >
                {joiningId === invitation._id ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                Join workspace
              </Button>
            </CardContent>
          </Card>
        ))}
        </div>

        <Button
          type="button"
          onClick={onCreate}
          variant="link"
          className="justify-self-center"
        >
          Create a separate workspace
        </Button>
      </CardContent>
    </Card>
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
      className="grid w-full gap-5 rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {currentStep.label}
          </p>
          <h2 className="text-lg font-semibold leading-tight text-foreground">
            {currentStep.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {currentStep.description}
          </p>
        </div>

        {hasActiveInvitations ? (
          <Button
            type="button"
            onClick={onBackToInvitation}
            variant="ghost"
            size="icon"
            aria-label="Back to invitation"
          >
            <ArrowLeft className="size-4" />
          </Button>
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
            className="h-11"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Check />}
            Create workspace
          </Button>
        ) : (
          <Button
            type="submit"
            className="h-11"
          >
            Continue
            <ChevronRight />
          </Button>
        )}

        {activeIndex > 0 ? (
          <Button
            type="button"
            onClick={onPrevious}
            disabled={pending}
            variant="ghost"
            size="sm"
            className="justify-self-center"
          >
            Back
          </Button>
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
          className="h-11"
          placeholder="Acme Trading"
          required
        />
      </OnboardingField>

      <OnboardingField label="Entity type" htmlFor="entity-type">
        <Select
          value={form.entityType}
          onValueChange={(value) =>
            onChange((current) => ({
              ...current,
              entityType: value as EntityType,
            }))
          }
        >
          <SelectTrigger id="entity-type" className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sole_proprietor">Sole proprietor</SelectItem>
            <SelectItem value="close_corporation">Close corporation</SelectItem>
            <SelectItem value="private_company">Private company</SelectItem>
            <SelectItem value="partnership">Partnership</SelectItem>
            <SelectItem value="ngo">NGO</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
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
          className="h-11"
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
          className="h-11"
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
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={selectedOption.value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={!option.available}
            >
              {option.note ? `${option.label} - ${option.note}` : option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!selectedOption.available ? (
        <p className="text-xs text-muted-foreground">Not available yet.</p>
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
      <label
        className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
        htmlFor="vat-registered"
      >
        <Checkbox
          id="vat-registered"
          checked={form.vatRegistered}
          onCheckedChange={(checked) =>
            onChange((current) => ({
              ...current,
              vatRegistered: checked === true,
            }))
          }
          className="mt-1"
        />
        <span className="grid gap-1">
          <span className="text-sm font-medium text-foreground">
            VAT registered
          </span>
          <span className="text-sm leading-5 text-muted-foreground">
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
            className="h-11"
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
              ? "w-8 bg-primary"
              : index < activeIndex
                ? "w-3 bg-primary/40"
                : "w-3 bg-muted",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden bg-background px-5 py-8 text-foreground">
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
    <div className="grid size-[54px] place-items-center text-foreground">
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
        <p className="text-sm text-muted-foreground">Loading setup...</p>
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
      <Label htmlFor={htmlFor}>{label}</Label>
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
        <h1 className="text-[1.38rem] font-semibold leading-tight text-foreground">
          {title}
        </h1>
        <p className="max-w-[260px] text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <Card className="w-full shadow-sm">
        <CardContent className="grid gap-4 p-5">{action}</CardContent>
      </Card>
    </>
  );
}

function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p
      className="w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm leading-5 text-destructive"
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
