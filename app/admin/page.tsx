import type { Metadata } from "next";

import { AdminPage } from "./_components/AdminPage";

export const metadata: Metadata = {
  title: "Admin | Payvio",
  description: "Payvio platform administration.",
};

export default function Page() {
  return <AdminPage />;
}
