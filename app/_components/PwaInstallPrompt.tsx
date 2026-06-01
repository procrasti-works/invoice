"use client";

import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "payvio.pwaInstall.dismissed.v1";

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsIos(isIosDevice());
      setIsStandalone(isStandaloneMode());
      setIsDismissed(window.localStorage.getItem(DISMISSED_KEY) === "true");
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsDismissed(false);
    }

    function handleInstalled() {
      setInstallEvent(null);
      setIsStandalone(true);
      window.localStorage.setItem(DISMISSED_KEY, "true");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const canPrompt = Boolean(installEvent);
  const shouldShow = !isDismissed && !isStandalone && (canPrompt || isIos);

  if (!shouldShow) {
    return null;
  }

  async function handleInstall() {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);

    if (choice.outcome === "accepted") {
      window.localStorage.setItem(DISMISSED_KEY, "true");
      setIsDismissed(true);
    }
  }

  return (
    <aside className="pwa-install-card" aria-label="Install Payvio app">
      <div className="pwa-install-icon" aria-hidden="true">
        {isIos && !canPrompt ? (
          <Share2 className="size-4" />
        ) : (
          <Download className="size-4" />
        )}
      </div>
      <div className="pwa-install-copy">
        <strong>Install Payvio</strong>
        <span>
          {isIos && !canPrompt
            ? "Use Share, then Add to Home Screen."
            : "Open Payvio from your home screen."}
        </span>
      </div>
      <div className="pwa-install-actions">
        {canPrompt ? (
          <button type="button" className="pwa-install-btn" onClick={handleInstall}>
            Install
          </button>
        ) : null}
        <button
          type="button"
          className="pwa-install-dismiss"
          aria-label="Dismiss install prompt"
          onClick={() => {
            window.localStorage.setItem(DISMISSED_KEY, "true");
            setIsDismissed(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
