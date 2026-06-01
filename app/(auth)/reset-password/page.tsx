import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../_components/AuthShell";

export const metadata: Metadata = {
  title: "Set New Password | Payvio",
  description: "Set a new Payvio password.",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      description="Password reset codes are not connected yet."
      footer={
        <>
          Back to{" "}
          <Link href="/login">
            log in
          </Link>
        </>
      }
    >
      <div className="payvio-auth-empty">
        <p>Use the log in page while reset links are being configured.</p>
        <Link className="payvio-auth-submit" href="/login">
          Back to log in
        </Link>
      </div>
    </AuthShell>
  );
}
