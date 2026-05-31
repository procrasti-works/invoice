import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "../_components/AuthForm";
import { AuthShell } from "../_components/AuthShell";

export const metadata: Metadata = {
  title: "Login | Payvio",
  description: "Log in to Payvio.",
};

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome back."
      description="Access your invoice operations workspace."
      footer={
        <>
          New to Payvio?{" "}
          <Link href="/signup">Open a ledger</Link>
        </>
      }
    >
      <AuthForm mode="signIn" />
    </AuthShell>
  );
}
