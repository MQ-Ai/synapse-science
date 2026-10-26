"use client";

import { useEffect, useState, type CSSProperties, type ReactNode, type FormEvent } from "react";
import { enablePush, getPushAvailability, rememberPromptDismissed, wasPromptDismissed } from "@/lib/push-client";

type GateState = "checking" | "locked" | "submitting" | "pre-prompt" | "enabling" | "unlocked";

interface AccessGateProps {
  children: ReactNode;
  onUnlocked?: (email: string) => void;
}

export default function AccessGate({ children, onUnlocked }: AccessGateProps) {
  const [state, setState] = useState<GateState>("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  // Check for an existing signed cookie so returning users are not asked again.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/gate/unlock", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { unlocked?: boolean; email?: string | null }) => {
        if (cancelled) return;
        if (data.unlocked) {
          setState("unlocked");
          if (data.email) onUnlocked?.(data.email);
        } else {
          setState("locked");
        }
      })
      .catch(() => { if (!cancelled) setState("locked"); });
    return () => { cancelled = true; };
  }, [onUnlocked]);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setState("submitting");
    try {
      const res = await fetch("/api/gate/unlock", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; email?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setState("locked");
        return;
      }

      onUnlocked?.(data.email ?? email);

      // Soft pre-prompt only if the browser can actually subscribe and the user has not already decided.
      const availability = getPushAvailability();
      const shouldAsk = availability === "default" && !wasPromptDismissed();
      setState(shouldAsk ? "pre-prompt" : "unlocked");
    } catch {
      setError("Network error. Please try again.");
      setState("locked");
    }
  }

  async function handleEnable() {
    setState("enabling");
    // Runs inside the click handler so the native permission prompt is allowed.
    await enablePush();
    setState("unlocked");
  }

  function handleNotNow() {
    rememberPromptDismissed();
    setState("unlocked");
  }

  if (state === "checking") return null;
  if (state === "unlocked") return <>{children}</>;

  if (state === "pre-prompt" || state === "enabling") {
    return (
      <Backdrop>
        <div style={cardStyle}>
          <div style={{ fontSize: 36, textAlign: "center" }}>🔔</div>
          <h2 style={titleStyle}>Get notified when new content drops</h2>
          <p style={bodyStyle}>
            Sage will send a quick alert when new PSLE questions and practice sets are added,
            so you never miss a session. You can turn this off in your browser settings at any time.
          </p>
          <button onClick={handleEnable} disabled={state === "enabling"} style={primaryButton}>
            {state === "enabling" ? "Turning on…" : "Turn on notifications"}
          </button>
          <button onClick={handleNotNow} disabled={state === "enabling"} style={secondaryButton}>
            Not now
          </button>
        </div>
      </Backdrop>
    );
  }

  // "locked" or "submitting": email entry
  return (
    <Backdrop>
      <form onSubmit={handleEmailSubmit} style={cardStyle}>
        <div style={{ fontSize: 36, textAlign: "center" }}>✉️</div>
        <h2 style={titleStyle}>Enter your email to continue</h2>
        <p style={bodyStyle}>Unlock full access to Sage&apos;s PSLE Science practice.</p>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === "submitting"}
          style={inputStyle}
        />
        {error && <p style={{ color: "#dc2626", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
        <button type="submit" disabled={state === "submitting"} style={{ ...primaryButton, marginTop: 14 }}>
          {state === "submitting" ? "Unlocking…" : "Unlock access"}
        </button>
      </form>
    </Backdrop>
  );
}

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(40,20,60,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "white", borderRadius: 20, padding: 24, width: "100%", maxWidth: 380,
  boxShadow: "0 20px 50px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: 10,
};
const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 700, textAlign: "center", margin: 0, color: "#1f2937" };
const bodyStyle: CSSProperties = { fontSize: 14, lineHeight: 1.5, textAlign: "center", color: "#6b7280", margin: 0 };
const inputStyle: CSSProperties = {
  border: "1.5px solid #e9d5ff", borderRadius: 12, padding: "12px 14px", fontSize: 15, outline: "none",
};
const primaryButton: CSSProperties = {
  background: "linear-gradient(135deg,#f97316,#a855f7)", color: "white", border: "none",
  borderRadius: 12, padding: "12px 16px", fontWeight: 600, fontSize: 15, cursor: "pointer",
};
const secondaryButton: CSSProperties = {
  background: "transparent", color: "#6b7280", border: "none", padding: 8, fontSize: 14, cursor: "pointer",
};
