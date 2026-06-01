"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { AuthField } from "./AuthShell";

type AuthFormProps = {
  mode: "signIn" | "signUp";
};

type AuthToastState = {
  kind: "error" | "info";
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [toast, setToast] = useState<AuthToastState | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "signUp";
  const backLabel = isSignUp ? "Back to signup" : "Back to log in";

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 5600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    router.prefetch(nextAfterAuth(mode));
  }, [mode, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);

    try {
      const next = nextAfterAuth(mode);
      router.prefetch(next);
      const result = await signIn("password", formData);

      if (result.signingIn) {
        router.replace(next);
      }
    } catch (caught) {
      setToast(toastForAuthError(caught, mode));
    } finally {
      setPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setToast(null);
    setPending(true);

    try {
      const next = nextAfterAuth(mode);
      router.prefetch(next);
      await signIn("google", { redirectTo: next });
    } catch (caught) {
      setToast(toastForAuthError(caught, mode));
      setPending(false);
    }
  }

  if (!showEmailForm) {
    return (
      <>
        <AuthToast toast={toast} onClose={() => setToast(null)} />
        <div className="payvio-auth-options">
          <button
            type="button"
            className="payvio-auth-option payvio-auth-option-primary"
            onClick={handleGoogleSignIn}
            disabled={pending}
          >
            {pending ? "Opening Google..." : "Continue with Google"}
          </button>
          <button
            type="button"
            className="payvio-auth-option"
            onClick={() => {
              setToast(null);
              setShowEmailForm(true);
            }}
            disabled={pending}
          >
            Continue with email
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthToast toast={toast} onClose={() => setToast(null)} />
      <div className="payvio-auth-email-step">
        <form className="payvio-auth-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <AuthField
              id="name"
              label="Name"
              placeholder="Your name"
              autoComplete="name"
            />
          ) : null}

          <AuthField
            id="email"
            label="Email"
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
          />

          <AuthField
            id="password"
            label="Password"
            type="password"
            placeholder={isSignUp ? "Create a password" : "Enter your password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            action={
              isSignUp ? null : (
                <Link href="/forgot-password" className="payvio-auth-field-link">
                  Forgot?
                </Link>
              )
            }
          />

          <button type="submit" className="payvio-auth-submit" disabled={pending}>
            {pending ? "Working..." : isSignUp ? "Create account" : "Log in"}
          </button>
        </form>
        <button
          type="button"
          className="payvio-auth-back"
          onClick={() => {
            setToast(null);
            setShowEmailForm(false);
          }}
        >
          {backLabel}
        </button>
      </div>
    </>
  );
}

const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password"];

function nextAfterAuth(mode: AuthFormProps["mode"]) {
  const params = new URLSearchParams(window.location.search);
  return safeNextPath(
    params.get("next"),
    mode === "signUp" ? "/onboarding" : "/dashboard",
  );
}

function safeNextPath(
  value: string | null,
  fallback: "/dashboard" | "/onboarding",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (authPaths.some((path) => value === path || value.startsWith(`${path}?`))) {
    return fallback;
  }

  return value;
}

function AuthToast({
  toast,
  onClose,
}: {
  toast: AuthToastState | null;
  onClose: () => void;
}) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`payvio-auth-toast payvio-auth-toast-${toast.kind}`}
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live={toast.kind === "error" ? "assertive" : "polite"}
    >
      <div className="payvio-auth-toast-dot" aria-hidden="true" />
      <p>{toast.message}</p>
      {toast.actionHref && toast.actionLabel ? (
        <Link href={toast.actionHref}>{toast.actionLabel}</Link>
      ) : null}
      <button type="button" onClick={onClose} aria-label="Dismiss message">
        Close
      </button>
    </div>
  );
}

function toastForAuthError(
  caught: unknown,
  mode: AuthFormProps["mode"],
): AuthToastState {
  const message = errorMessage(caught);
  const normalized = message.toLowerCase();

  if (mode === "signUp" && normalized.includes("already exists")) {
    return {
      kind: "error",
      message: "An account with this email already exists.",
      actionHref: "/login",
      actionLabel: "Log in",
    };
  }

  if (normalized.includes("invalid credentials")) {
    return {
      kind: "error",
      message: "Email or password is incorrect.",
    };
  }

  if (normalized.includes("invalid password")) {
    return {
      kind: "error",
      message: "Password must be at least 8 characters.",
    };
  }

  if (normalized.includes("email is required")) {
    return {
      kind: "error",
      message: "Enter your email address.",
    };
  }

  if (normalized.includes("google account email must be verified")) {
    return {
      kind: "error",
      message: "Use a Google account with a verified email address.",
    };
  }

  if (normalized.includes("another account already uses this email")) {
    return {
      kind: "error",
      message: "This email is already linked to another account.",
    };
  }

  if (normalized.includes("multiple accounts already use this email")) {
    return {
      kind: "error",
      message: "This email needs account support before it can sign in.",
    };
  }

  if (normalized.includes("missing") && normalized.includes("password")) {
    return {
      kind: "error",
      message: "Enter your password.",
    };
  }

  return {
    kind: "error",
    message: "Unable to complete authentication. Try again.",
  };
}

function errorMessage(caught: unknown) {
  if (caught instanceof Error) {
    return caught.message;
  }

  if (typeof caught === "string") {
    return caught;
  }

  return "";
}
