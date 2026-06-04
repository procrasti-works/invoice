"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Loader2,
  Mail,
  Phone,
  Save,
  Settings,
  Trash2,
  Upload,
  UserRound,
} from "@/app/_components/IconPack";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type ProfileUser = (Doc<"users"> & { role: "user" | "admin" }) | null;
type ProfileForm = {
  name: string;
  phone: string;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const panelClassName = "rounded-lg border border-border bg-card p-5 shadow-none sm:p-[30px]";
const compactPanelClassName = "rounded-lg border border-border bg-card p-5 shadow-none";
const inputClassName = "h-11 rounded-lg border-border bg-background text-base shadow-sm";

function formFromUser(user: Exclude<ProfileUser, null>): ProfileForm {
  return {
    name: user.name ?? "",
    phone: user.phone ?? "",
  };
}

function userInitial(name: string, email: string) {
  return (name || email || "P").trim().slice(0, 1).toUpperCase() || "P";
}

export function AccountSettingsPage() {
  const user = useQuery(api.users.current) as ProfileUser | undefined;

  if (user === undefined) {
    return (
      <div className="invoice-list-page">
        <section className={cn(panelClassName, "flex min-h-[240px] items-center justify-center")}>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading settings
          </div>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="invoice-list-page">
        <section className={cn(panelClassName, "max-w-xl")}>
          <PanelHeader
            eyebrow="Account"
            title="Sign in required"
            description="Open your account before editing profile settings."
            icon={UserRound}
          />
          <Button asChild className="mt-5 h-11 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90">
            <Link href="/login">Sign in</Link>
          </Button>
        </section>
      </div>
    );
  }

  return <AccountSettingsContent key={user._id} user={user} />;
}

function AccountSettingsContent({ user }: { user: Exclude<ProfileUser, null> }) {
  const updateProfile = useMutation(api.users.updateProfile);
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const removeAvatar = useMutation(api.users.removeAvatar);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<ProfileForm>(() => formFromUser(user));
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedAvatarPreview = useMemo(() => {
    return selectedAvatarFile ? URL.createObjectURL(selectedAvatarFile) : "";
  }, [selectedAvatarFile]);

  useEffect(() => {
    return () => {
      if (selectedAvatarPreview) {
        URL.revokeObjectURL(selectedAvatarPreview);
      }
    };
  }, [selectedAvatarPreview]);

  const email = user.email ?? "";
  const displayName = form.name.trim() || email.split("@")[0] || "Payvio user";
  const initial = userInitial(displayName, email);
  const avatarUrl = selectedAvatarPreview || user.image || user.googleImage || "";
  const hasUploadedAvatar = Boolean(user.avatarStorageId);
  const hasGoogleAvatar = Boolean(user.googleImage);
  const avatarSource = selectedAvatarFile
    ? "Selected image"
    : hasUploadedAvatar
      ? "Uploaded avatar"
      : hasGoogleAvatar
        ? "Google profile photo"
        : avatarUrl
          ? "Profile photo"
          : "Initials";
  const profileCompleteCount = useMemo(() => {
    return [form.name, email, form.phone, avatarUrl].filter((value) => value.trim()).length;
  }, [avatarUrl, email, form.name, form.phone]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setPending(true);

    try {
      const avatarStorageId = selectedAvatarFile
        ? await uploadSelectedAvatar(selectedAvatarFile)
        : null;
      const updated = await updateProfile({
        name: form.name,
        phone: form.phone,
        ...(avatarStorageId ? { avatarStorageId } : null),
      });

      if (updated) {
        setForm(formFromUser(updated));
      }

      clearSelectedAvatar();
      setNotice(avatarStorageId ? "Profile and avatar saved." : "Settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setPending(false);
    }
  }

  async function uploadSelectedAvatar(file: File) {
    validateAvatarFile(file);
    const uploadUrl = await generateAvatarUploadUrl();
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!upload.ok) {
      throw new Error("Unable to upload avatar.");
    }

    const result = (await upload.json()) as { storageId: string };
    return result.storageId as Id<"_storage">;
  }

  function handleAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setNotice("");
    setError("");

    if (!file) {
      setSelectedAvatarFile(null);
      return;
    }

    try {
      validateAvatarFile(file);
      setSelectedAvatarFile(file);
    } catch (fileError) {
      setSelectedAvatarFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setError(fileError instanceof Error ? fileError.message : "Choose a different avatar image.");
    }
  }

  function clearSelectedAvatar() {
    setSelectedAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setNotice("");
    setError("");

    if (selectedAvatarFile) {
      clearSelectedAvatar();
      setNotice("Selected avatar cleared.");
      return;
    }

    if (!hasUploadedAvatar) {
      return;
    }

    setPending(true);

    try {
      const updated = await removeAvatar();

      if (updated) {
        setForm(formFromUser(updated));
      }

      setNotice(hasGoogleAvatar ? "Using your Google photo." : "Avatar removed.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove avatar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="invoice-list-page">
      <div className="grid gap-[30px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className={panelClassName}>
          <PanelHeader
            eyebrow="Account"
            title="Profile settings"
            description="This is your personal Payvio profile."
            icon={Settings}
          />

          {notice ? <StatusMessage tone="success">{notice}</StatusMessage> : null}
          {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}

          <fieldset disabled={pending} className="mt-6 space-y-8">
            <SettingsGroup title="Profile">
              <SettingsField label="Display name" htmlFor="account-name">
                <Input
                  id="account-name"
                  value={form.name}
                  maxLength={80}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className={inputClassName}
                  autoComplete="name"
                  required
                />
              </SettingsField>

              <SettingsField label="Phone / WhatsApp" htmlFor="account-phone">
                <Input
                  id="account-phone"
                  value={form.phone}
                  maxLength={40}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  className={inputClassName}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+264"
                />
              </SettingsField>
            </SettingsGroup>

            <SettingsGroup title="Avatar">
              <div className="sm:col-span-2">
                <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center">
                  <AvatarPreview avatarUrl={avatarUrl} initial={initial} sizeClassName="size-20" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{avatarSource}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      PNG, JPG, WebP, or GIF up to 5 MB.
                    </p>
                    {selectedAvatarFile ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {selectedAvatarFile.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-lg border-border"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-4" />
                      {hasUploadedAvatar || avatarUrl ? "Replace" : "Upload"}
                    </Button>
                    {selectedAvatarFile || hasUploadedAvatar ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-lg border-border"
                        onClick={() => void handleRemoveAvatar()}
                      >
                        <Trash2 className="size-4" />
                        {selectedAvatarFile
                          ? "Clear"
                          : hasGoogleAvatar
                            ? "Use Google"
                            : "Remove"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  id="account-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleAvatarFile}
                />
              </div>
            </SettingsGroup>

            <SettingsGroup title="Sign-in">
              <SettingsField label="Email" htmlFor="account-email">
                <Input
                  id="account-email"
                  value={email || "No email"}
                  className={cn(inputClassName, "text-muted-foreground")}
                  disabled
                  readOnly
                />
              </SettingsField>
            </SettingsGroup>
          </fieldset>

          <Button
            type="submit"
            disabled={pending}
            className="mt-8 h-11 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save settings
          </Button>
        </form>

        <section className={compactPanelClassName}>
          <PanelHeader
            eyebrow="Preview"
            title="Sidebar profile"
            description="Saved changes update the user menu."
            icon={UserRound}
          />

          <div className="mt-6 rounded-lg border border-border bg-background p-4">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarPreview avatarUrl={avatarUrl} initial={initial} sizeClassName="size-12" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{email || "No email"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 divide-y divide-border rounded-lg border border-border">
            <InfoRow icon={<Mail className="size-4" />} label="Email" value={email || "No email"} />
            <InfoRow icon={<Phone className="size-4" />} label="Phone" value={form.phone || "Not set"} />
            <InfoRow icon={<UserRound className="size-4" />} label="Avatar" value={avatarSource} />
            <InfoRow
              icon={<BadgeCheck className="size-4" />}
              label="Profile"
              value={`${profileCompleteCount}/4 saved`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function AvatarPreview({
  avatarUrl,
  initial,
  sizeClassName,
}: {
  avatarUrl: string;
  initial: string;
  sizeClassName: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn(sizeClassName, "shrink-0 rounded-lg object-cover")}
      />
    );
  }

  return (
    <span
      className={cn(
        sizeClassName,
        "grid shrink-0 place-items-center rounded-lg bg-primary text-base font-semibold text-primary-foreground",
      )}
    >
      {initial}
    </span>
  );
}

function PanelHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 truncate text-xl font-semibold leading-7 text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
        <Icon className="size-5" />
      </div>
    </div>
  );
}

function StatusMessage({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-5 rounded-lg border px-3 py-2 text-sm",
        tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
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
    <div className="min-w-0 space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function validateAvatarFile(file: File) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error("Avatar must be a PNG, JPG, WebP, or GIF image.");
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Avatar image must be 5 MB or smaller.");
  }
}
