import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "../_components/AuthForm";
import { AuthShell } from "../_components/AuthShell";

export const metadata: Metadata = {
  title: "Open Ledger | Payvio",
  description: "Create an Payvio workspace.",
};

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Open Ledger"
      title="Create your workspace."
      description="Set up the account your team will use for invoice operations."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login">Login</Link>
        </>
      }
    >
      <AuthForm mode="signUp" />
    </AuthShell>
  );
}
