import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "../_components/AuthForm";
import { AuthShell } from "../_components/AuthShell";

export const metadata: Metadata = {
  title: "Create Workspace | Payvio",
  description: "Create a Payvio account.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create a Payvio workspace"
      note={
        <>
          By signing up, you agree to our{" "}
          <strong>Terms of Service</strong> and{" "}
          <strong>Data Processing Agreement</strong>.
        </>
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login">Log in</Link>
        </>
      }
    >
      <AuthForm mode="signUp" />
    </AuthShell>
  );
}
