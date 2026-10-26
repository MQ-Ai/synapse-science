// Browser-side Web Push helpers. Safe to import from client components only.

const PROMPT_DISMISSED_KEY = "sage_push_prompt_dismissed";

export type PushAvailability =
  | "unsupported"   // browser has no Push API
  | "needs-install" // iOS: push only works for home-screen web apps
  | "denied"        // user blocked notifications
  | "granted"       // already allowed (subscribe quietly if needed)
  | "default";      // not asked yet: show the soft pre-prompt

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getPushAvailability(): PushAvailability {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (isIOS() && !isStandalone()) return "needs-install";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "default";
}

export function wasPromptDismissed(): boolean {
  try {
    return localStorage.getItem(PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false; // private mode or blocked storage: show the prompt
  }
}

export function rememberPromptDismissed(): void {
  try {
    localStorage.setItem(PROMPT_DISMISSED_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type EnablePushResult = "subscribed" | "denied" | "unsupported" | "needs-install" | "error";

/**
 * Must be called from a user gesture (the "Turn on" button). Triggers the
 * native permission prompt, registers the service worker, subscribes with the
 * VAPID public key, and posts the subscription to the server.
 */
export async function enablePush(): Promise<EnablePushResult> {
  const availability = getPushAvailability();
  if (availability === "unsupported") return "unsupported";
  if (availability === "needs-install") return "needs-install";

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidKey) return "error";

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";
  }

  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    return res.ok ? "subscribed" : "error";
  } catch (err) {
    console.error("enablePush failed:", err);
    return "error";
  }
}
