import { ClientInvoicePage } from "./ClientInvoicePage";
import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preloadedInvoice = await preloadQuery(api.invoices.getByToken, { token });

  return <ClientInvoicePage token={token} preloadedInvoice={preloadedInvoice} />;
}
