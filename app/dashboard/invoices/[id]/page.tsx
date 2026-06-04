import type { Metadata } from "next";

import { InvoiceViewerPage } from "./InvoiceViewerPage";

export const metadata: Metadata = {
  title: "Invoice details | Payvio",
  description: "View invoice details, client activity, and payment history.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <InvoiceViewerPage invoiceId={id} />;
}
