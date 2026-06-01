import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../_components/AuthShell";

export const metadata: Metadata = {
  title: "Reset Password | Payvio",
  description: "Request a password reset for Payvio.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Password reset emails are not connected yet."
      footer={
        <>
          Return to{" "}
          <Link href="/login">
            log in
          </Link>
        </>
      }
    >
      <div className="payvio-auth-empty">
        <p>Use your current password to log in for now.</p>
        <Link className="payvio-auth-submit" href="/login">
          Back to log in
        </Link>
      </div>
    </AuthShell>
  );
}
