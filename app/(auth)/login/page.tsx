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
      title="Log in to Payvio"
      footer={
        <>
          New to Payvio?{" "}
          <Link href="/signup">Create workspace</Link>
        </>
      }
    >
      <AuthForm mode="signIn" />
    </AuthShell>
  );
}
