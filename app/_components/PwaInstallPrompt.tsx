"use client";

import { Download, Share2, X } from "@/app/_components/IconPack";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const LEGACY_DISMISSED_KEY = "payvio.pwaInstall.dismissed.v1";
const INSTALLED_KEY = "payvio.pwaInstall.installed.v1";
const SUPPRESSED_UNTIL_KEY = "payvio.pwaInstall.suppressedUntil.v1";
const PROMPT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

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

function getStoredNumber(key: string) {
  const value = window.localStorage.getItem(key);
  const parsed = value ? Number(value) : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

function isPromptSuppressed(now = Date.now()) {
  if (window.localStorage.getItem(INSTALLED_KEY) === "true") {
    return true;
  }

  const suppressedUntil = getStoredNumber(SUPPRESSED_UNTIL_KEY);

  if (suppressedUntil > now) {
    return true;
  }

  if (window.localStorage.getItem(LEGACY_DISMISSED_KEY) === "true") {
    window.localStorage.setItem(
      SUPPRESSED_UNTIL_KEY,
      String(now + PROMPT_COOLDOWN_MS),
    );
    window.localStorage.removeItem(LEGACY_DISMISSED_KEY);

    return true;
  }

  if (suppressedUntil > 0) {
    window.localStorage.removeItem(SUPPRESSED_UNTIL_KEY);
  }

  return false;
}

function suppressPromptForCooldown() {
  window.localStorage.setItem(
    SUPPRESSED_UNTIL_KEY,
    String(Date.now() + PROMPT_COOLDOWN_MS),
  );
}

function markPromptInstalled() {
  window.localStorage.setItem(INSTALLED_KEY, "true");
  window.localStorage.removeItem(SUPPRESSED_UNTIL_KEY);
  window.localStorage.removeItem(LEGACY_DISMISSED_KEY);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isSuppressed, setIsSuppressed] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsIos(isIosDevice());
      setIsStandalone(isStandaloneMode());
      setIsSuppressed(isPromptSuppressed());
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();

      if (isPromptSuppressed()) {
        setInstallEvent(null);
        setIsSuppressed(true);
        return;
      }

      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsSuppressed(false);
    }

    function handleInstalled() {
      setInstallEvent(null);
      setIsStandalone(true);
      setIsSuppressed(true);
      markPromptInstalled();
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
  const shouldShow = !isSuppressed && !isStandalone && (canPrompt || isIos);

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
      markPromptInstalled();
      setIsSuppressed(true);
      return;
    }

    suppressPromptForCooldown();
    setIsSuppressed(true);
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
            suppressPromptForCooldown();
            setIsSuppressed(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
