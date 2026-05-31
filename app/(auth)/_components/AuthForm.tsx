"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { AuthField } from "./AuthShell";

type AuthFormProps = {
  mode: "signIn" | "signUp";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", mode);

    try {
      const result = await signIn("password", formData);

      if (result.signingIn) {
        router.replace("/dashboard");
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to complete authentication.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="new-auth-form" onSubmit={handleSubmit}>
      {mode === "signUp" ? (
        <AuthField
          id="name"
          label="Full name"
          placeholder="Your name"
          autoComplete="name"
        />
      ) : null}

      <AuthField
        id="email"
        label="Work email"
        type="email"
        placeholder="name@company.com"
        autoComplete="email"
      />

      <AuthField
        id="password"
        label="Password"
        type="password"
        placeholder={mode === "signUp" ? "Create a password" : "Enter your password"}
        autoComplete={mode === "signUp" ? "new-password" : "current-password"}
      />

      {error ? (
        <p className="new-auth-error">{error}</p>
      ) : null}

      <button type="submit" className="new-auth-submit" disabled={pending}>
        {pending
          ? "Working..."
          : mode === "signUp"
            ? "Create Account"
            : "Login"}
      </button>
    </form>
  );
}
