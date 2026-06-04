import type { Metadata } from "next";

import { AccountSettingsPage } from "../_components/AccountSettingsPage";

export const metadata: Metadata = {
  title: "Account Settings | Invoice Ledger",
  description: "Personal profile settings for Invoice Ledger.",
};

export default function Page() {
  return <AccountSettingsPage />;
}
