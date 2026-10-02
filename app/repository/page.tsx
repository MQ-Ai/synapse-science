"use client";

import { useState, useEffect } from "react";
import {
  getRepository,
  removeFromRepository,
  getTopics,
  type RepositoryQuestion,
} from "@/lib/repository";

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number, marks: number) {
  const pct = marks === 0 ? 0 : score / marks;
  if (pct >= 1) return "#16a34a";
  if (pct >= 0.5) return "#d97706";
  return "#dc2626";
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

// ── Components ─────────────────────────────────────────────────────────────────

function QuestionTile({
  q,
  onAttempt,
  onRemove,
}: {
  q: RepositoryQuestion;
  onAttempt: (q: RepositoryQuestion) => void;
  onRemove: (q: RepositoryQuestion) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pct = q.marks === 0 ? 0 : Math.round((q.firstAttemptScore / q.marks) * 100);

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", background: "none", border: "none", cursor: "pointer", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", whiteSpace: "nowrap" }}>
            Q{q.questionNumber}{q.part ? `(${q.part})` : ""}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            background: "var(--accent)20", color: "var(--accent)", whiteSpace: "nowrap",
          }}>
            {q.topic}
          </span>
          {q.sageDiscussion && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#7C3AED20", color: "#7C3AED", whiteSpace: "nowrap" }}>
              💬 Discussed
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: scoreColor(q.firstAttemptScore, q.marks),
          }}>
            {q.firstAttemptScore}/{q.marks}
          </span>
          <span style={{ color: "var(--mid)", fontSize: 16 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Source */}
          <p style={{ margin: 0, fontSize: 11, color: "var(--mid)" }}>
            {q.paperTitle} · Saved {fmtDate(q.savedAt)}
          </p>

          {/* Question */}
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Question</p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--fg)", lineHeight: 1.5 }}>{q.question}</p>
          </div>

          {/* 1st attempt */}
          <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              1st Attempt · {q.firstAttemptScore}/{q.marks} ({pct}%)
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--fg)", fontStyle: "italic", lineHeight: 1.5 }}>
              {q.firstAttemptAnswer || <span style={{ color: "var(--mid)" }}>No answer recorded</span>}
            </p>
          </div>

          {/* Sage discussion trail */}
          {q.sageDiscussion && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Sage Discussion · {q.sageDiscussion.starsEarned} ⭐ earned
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                {q.sageDiscussion.turns.filter(t => t.content).map((t, i) => (
                  <div key={i} style={{
                    background: t.role === "sage" ? "#7C3AED10" : "var(--bg)",
                    borderRadius: 8, padding: "8px 12px",
                  }}>
                    <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: t.role === "sage" ? "#7C3AED" : "var(--mid)", textTransform: "uppercase" }}>
                      {t.role === "sage" ? "Sage" : "Student"}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--fg)", lineHeight: 1.4 }}>{t.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => onAttempt(q)}
              style={{
                background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: 8, padding: "9px 16px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {q.sageDiscussion ? "Retry with Sage →" : "Discuss with Sage →"}
            </button>
            <button
              onClick={() => onRemove(q)}
              style={{
                background: "none", color: "#dc2626",
                border: "1px solid #dc262640", borderRadius: 8, padding: "9px 16px",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function RepositoryPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [questions, setQuestions] = useState<RepositoryQuestion[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [filterTopic, setFilterTopic] = useState("All Topics");
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sage_student_profile");
      if (raw) {
        const { email: e } = JSON.parse(raw) as { email: string };
        loadRepo(e);
      }
    } catch { /* ignore */ }
  }, []);

  function loadRepo(e: string) {
    setEmail(e);
    const repo = getRepository(e);
    setQuestions(repo);
    setTopics(["All Topics", ...getTopics(e)]);
  }

  function handleEmailSubmit() {
    const e = emailInput.trim();
    if (!e) return;
    try {
      localStorage.setItem("sage_student_profile", JSON.stringify({ email: e, name: "", level: "" }));
    } catch { /* ignore */ }
    loadRepo(e);
  }

  function handleAttempt(q: RepositoryQuestion) {
    const sageQuestion = {
      ...q,
      id: q.id,
      year: new Date().getFullYear(),
      studentAnswer: q.firstAttemptAnswer,
      autoScore: q.firstAttemptScore,
    };
    sessionStorage.setItem("sage_pending_question", JSON.stringify(sageQuestion));
    window.location.href = "/";
  }

  function handleRemove(q: RepositoryQuestion) {
    if (!email) return;
    removeFromRepository(email, q.id, q.paperTitle);
    const repo = getRepository(email);
    setQuestions(repo);
    setTopics(["All Topics", ...getTopics(email)]);
  }

  const filtered = filterTopic === "All Topics"
    ? questions
    : questions.filter(q => q.topic === filterTopic);

  // ── Styles ──────────────────────────────────────────────────────────────────

  const style = `
    :root {
      --bg: #1a1a1a; --card: #242424; --fg: #f0f0f0; --mid: #888;
      --rule: #333; --accent: #f97316;
    }
    @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) {
      --bg: #f8f8f8; --card: #ffffff; --fg: #1a1a1a; --mid: #666;
      --rule: #e5e5e5; --accent: #f97316;
    }}
    :root[data-theme="light"] {
      --bg: #f8f8f8; --card: #ffffff; --fg: #1a1a1a; --mid: #666;
      --rule: #e5e5e5; --accent: #f97316;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
    input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  `;

  return (
    <>
      <style>{style}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "0 0 60px" }}>

        {/* Nav */}
        <div style={{ background: "var(--card)", borderBottom: "1px solid var(--rule)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ fontSize: 14, color: "var(--mid)", textDecoration: "none" }}>← Sage</a>
          <span style={{ color: "var(--rule)" }}>|</span>
          <a href="/marking-centre" style={{ fontSize: 14, color: "var(--mid)", textDecoration: "none" }}>Marking Centre</a>
          <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>📚 My Repository</span>
        </div>

        <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* No email yet */}
          {!email && (
            <div style={{ background: "var(--card)", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: "var(--fg)" }}>Your Question Repository</p>
              <p style={{ margin: 0, fontSize: 14, color: "var(--mid)", lineHeight: 1.5 }}>
                Enter your email to load your saved questions.
              </p>
              <input
                type="email"
                placeholder="your@email.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
                style={{
                  border: "1px solid var(--rule)", borderRadius: 8, padding: "10px 14px",
                  fontSize: 15, background: "var(--bg)", color: "var(--fg)",
                }}
                autoFocus
              />
              <button
                onClick={handleEmailSubmit}
                style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
              >
                Load Repository
              </button>
            </div>
          )}

          {/* Repository content */}
          {email && (
            <>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--fg)" }}>
                    {questions.length} question{questions.length !== 1 ? "s" : ""} saved
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--mid)" }}>{email}</p>
                </div>
                <select
                  value={filterTopic}
                  onChange={e => setFilterTopic(e.target.value)}
                  style={{
                    border: "1px solid var(--rule)", borderRadius: 8, padding: "8px 12px",
                    fontSize: 13, background: "var(--card)", color: "var(--fg)", cursor: "pointer",
                  }}
                >
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {filtered.length === 0 ? (
                <div style={{ background: "var(--card)", borderRadius: 12, padding: 32, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 15, color: "var(--mid)" }}>
                    {questions.length === 0
                      ? "No questions saved yet. Go to Marking Centre and click \"Save to Repository\" on any question."
                      : `No questions in topic "${filterTopic}".`}
                  </p>
                </div>
              ) : (
                filtered.map((q, i) => (
                  <QuestionTile key={i} q={q} onAttempt={handleAttempt} onRemove={handleRemove} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
