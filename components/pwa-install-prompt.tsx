"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Plus, Share, X } from "lucide-react";
import { MEANINGFUL_ACTION_EVENT } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "ios" | "native";
type Stored = { state: "installed" | "dismissed"; at: number };

const STORAGE_KEY = "khora.pwa-install";
// A dismissal is remembered for 90 days; an install is remembered forever.
const DISMISS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function remember(state: Stored["state"]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, at: Date.now() } satisfies Stored));
  } catch {
    // Storage can be blocked (private mode); the prompt then simply may reappear next visit.
  }
}

function isSuppressed() {
  const stored = readStored();
  if (!stored) return false;
  return stored.state === "installed" || Date.now() - stored.at < DISMISS_TTL_MS;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIos && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export default function PwaInstallPrompt() {
  const [mode, setMode] = useState<Mode | null>(null);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const wantsPromptRef = useRef(false);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      // The user already did something meaningful before the browser handed us the install event.
      if (wantsPromptRef.current && !isSuppressed() && !isStandalone()) setMode("native");
    }

    function onMeaningfulAction() {
      if (isStandalone() || isSuppressed()) return;
      if (isIosSafari()) setMode("ios");
      else if (deferredRef.current) setMode("native");
      else wantsPromptRef.current = true;
    }

    function onInstalled() {
      remember("installed");
      deferredRef.current = null;
      wantsPromptRef.current = false;
      setMode(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(MEANINGFUL_ACTION_EVENT, onMeaningfulAction);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(MEANINGFUL_ACTION_EVENT, onMeaningfulAction);
    };
  }, []);

  function dismiss() {
    remember("dismissed");
    wantsPromptRef.current = false;
    setMode(null);
  }

  async function install() {
    const deferred = deferredRef.current;
    if (!deferred) return;
    setMode(null);
    deferredRef.current = null; // The event can only be used once.
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      remember(outcome === "accepted" ? "installed" : "dismissed");
    } catch (error) {
      console.error("Install prompt failed", error);
    }
  }

  if (!mode) return null;

  return (
    <section
      aria-label="Install Khora Flow"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur [padding-bottom:max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
          {mode === "ios" ? <Share size={17} aria-hidden /> : <Download size={17} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Add Khora Flow to your home screen</p>
          {mode === "ios" ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Tap the Share button <span role="img" aria-label="share icon">⎋</span> and select &lsquo;Add to Home Screen&rsquo; <span role="img" aria-label="plus icon">➕</span>
            </p>
          ) : (
            <p className="mt-1 text-xs leading-5 text-slate-400">Open it like an app and get back to your deals in one tap.</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {mode === "native" && (
              <button type="button" onClick={install} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300">
                <Plus size={14} aria-hidden />Install
              </button>
            )}
            <button type="button" onClick={dismiss} className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-medium text-slate-400 transition-colors hover:text-white">
              {mode === "ios" ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-white">
          <X size={16} aria-hidden />
        </button>
      </div>
    </section>
  );
}
