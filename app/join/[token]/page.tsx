import type { Metadata } from "next";

import { JoinInvitationPage } from "./JoinInvitationPage";

export const metadata: Metadata = {
  title: "Join workspace | Payvio",
  description: "Accept a Payvio organization invitation.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <JoinInvitationPage token={token} />;
}
