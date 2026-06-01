"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PayvioMark } from "@/app/_components/PayvioMark";
import { api } from "@/convex/_generated/api";

export function JoinInvitationPage({ token }: { token: string }) {
  const router = useRouter();
  const invitation = useQuery(api.organizations.invitationByToken, { token });
  const user = useQuery(api.users.current);
  const acceptInvitation = useMutation(api.organizations.acceptInvitation);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    setPending(true);

    try {
      await acceptInvitation({ token });
      router.replace("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to accept invitation.");
    } finally {
      setPending(false);
    }
  }

  if (invitation === undefined || user === undefined) {
    return <JoinShell loading />;
  }

  if (!invitation) {
    return (
      <JoinShell>
        <section className="grid gap-4 rounded-xl border border-[#e6e7ec] bg-white p-4 shadow-sm">
          <Badge variant="destructive">Invalid link</Badge>
          <h1 className="text-xl font-semibold text-[#17181c]">Invitation not found</h1>
          <p className="text-sm leading-6 text-[#6f727b]">
            Ask your organization owner to send a fresh invite.
          </p>
        </section>
      </JoinShell>
    );
  }

  const next = encodeURIComponent(`/join/${token}`);
  const inactive = invitation.status !== "pending";
  const emailMatches =
    user && typeof user.email === "string"
      ? user.email.trim().toLowerCase() === invitation.email
      : false;

  return (
    <JoinShell>
      <div className="grid gap-5">
        <header className="grid justify-items-center gap-4 text-center">
          <div className="grid size-12 place-items-center rounded-2xl border border-[#e6e7ec] bg-white shadow-sm">
            <PayvioMark className="size-8 text-[#009b68]" />
          </div>
          <div className="grid gap-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#868891]">
              Workspace invitation
            </p>
            <h1 className="text-[1.55rem] font-semibold leading-tight text-[#17181c]">
              Join {invitation.organizationName}
            </h1>
            <p className="text-sm leading-6 text-[#6f727b]">
              This invite is for {invitation.email} with {roleLabel(invitation.role)}
              {" "}access.
            </p>
          </div>
        </header>

        <section className="grid gap-4 rounded-xl border border-[#e6e7ec] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3 rounded-lg border border-[#e6e7ec] bg-[#fbfbfc] p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#eff6f3] text-[#25745a]">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#17181c]">
                {invitation.organizationName}
              </p>
              <p className="text-xs text-[#6f727b]">
                {roleLabel(invitation.role)} access
              </p>
            </div>
          </div>

        {inactive ? (
          <p className="rounded-lg border border-[#ffc7d1] bg-[#fff0f3] p-3 text-sm text-[#a51f43]">
            This invitation is {invitation.status}. Ask for a new invite.
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-[#ffc7d1] bg-[#fff0f3] p-3 text-sm text-[#a51f43]">
            {error}
          </p>
        ) : null}

        {!user ? (
          <div className="grid gap-3 rounded-lg border border-[#deded8] bg-[#f6f6f4] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#505258]">
              <Mail className="size-4 text-[#009b68]" />
              Sign in to accept
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="bg-[#17181c] text-white hover:bg-[#2a2c33]">
                <Link href={`/login?next=${next}`}>Login</Link>
              </Button>
              <Button asChild variant="outline" className="border-[#deded8] bg-white">
                <Link href={`/signup?next=${next}`}>Create account</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {!emailMatches ? (
              <p className="rounded-lg border border-[#f7e09b] bg-[#fff9df] p-3 text-sm text-[#7d6000]">
                You are signed in as {user.email ?? "another account"}. Use{" "}
                {invitation.email} to accept this invitation.
              </p>
            ) : null}
            <Button
              type="button"
              disabled={pending || inactive || !emailMatches}
              onClick={handleAccept}
              className="h-10 w-full bg-[#17181c] text-white hover:bg-[#2a2c33]"
            >
              {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Join workspace
            </Button>
          </div>
        )}
        </section>
      </div>
    </JoinShell>
  );
}

function JoinShell({
  children,
  loading = false,
}: {
  children?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#fbfbfc] px-4 py-6 text-[#17181c]">
      <div className="grid w-full max-w-[420px]">
        {loading ? (
          <div className="grid justify-items-center gap-3 text-center">
            <div className="grid size-12 place-items-center rounded-2xl border border-[#e6e7ec] bg-white shadow-sm">
              <PayvioMark className="size-8 text-[#009b68]" />
            </div>
            <Loader2 className="size-5 animate-spin text-[#17181c]" />
            <p className="text-sm text-[#6f727b]">Loading invitation...</p>
          </div>
        ) : (
          children
        )}
      </div>
    </main>
  );
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
