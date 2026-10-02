"use client";

import { useState, useEffect, useRef } from "react";
import { saveToRepository, type RepositoryQuestion } from "@/lib/repository";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MockQuestion {
  id: string;
  questionNumber: number;
  part: string;
  topic: string;
  question: string;
  marks: number;
  modelAnswer?: string;
  paperTitle: string;
  firstAttemptScore?: number;   // from repository, if any
}

interface MarkingResult {
  id: string;
  score: number;
  whatIsRight: string;
  whatIsMissing: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

function scoreColor(score: number, marks: number) {
  const pct = marks === 0 ? 0 : score / marks;
  if (pct >= 1) return "#16a34a";
  if (pct >= 0.5) return "#d97706";
  return "#dc2626";
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function MockPaperPage() {
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<MarkingResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Timer
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [timerInput, setTimerInput] = useState("30");
  const [timerStarted, setTimerStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Repository save after results
  const [savedResultIds, setSavedResultIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sage_mock_paper_questions");
      if (raw) {
        sessionStorage.removeItem("sage_mock_paper_questions");
        setQuestions(JSON.parse(raw) as MockQuestion[]);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!timerStarted || secondsLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [timerStarted]);

  function startTimer() {
    const mins = parseInt(timerInput, 10);
    if (isNaN(mins) || mins < 1) return;
    setTimerMinutes(mins);
    setSecondsLeft(mins * 60);
    setTimerStarted(true);
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/mock-paper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questions, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark paper");
      setResults(data.results as MarkingResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveToRepo(q: MockQuestion, result: MarkingResult) {
    try {
      const raw = localStorage.getItem("sage_student_profile");
      if (!raw) return;
      const { email } = JSON.parse(raw) as { email: string };
      const rq: RepositoryQuestion = {
        id: q.id,
        savedAt: Date.now(),
        paperTitle: q.paperTitle,
        questionNumber: q.questionNumber,
        part: q.part,
        topic: q.topic,
        question: q.question,
        marks: q.marks,
        firstAttemptAnswer: answers[q.id] || "",
        firstAttemptScore: result.score,
      };
      saveToRepository(email, rq);
      setSavedResultIds(prev => new Set([...Array.from(prev), q.id]));
    } catch { /* ignore */ }
  }

  function handleSaveAllMissed() {
    if (!results) return;
    for (const result of results) {
      const q = questions.find(x => x.id === result.id);
      if (q && result.score < q.marks && !savedResultIds.has(q.id)) {
        handleSaveToRepo(q, result);
      }
    }
  }

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const totalScore = results
    ? results.reduce((s, r) => s + r.score, 0)
    : 0;
  const pct = totalMarks === 0 ? 0 : Math.round((totalScore / totalMarks) * 100);

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
    textarea { resize: vertical; font-family: inherit; }
    textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  `;

  if (questions.length === 0) {
    return (
      <>
        <style>{style}</style>
        <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
          <p style={{ fontSize: 48 }}>📋</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", margin: 0 }}>No questions loaded</p>
          <p style={{ fontSize: 14, color: "var(--mid)", margin: 0 }}>Go to your Repository and select questions to build a mock paper.</p>
          <a href="/repository" style={{ background: "var(--accent)", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600 }}>
            Go to Repository →
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{style}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

        {/* Nav */}
        <div style={{ background: "var(--card)", borderBottom: "1px solid var(--rule)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
          <a href="/repository" style={{ fontSize: 14, color: "var(--mid)", textDecoration: "none" }}>← Repository</a>
          <span style={{ color: "var(--rule)" }}>|</span>
          <a href="/" style={{ fontSize: 14, color: "var(--mid)", textDecoration: "none" }}>Sage</a>
          <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>📝 Mock Paper</span>
          {/* Timer display */}
          {timerStarted && (
            <span style={{
              fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: secondsLeft < 300 ? "#dc2626" : "var(--fg)",
              background: "var(--bg)", borderRadius: 8, padding: "4px 12px",
            }}>
              ⏱ {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
            </span>
          )}
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Header */}
          <div style={{ background: "var(--card)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg)" }}>📝 Mock Paper</p>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--mid)" }}>
                {questions.length} question{questions.length !== 1 ? "s" : ""} · {totalMarks} marks total
              </p>
            </div>

            {/* Timer setup */}
            {!results && !timerStarted && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "var(--mid)" }}>Optional timer:</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timerInput}
                  onChange={e => setTimerInput(e.target.value)}
                  style={{ width: 60, border: "1px solid var(--rule)", borderRadius: 6, padding: "5px 8px", fontSize: 13, background: "var(--bg)", color: "var(--fg)", textAlign: "center" }}
                />
                <span style={{ fontSize: 13, color: "var(--mid)" }}>min</span>
                <button
                  onClick={startTimer}
                  style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Start timer
                </button>
                <button
                  onClick={() => setTimerStarted(true)}
                  style={{ background: "none", color: "var(--mid)", border: "1px solid var(--rule)", borderRadius: 6, padding: "5px 14px", fontSize: 13, cursor: "pointer" }}
                >
                  No timer
                </button>
              </div>
            )}

            {/* Score banner after submit */}
            {results && (
              <div style={{ background: `${scoreColor(totalScore, totalMarks)}15`, border: `1px solid ${scoreColor(totalScore, totalMarks)}40`, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: scoreColor(totalScore, totalMarks) }}>{totalScore}/{totalMarks}</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--mid)" }}>{pct}% · Mock paper results</p>
                </div>
                <button
                  onClick={handleSaveAllMissed}
                  style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  💾 Save all missed questions →
                </button>
              </div>
            )}
          </div>

          {/* Questions */}
          {questions.map((q, idx) => {
            const result = results?.find(r => r.id === q.id);
            const isSaved = savedResultIds.has(q.id);
            const missed = result && result.score < q.marks;
            return (
              <div key={q.id} style={{ background: "var(--card)", border: `1px solid ${result ? scoreColor(result.score, q.marks) + "60" : "var(--rule)"}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Question header */}
                <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
                        Q{q.questionNumber}{q.part ? `(${q.part})` : ""}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "var(--accent)20", color: "var(--accent)" }}>
                        {q.topic}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--mid)", marginLeft: "auto" }}>
                        [{q.marks} mark{q.marks !== 1 ? "s" : ""}]
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--fg)", lineHeight: 1.6 }}>{q.question}</p>
                  </div>
                  {result && (
                    <div style={{ flexShrink: 0, fontSize: 18, fontWeight: 800, color: scoreColor(result.score, q.marks) }}>
                      {result.score}/{q.marks}
                    </div>
                  )}
                </div>

                {/* Answer area */}
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {!results ? (
                    <textarea
                      placeholder={`Write your answer here… (${q.marks} mark${q.marks !== 1 ? "s" : ""})`}
                      value={answers[q.id] || ""}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      rows={3}
                      style={{
                        width: "100%", border: "1px solid var(--rule)", borderRadius: 8, padding: "10px 12px",
                        fontSize: 14, background: "var(--bg)", color: "var(--fg)", lineHeight: 1.5,
                      }}
                    />
                  ) : (
                    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
                      <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Your answer</p>
                      <p style={{ margin: 0, fontSize: 13, color: "var(--fg)", fontStyle: "italic", lineHeight: 1.5 }}>
                        {answers[q.id] || <span style={{ color: "var(--mid)" }}>No answer written</span>}
                      </p>
                    </div>
                  )}

                  {/* Feedback */}
                  {result && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {result.whatIsRight && (
                        <div style={{ background: "#16a34a10", border: "1px solid #16a34a30", borderRadius: 8, padding: "8px 12px" }}>
                          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em" }}>✓ What you got right</p>
                          <p style={{ margin: 0, fontSize: 13, color: "var(--fg)", lineHeight: 1.5 }}>{result.whatIsRight}</p>
                        </div>
                      )}
                      {result.whatIsMissing && (
                        <div style={{ background: "#dc262610", border: "1px solid #dc262630", borderRadius: 8, padding: "8px 12px" }}>
                          <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>✗ What was missing</p>
                          <p style={{ margin: 0, fontSize: 13, color: "var(--fg)", lineHeight: 1.5 }}>{result.whatIsMissing}</p>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {missed && (
                          <button
                            onClick={() => handleSaveToRepo(q, result)}
                            style={{
                              background: isSaved ? "#16a34a" : "none",
                              color: isSaved ? "#fff" : "var(--mid)",
                              border: `1px solid ${isSaved ? "#16a34a" : "var(--rule)"}`,
                              borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                            }}
                          >
                            {isSaved ? "✓ Saved to Repository" : "💾 Save to Repository"}
                          </button>
                        )}
                        <a
                          href={`/?q=${encodeURIComponent(q.id)}`}
                          style={{ background: "#7C3AED", color: "#fff", textDecoration: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600 }}
                        >
                          Discuss with Sage →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Submit */}
          {!results && (timerStarted || timerMinutes === null) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {error && (
                <p style={{ margin: 0, fontSize: 13, color: "#dc2626", background: "#dc262610", borderRadius: 8, padding: "10px 14px" }}>{error}</p>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  background: submitting ? "var(--mid)" : "var(--accent)",
                  color: "#fff", border: "none", borderRadius: 10, padding: "14px 0",
                  fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", width: "100%",
                }}
              >
                {submitting ? "Marking your paper…" : `Submit Paper · ${totalMarks} marks`}
              </button>
            </div>
          )}

          {/* Start paper prompt (before timer is started) */}
          {!results && !timerStarted && timerMinutes === null && (
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--mid)", margin: 0 }}>
              Set a timer above and begin — or skip the timer to start immediately.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
