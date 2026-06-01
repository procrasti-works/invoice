"use client";

import { useEffect } from "react";
import ReactDOM from "react-dom";

function originFromUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function PerformanceBoot() {
  const convexOrigin = originFromUrl(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (convexOrigin) {
    ReactDOM.preconnect(convexOrigin, { crossOrigin: "anonymous" });
    ReactDOM.prefetchDNS(convexOrigin);
  }

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    const isSecureOrigin =
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecureOrigin) {
      return;
    }

    const timeout = window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => undefined);
    }, 800);

    return () => window.clearTimeout(timeout);
  }, []);

  return null;
}
