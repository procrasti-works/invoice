"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "./_components/ThemeProvider";

let convex: ConvexReactClient | null = null;

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_CONVEX_URL. Run the Convex dev server to populate .env.local.",
    );
  }

  convex ??= new ConvexReactClient(url);
  return convex;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ConvexAuthNextjsProvider client={getConvexClient()}>
        {children}
      </ConvexAuthNextjsProvider>
    </ThemeProvider>
  );
}
