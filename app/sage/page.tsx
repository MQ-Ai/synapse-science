"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Lead {
  Timestamp: string;
  Email: string;
  Name: string;
  Level: string;
  Source: string;
}

interface Session {
  Timestamp: string;
  Email: string;
  Name: string;
  Level: string;
  QuestionId: string;
  Year: string;
  Topic: string;
  Stars: string | number;
  TimeSecs: string | number;
  Turns: string | number;
  Completed: string;
}

interface Analytics {
  Leads?: Lead[];
  Sessions?: Session[];
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v: string | number | undefined): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function fmt(ts: string): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ago(ts: string): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: "#1a1a2e",
      border: "1px solid #2d2d4e",
      borderRadius: 16,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: accent || "#7c7cad", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 700, color: "#f0f0ff", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#5a5a80" }}>{sub}</div>}
    </div>
  );
}

// ─── Star bar ────────────────────────────────────────────────────────────────

function StarBar({ sessions }: { sessions: Session[] }) {
  const counts = [1, 2, 3].map(s => sessions.filter(x => num(x.Stars) === s).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const colours = ["#ef4444", "#f59e0b", "#22c55e"];
  const labels = ["1 ★ Needed help", "2 ★ Getting there", "3 ★ Nailed it"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[2, 1, 0].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 120, fontSize: 11, color: "#9090b0" }}>{labels[i]}</div>
          <div style={{ flex: 1, height: 10, background: "#2d2d4e", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${(counts[i] / total) * 100}%`, height: "100%", background: colours[i], borderRadius: 99, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ width: 28, textAlign: "right", fontSize: 12, color: "#7070a0", fontVariantNumeric: "tabular-nums" }}>{counts[i]}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Topic table ─────────────────────────────────────────────────────────────

function TopicTable({ sessions }: { sessions: Session[] }) {
  const map = new Map<string, { count: number; completed: number; stars: number; starCount: number }>();
  for (const s of sessions) {
    const t = s.Topic || "Unknown";
    const prev = map.get(t) ?? { count: 0, completed: 0, stars: 0, starCount: 0 };
    const star = num(s.Stars);
    map.set(t, {
      count: prev.count + 1,
      completed: prev.completed + (s.Completed === "Yes" ? 1 : 0),
      stars: prev.stars + star,
      starCount: prev.starCount + (star > 0 ? 1 : 0),
    });
  }
  const rows = Array.from(map.entries())
    .map(([topic, d]) => ({
      topic,
      count: d.count,
      pct: d.count > 0 ? Math.round((d.completed / d.count) * 100) : 0,
      avgStar: d.starCount > 0 ? (d.stars / d.starCount).toFixed(1) : "—",
    }))
    .sort((a, b) => b.count - a.count);

  if (!rows.length) return <div style={{ color: "#5a5a80", fontSize: 13 }}>No session data yet.</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {["Topic", "Attempts", "Completion", "Avg ★"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "6px 12px", color: "#5a5a80", fontWeight: 600, borderBottom: "1px solid #2d2d4e", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.topic} style={{ background: i % 2 === 0 ? "transparent" : "#16162a" }}>
              <td style={{ padding: "8px 12px", color: "#d0d0f0" }}>{r.topic}</td>
              <td style={{ padding: "8px 12px", color: "#9090c0", fontVariantNumeric: "tabular-nums" }}>{r.count}</td>
              <td style={{ padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 60, height: 6, background: "#2d2d4e", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${r.pct}%`, height: "100%", background: r.pct >= 75 ? "#22c55e" : r.pct >= 40 ? "#f59e0b" : "#ef4444", borderRadius: 99 }} />
                  </div>
                  <span style={{ color: "#9090c0", fontVariantNumeric: "tabular-nums" }}>{r.pct}%</span>
                </div>
              </td>
              <td style={{ padding: "8px 12px", color: "#f59e0b", fontVariantNumeric: "tabular-nums" }}>{r.avgStar}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Recent feed ─────────────────────────────────────────────────────────────

function RecentFeed({ leads, sessions }: { leads: Lead[]; sessions: Session[] }) {
  type FeedItem = { ts: string; type: "lead" | "session"; label: string; sub: string };
  const items: FeedItem[] = [
    ...leads.map(l => ({
      ts: l.Timestamp,
      type: "lead" as const,
      label: l.Name || l.Email,
      sub: `${l.Level || "?"} · signed up`,
    })),
    ...sessions.map(s => ({
      ts: s.Timestamp,
      type: "session" as const,
      label: s.Name || s.Email,
      sub: `${s.Topic || "?"} · ${s.Completed === "Yes" ? "✓ done" : "in progress"} · ${s.Stars ? `${"★".repeat(num(s.Stars))}` : ""}`,
    })),
  ]
    .filter(x => x.ts)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 20);

  if (!items.length) return <div style={{ color: "#5a5a80", fontSize: 13 }}>No activity yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #1e1e38" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: item.type === "lead" ? "#1e3a5f" : "#1e3a2a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
          }}>
            {item.type === "lead" ? "👤" : "🎯"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#d0d0f0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
            <div style={{ fontSize: 11, color: "#6060a0", marginTop: 1 }}>{item.sub}</div>
          </div>
          <div style={{ fontSize: 11, color: "#4a4a6a", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{ago(item.ts)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Level breakdown ─────────────────────────────────────────────────────────

function LevelBreakdown({ leads }: { leads: Lead[] }) {
  const levels = ["P1","P2","P3","P4","P5","P6"];
  const counts = levels.map(l => leads.filter(x => x.Level === l).length);
  const max = Math.max(...counts, 1);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80 }}>
      {levels.map((l, i) => (
        <div key={l} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 11, color: "#7070a0", fontVariantNumeric: "tabular-nums" }}>{counts[i] || ""}</div>
          <div style={{
            width: "100%",
            height: Math.max(4, (counts[i] / max) * 56),
            background: counts[i] > 0 ? "linear-gradient(180deg,#a855f7,#6d28d9)" : "#2d2d4e",
            borderRadius: "4px 4px 0 0",
            transition: "height 0.6s ease",
          }} />
          <div style={{ fontSize: 11, color: "#5a5a80" }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SagePage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sage-analytics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const leads: Lead[] = data?.Leads ?? [];
  const sessions: Session[] = data?.Sessions ?? [];

  const uniqueUsers = new Set([...leads.map(l => l.Email), ...sessions.map(s => s.Email)].filter(Boolean)).size;
  const completedSessions = sessions.filter(s => s.Completed === "Yes").length;
  const avgTime = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + num(s.TimeSecs), 0) / sessions.length)
    : 0;
  const avgStars = sessions.filter(s => num(s.Stars) > 0).length
    ? (sessions.reduce((a, s) => a + num(s.Stars), 0) / sessions.filter(s => num(s.Stars) > 0).length).toFixed(1)
    : "—";

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0d0d1a",
    color: "#d0d0f0",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: "24px 16px 48px",
  };

  const inner: React.CSSProperties = {
    maxWidth: 900,
    margin: "0 auto",
  };

  const card: React.CSSProperties = {
    background: "#1a1a2e",
    border: "1px solid #2d2d4e",
    borderRadius: 16,
    padding: 24,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#7c7cad",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 16,
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ ...inner, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #2d2d4e", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ color: "#5a5a80", fontSize: 14 }}>Loading analytics…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ ...inner, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ color: "#ef4444", fontSize: 14 }}>{error}</div>
          <button onClick={load} style={{ padding: "10px 24px", background: "#a855f7", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={inner}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22 }}>🧠</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f0f0ff", margin: 0 }}>Sage Analytics</h1>
            </div>
            {lastRefresh && (
              <div style={{ fontSize: 11, color: "#4a4a6a", marginTop: 4 }}>
                Last updated {lastRefresh.toLocaleTimeString("en-SG")}
              </div>
            )}
          </div>
          <button onClick={load} style={{
            padding: "8px 18px", background: "#1e1e38", color: "#9090c0",
            border: "1px solid #2d2d4e", borderRadius: 10, cursor: "pointer",
            fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
          }}>
            ↻ Refresh
          </button>
        </div>

        {/* Top stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <Stat label="Signups" value={leads.length} sub="registered users" accent="#a855f7" />
          <Stat label="Unique learners" value={uniqueUsers} sub="across all activity" accent="#818cf8" />
          <Stat label="Sessions" value={sessions.length} sub={`${completedSessions} completed`} accent="#34d399" />
          <Stat label="Avg time" value={avgTime ? `${avgTime}s` : "—"} sub="per session" accent="#f59e0b" />
          <Stat label="Avg rating" value={avgStars} sub="stars / session" accent="#f59e0b" />
        </div>

        {/* Level breakdown + star ratings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={card}>
            <div style={sectionTitle}>Signups by level</div>
            {leads.length > 0 ? <LevelBreakdown leads={leads} /> : <div style={{ color: "#5a5a80", fontSize: 13 }}>No signups yet.</div>}
          </div>
          <div style={card}>
            <div style={sectionTitle}>Star ratings</div>
            {sessions.length > 0 ? <StarBar sessions={sessions} /> : <div style={{ color: "#5a5a80", fontSize: 13 }}>No sessions yet.</div>}
          </div>
        </div>

        {/* Topic breakdown */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={sectionTitle}>Topic breakdown</div>
          <TopicTable sessions={sessions} />
        </div>

        {/* Activity feed */}
        <div style={card}>
          <div style={sectionTitle}>Recent activity</div>
          <RecentFeed leads={leads} sessions={sessions} />
        </div>

        {/* Raw lead list */}
        {leads.length > 0 && (
          <div style={{ ...card, marginTop: 20 }}>
            <div style={sectionTitle}>All signups ({leads.length})</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Time", "Name", "Email", "Level", "Source"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: "#5a5a80", fontWeight: 600, borderBottom: "1px solid #2d2d4e", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...leads].reverse().map((l, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#16162a" }}>
                      <td style={{ padding: "7px 10px", color: "#6060a0", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(l.Timestamp)}</td>
                      <td style={{ padding: "7px 10px", color: "#d0d0f0" }}>{l.Name || "—"}</td>
                      <td style={{ padding: "7px 10px", color: "#9090c0" }}>{l.Email}</td>
                      <td style={{ padding: "7px 10px", color: "#a855f7" }}>{l.Level}</td>
                      <td style={{ padding: "7px 10px", color: "#6060a0" }}>{l.Source || "psle"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
