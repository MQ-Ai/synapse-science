"use client";

import { useState, useRef } from "react";
import { saveToRepository, getRepository, type RepositoryQuestion } from "@/lib/repository";

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode = "mark" | "discuss";
type Step = "choose" | "upload" | "payment" | "processing" | "report";

interface TeacherAnnotations {
  ticks: number;
  crosses: number;
  redUnderlines: string[];
  redStrikethroughs: string[];
  writtenComments: string;
}

interface QuestionResult {
  questionNumber: number;
  part: string;
  topic: string;
  question: string;
  marks: number;
  studentAnswer: string;
  studentCorrections?: string;
  autoScore: number;
  scoreRationale: string;
  whatIsRight: string;
  whatIsMissing: string;
  teacherMarking?: string;
  teacherAnnotations?: TeacherAnnotations;
  hasTeacherMarking: boolean;
}

interface SectionResult {
  name: string;
  sectionTotalMarks: number;
  questions: QuestionResult[];
}

interface TopicSummary {
  topic: string;
  marksAttained: number;
  totalMarks: number;
  percentage: number;
  status: "strong" | "needs-work" | "weak";
}

interface MarkingReport {
  mode: "mark";
  paperTitle: string;
  totalPaperMarks: number;
  marksAttained: number;
  percentage: number;
  sections: SectionResult[];
  topicAnalysis: TopicSummary[];
  recommendedSessions: QuestionResult[];
}

interface DiscussQuestion {
  questionNumber: number;
  part: string;
  topic: string;
  question: string;
  marks: number;
  studentAnswer: string;
  teacherFeedback: string;
  teacherAnnotations?: TeacherAnnotations;
  studentCorrections: string;
  hasTeacherMarking: boolean;
  estimatedScore: number;
  needsDiscussion: boolean;
}

interface DiscussReport {
  mode: "discuss";
  paperTitle: string;
  totalPaperMarks: number;
  estimatedTotal: number;
  markedQuestions: DiscussQuestion[];
  questionsNeedingHelp: DiscussQuestion[];
}

type Report = MarkingReport | DiscussReport;

// ── Pricing tiers ──────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "single",
    name: "Single Scan",
    price: "S$4.90",
    description: "1 paper marked + full report",
    highlight: false,
  },
  {
    id: "pack",
    name: "5-Paper Pack",
    price: "S$19.00",
    description: "5 paper scans + reports",
    highlight: true,
    badge: "Best value",
  },
  {
    id: "season",
    name: "Season Pass",
    price: "S$49.00",
    description: "Unlimited scans + Sage sessions for 3 months",
    highlight: false,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Renders text that may contain ~~strikethrough~~ segments (student self-corrections).
 * Returns an array of React nodes — use inside a <p> or <span>.
 */
function renderStudentText(text: string): React.ReactNode[] {
  const parts = text.split(/(~~[^~]+~~)/g);
  return parts.map((part, i) => {
    if (part.startsWith("~~") && part.endsWith("~~")) {
      const inner = part.slice(2, -2);
      return (
        <s key={i} style={{ color: "#888", textDecorationColor: "#aaa", textDecorationStyle: "solid" }}>
          {inner}
        </s>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/**
 * Visual panel showing teacher red-ink annotations with actual underlines and strikethroughs.
 */
function TeacherAnnotationsPanel({ annotations, fallbackText }: {
  annotations?: TeacherAnnotations;
  fallbackText?: string;
}) {
  const hasTicks = annotations && annotations.ticks > 0;
  const hasCrosses = annotations && annotations.crosses > 0;
  const hasUnderlines = annotations && annotations.redUnderlines && annotations.redUnderlines.length > 0;
  const hasStrikethroughs = annotations && annotations.redStrikethroughs && annotations.redStrikethroughs.length > 0;
  const hasComments = annotations && annotations.writtenComments;
  const hasAny = hasTicks || hasCrosses || hasUnderlines || hasStrikethroughs || hasComments;

  if (!hasAny && !fallbackText) return null;

  return (
    <div style={{ background: "#dc262608", borderRadius: 8, padding: "10px 12px", borderLeft: "3px solid #dc2626" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Teacher&rsquo;s Feedback
      </p>

      {hasAny ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Ticks and crosses */}
          {(hasTicks || hasCrosses) && (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {hasTicks && (
                <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 15 }}>
                  {"✓".repeat(Math.min(annotations!.ticks, 8))}
                  {annotations!.ticks > 8 ? ` ×${annotations!.ticks}` : ""}
                </span>
              )}
              {hasCrosses && (
                <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 15 }}>
                  {"✗".repeat(Math.min(annotations!.crosses, 8))}
                  {annotations!.crosses > 8 ? ` ×${annotations!.crosses}` : ""}
                </span>
              )}
            </div>
          )}

          {/* Red underlines */}
          {hasUnderlines && (
            <div>
              <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginRight: 6 }}>Underlined:</span>
              <span style={{ fontSize: 13, color: "var(--fg)" }}>
                {annotations!.redUnderlines.map((phrase, i) => (
                  <span key={i}>
                    <span style={{ textDecoration: "underline", textDecorationColor: "#dc2626", textUnderlineOffset: 3 }}>
                      {phrase}
                    </span>
                    {i < annotations!.redUnderlines.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            </div>
          )}

          {/* Red strikethroughs */}
          {hasStrikethroughs && (
            <div>
              <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginRight: 6 }}>Crossed out:</span>
              <span style={{ fontSize: 13, color: "var(--fg)" }}>
                {annotations!.redStrikethroughs.map((phrase, i) => (
                  <span key={i}>
                    <s style={{ color: "#dc2626", textDecorationColor: "#dc2626" }}>{phrase}</s>
                    {i < annotations!.redStrikethroughs.length - 1 ? ", " : ""}
                  </span>
                ))}
              </span>
            </div>
          )}

          {/* Written comments */}
          {hasComments && (
            <p style={{ margin: 0, fontSize: 13, color: "#dc2626", fontStyle: "italic" }}>
              &ldquo;{annotations!.writtenComments}&rdquo;
            </p>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--fg)", margin: 0, lineHeight: 1.5 }}>{fallbackText}</p>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  const color = pct >= 75 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: color + "18", color, border: `1px solid ${color}40`,
      borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 600,
    }}>
      {score}/{total}
    </span>
  );
}

function TopicBar({ topic }: { topic: TopicSummary }) {
  const barColor = topic.status === "strong" ? "#16a34a" : topic.status === "needs-work" ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, color: "var(--fg)" }}>{topic.topic}</span>
        <span style={{ fontSize: 13, color: "var(--mid)", fontWeight: 600 }}>
          {topic.marksAttained}/{topic.totalMarks} ({topic.percentage}%)
        </span>
      </div>
      <div style={{ height: 6, background: "var(--rule)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${topic.percentage}%`, background: barColor, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  onStartSage,
  onSaveToRepo,
  savedIds,
}: {
  q: QuestionResult | DiscussQuestion;
  onStartSage: (q: QuestionResult | DiscussQuestion) => void;
  onSaveToRepo: (q: QuestionResult | DiscussQuestion) => void;
  savedIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMarkQ = "autoScore" in q;
  const score = isMarkQ ? q.autoScore : (q as DiscussQuestion).estimatedScore;
  const total = q.marks;

  // Teacher annotations — present in both modes
  const annotations = q.teacherAnnotations;
  const teacherText = isMarkQ ? (q as QuestionResult).teacherMarking : (q as DiscussQuestion).teacherFeedback;

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 10,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px", background: "none", border: "none", cursor: "pointer", gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mid)", whiteSpace: "nowrap" }}>
            Q{q.questionNumber}{q.part ? `(${q.part})` : ""}
          </span>
          <span style={{ fontSize: 13, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {q.topic}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <ScoreBadge score={score} total={total} />
          <span style={{ color: "var(--mid)", fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--mid)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Question</p>
            <p style={{ fontSize: 14, color: "var(--fg)", margin: 0, lineHeight: 1.6 }}>{q.question}</p>
          </div>

          {/* Student's answer — with visual strikethroughs for self-corrections */}
          {q.studentAnswer && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--mid)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Student&rsquo;s Answer <span style={{ fontSize: 11, fontWeight: 400, color: "#888" }}>(pencil / blue / black ink)</span>
              </p>
              <p style={{ fontSize: 14, color: "var(--fg)", margin: 0, fontStyle: "italic", lineHeight: 1.7 }}>
                {renderStudentText(q.studentAnswer)}
              </p>
            </div>
          )}

          {/* Student corrections in green (if any) */}
          {q.studentCorrections && (
            <div style={{ background: "#16a34a0a", borderRadius: 8, padding: "8px 12px", borderLeft: "3px solid #16a34a" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ✏️ Student&rsquo;s corrections (green ink)
              </p>
              <p style={{ fontSize: 13, color: "var(--fg)", margin: 0, lineHeight: 1.5 }}>{q.studentCorrections}</p>
            </div>
          )}

          {/* Teacher annotations panel — only in discuss mode (mark mode papers are unmarked) */}
          {!isMarkQ && q.hasTeacherMarking && (
            <TeacherAnnotationsPanel
              annotations={annotations}
              fallbackText={teacherText || undefined}
            />
          )}

          {/* Marking mode: what's right / what's missing */}
          {isMarkQ && (q as QuestionResult).whatIsRight && (
            <div style={{ background: "#16a34a12", borderRadius: 8, padding: "10px 12px", borderLeft: "3px solid #16a34a" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>✓ What&rsquo;s right</p>
              <p style={{ fontSize: 13, color: "var(--fg)", margin: 0, lineHeight: 1.5 }}>{(q as QuestionResult).whatIsRight}</p>
            </div>
          )}

          {isMarkQ && (q as QuestionResult).whatIsMissing && (
            <div style={{ background: "#dc262612", borderRadius: 8, padding: "10px 12px", borderLeft: "3px solid #dc2626" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>✗ What&rsquo;s missing</p>
              <p style={{ fontSize: 13, color: "var(--fg)", margin: 0, lineHeight: 1.5 }}>{(q as QuestionResult).whatIsMissing}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {score < total && (
              <button
                onClick={() => onStartSage(q)}
                style={{
                  background: "var(--accent)", color: "#fff",
                  border: "none", borderRadius: 8,
                  padding: "10px 18px", fontSize: 14, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Discuss with Sage →
              </button>
            )}
            {(() => {
              const qid = `mc-q${q.questionNumber}${q.part || ""}`;
              const isSaved = savedIds.has(qid);
              return (
                <button
                  onClick={() => onSaveToRepo(q)}
                  style={{
                    background: isSaved ? "#16a34a" : "var(--card)",
                    color: isSaved ? "#fff" : "var(--fg)",
                    border: `1px solid ${isSaved ? "#16a34a" : "var(--rule)"}`,
                    borderRadius: 8,
                    padding: "10px 18px", fontSize: 14, fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {isSaved ? "✓ Saved" : "💾 Save to Repository"}
                </button>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MarkingCentrePage() {
  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<Mode>("mark");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("single");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string>("");
  const [modeWarning, setModeWarning] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"summary" | "questions" | "topics">("summary");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Repository state
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      const profile = localStorage.getItem("sage_student_profile");
      if (!profile) return new Set();
      const { email } = JSON.parse(profile) as { email: string };
      return new Set(getRepository(email).map(q => q.id));
    } catch { return new Set(); }
  });
  const [repoEmailPrompt, setRepoEmailPrompt] = useState<{ q: QuestionResult | DiscussQuestion } | null>(null);
  const [repoEmailInput, setRepoEmailInput] = useState("");

  function handleModeSelect(m: Mode) {
    setMode(m);
    setStep("upload");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File is too large. Maximum size is 20MB.");
      return;
    }
    setError("");
    setModeWarning("");
    setPdfFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") {
      setPdfFile(file);
      setError("");
    }
  }

  async function handleProceedToPayment() {
    if (!pdfFile) return;
    setStep("payment");
  }

  async function handlePay() {
    // Payment placeholder — in production this would call Stripe
    setStep("processing");
    await processPaper();
  }

  async function processPaper() {
    if (!pdfFile) return;
    setError("");

    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfFile);
      });

      const res = await fetch("/api/marking-centre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pdf: b64, mode }),
      });

      const json = await res.json() as { report?: Report; error?: string };

      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setStep("upload");
        return;
      }

      if (json.report) {
        // Auto-detect mode mismatch
        if (mode === "mark" && json.report.mode === "mark") {
          const allQuestions = json.report.sections.flatMap(s => s.questions);
          const markedCount = allQuestions.filter(q => q.hasTeacherMarking).length;
          if (markedCount > allQuestions.length * 0.5) {
            setModeWarning(`We noticed ${markedCount} questions appear to have teacher marks. If this paper is already marked, try the "Discuss a marked paper" mode instead for a better experience.`);
          }
        }
        setReport(json.report);
        setStep("report");
      }
    } catch {
      setError("Failed to process paper. Please try again.");
      setStep("upload");
    }
  }

  function handleStartSage(q: QuestionResult | DiscussQuestion) {
    // Transform to match what PSLESocraticTerminal expects.
    // page.tsx guards on selectedQuestion.id — QuestionResult has none, so we add one.
    const sageQuestion = {
      ...q,
      id: `mc-q${q.questionNumber}${q.part || ""}`,
      year: new Date().getFullYear(),
    };
    sessionStorage.setItem("sage_pending_question", JSON.stringify(sageQuestion));
    window.location.href = "/";
  }

  function handleSaveToRepo(q: QuestionResult | DiscussQuestion) {
    try {
      const raw = localStorage.getItem("sage_student_profile");
      if (raw) {
        const { email } = JSON.parse(raw) as { email: string };
        doSaveToRepo(email, q);
      } else {
        // No profile yet — ask for email
        setRepoEmailPrompt({ q });
      }
    } catch {
      setRepoEmailPrompt({ q });
    }
  }

  function doSaveToRepo(email: string, q: QuestionResult | DiscussQuestion) {
    const isMarkQ = "autoScore" in q;
    const rq: RepositoryQuestion = {
      id: `mc-q${q.questionNumber}${q.part || ""}`,
      savedAt: Date.now(),
      paperTitle: report ? (report as { paperTitle?: string }).paperTitle ?? "PSLE Science Paper" : "PSLE Science Paper",
      questionNumber: q.questionNumber,
      part: q.part,
      topic: q.topic,
      question: q.question,
      marks: q.marks,
      firstAttemptAnswer: q.studentAnswer,
      firstAttemptScore: isMarkQ ? (q as QuestionResult).autoScore : (q as DiscussQuestion).estimatedScore,
    };
    saveToRepository(email, rq);
    setSavedIds(prev => new Set([...Array.from(prev), rq.id]));
  }

  function handleRepoEmailConfirm() {
    const email = repoEmailInput.trim();
    if (!email || !repoEmailPrompt) return;
    // Lightweight save of email only so future saves are seamless
    try {
      const existing = localStorage.getItem("sage_student_profile");
      if (!existing) {
        localStorage.setItem("sage_student_profile", JSON.stringify({ email, name: "", level: "" }));
      }
    } catch { /* ignore */ }
    doSaveToRepo(email, repoEmailPrompt.q);
    setRepoEmailPrompt(null);
    setRepoEmailInput("");
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const accentCSS = `
    :root {
      --accent: #f97316;
      --bg: #fff7ed;
      --fg: #1c1917;
      --mid: #78716c;
      --rule: #fed7aa;
      --card: #ffffff;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --bg: #1c0f00; --fg: #fef3c7; --mid: #a8a29e;
        --rule: #3d2200; --accent: #fb923c; --card: #2a1800;
      }
    }
    :root[data-theme="dark"] {
      --bg: #1c0f00; --fg: #fef3c7; --mid: #a8a29e;
      --rule: #3d2200; --accent: #fb923c; --card: #2a1800;
    }
  `;

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--fg)",
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: "0 20px",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: 680,
    margin: "0 auto",
    paddingBlock: 48,
    display: "flex",
    flexDirection: "column",
    gap: 32,
  };

  const headingStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: 0,
    color: "var(--fg)",
  };

  const subStyle: React.CSSProperties = {
    fontSize: 15,
    color: "var(--mid)",
    margin: "6px 0 0",
    lineHeight: 1.6,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--rule)",
    borderRadius: 14,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const btnPrimary: React.CSSProperties = {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "14px 24px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  };

  const btnSecondary: React.CSSProperties = {
    background: "none",
    color: "var(--mid)",
    border: "1px solid var(--rule)",
    borderRadius: 10,
    padding: "14px 24px",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    width: "100%",
  };

  return (
    <>
      <style>{accentCSS}</style>
      <div style={pageStyle}>

        {/* Nav bar */}
        <div style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", borderBottom: "2px solid #fed7aa", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
          <a href="/" style={{ fontSize: 14, color: "var(--mid)", textDecoration: "none" }}>← Sage</a>
          <span style={{ color: "var(--rule)" }}>|</span>
          <a href="/repository" style={{ fontSize: 14, color: "var(--mid)", textDecoration: "none" }}>📚 My Repository</a>
          <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>📋 Marking Centre</span>
        </div>

        <div style={containerStyle}>

          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 45%, #7c3aed 100%)", borderRadius: 18, padding: "28px 24px", marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>
              📋 Marking Centre
            </div>
            <h1 style={{ ...headingStyle, color: "#fff", fontSize: 26 }}>Full Paper Assessment</h1>
            <p style={{ ...subStyle, color: "rgba(255,255,255,0.85)", marginTop: 8 }}>Upload a complete Science exam paper for marking, scoring, and personalised Sage sessions.</p>
          </div>

          {/* ── Step: Choose mode ── */}
          {step === "choose" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <button
                onClick={() => handleModeSelect("mark")}
                style={{ ...cardStyle, cursor: "pointer", border: "2px solid #fed7aa", textAlign: "left", transition: "all 0.15s", background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#f97316"; e.currentTarget.style.boxShadow = "0 4px 20px #f9731620"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#fed7aa"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 32 }}>📝</div>
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 17, color: "#c2410c" }}>Mark my paper</p>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--mid)", lineHeight: 1.6 }}>
                    Upload an unmarked paper with student answers. We&rsquo;ll score every question and generate a full report.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleModeSelect("discuss")}
                style={{ ...cardStyle, cursor: "pointer", border: "2px solid #ede9fe", textAlign: "left", transition: "all 0.15s", background: "linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.boxShadow = "0 4px 20px #7c3aed20"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#ede9fe"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 32 }}>💬</div>
                <div>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 17, color: "#6d28d9" }}>Discuss a marked paper</p>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--mid)", lineHeight: 1.6 }}>
                    Upload a teacher-marked paper. Skip straight to Socratic sessions on every question where marks were lost.
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ── Step: Upload ── */}
          {step === "upload" && (
            <>
              {modeWarning && (
                <div style={{ background: "#d9770618", border: "1px solid #d9770640", borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ margin: 0, fontSize: 14, color: "#92400e", lineHeight: 1.6 }}>⚠️ {modeWarning}</p>
                </div>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                style={{
                  border: `2px dashed ${pdfFile ? "var(--accent)" : "var(--rule)"}`,
                  borderRadius: 14,
                  padding: 40,
                  textAlign: "center",
                  cursor: "pointer",
                  background: pdfFile ? "var(--accent)08" : "var(--card)",
                  transition: "all 0.15s",
                }}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileChange} />
                {pdfFile ? (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--fg)" }}>{pdfFile.name}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--mid)" }}>{(pdfFile.size / 1024 / 1024).toFixed(1)} MB · Click to change</p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
                    <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--fg)" }}>Drop your PDF here</p>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--mid)" }}>or click to browse · Max 20MB</p>
                  </>
                )}
              </div>

              {error && <p style={{ margin: 0, fontSize: 14, color: "#dc2626" }}>{error}</p>}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button style={btnPrimary} onClick={handleProceedToPayment} disabled={!pdfFile}>
                  Continue to payment →
                </button>
                <button style={btnSecondary} onClick={() => setStep("choose")}>← Back</button>
              </div>
            </>
          )}

          {/* ── Step: Payment ── */}
          {step === "payment" && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {TIERS.map(tier => (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px",
                      background: selectedTier === tier.id ? "var(--accent)12" : "var(--card)",
                      border: `2px solid ${selectedTier === tier.id ? "var(--accent)" : "var(--rule)"}`,
                      borderRadius: 12, cursor: "pointer", textAlign: "left", gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--fg)" }}>{tier.name}</span>
                        {tier.badge && (
                          <span style={{ fontSize: 11, fontWeight: 700, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.04em" }}>
                            {tier.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--mid)" }}>{tier.description}</p>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: selectedTier === tier.id ? "var(--accent)" : "var(--fg)", whiteSpace: "nowrap" }}>
                      {tier.price}
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ ...cardStyle, background: "var(--accent)08", border: "1px solid var(--accent)30" }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--mid)", lineHeight: 1.6 }}>
                  💳 <strong style={{ color: "var(--fg)" }}>Payment placeholder</strong> — Stripe integration coming soon. Click below to continue for now.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button style={btnPrimary} onClick={handlePay}>
                  Pay {TIERS.find(t => t.id === selectedTier)?.price} and mark paper
                </button>
                <button style={btnSecondary} onClick={() => setStep("upload")}>← Back</button>
              </div>
            </>
          )}

          {/* ── Step: Processing ── */}
          {step === "processing" && (
            <div style={{ ...cardStyle, alignItems: "center", padding: 48, gap: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                border: "4px solid var(--rule)", borderTopColor: "var(--accent)",
                animation: "spin 0.9s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 16, color: "var(--fg)" }}>
                  {mode === "mark" ? "Marking your paper…" : "Reading teacher feedback…"}
                </p>
                <p style={{ margin: 0, fontSize: 14, color: "var(--mid)" }}>
                  This takes 30–60 seconds for a full paper.
                </p>
              </div>
            </div>
          )}

          {/* ── Step: Report ── */}
          {step === "report" && report && (
            <>
              {/* Paper title + score hero */}
              <div style={{ ...cardStyle, background: "var(--accent)", color: "#fff", gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, opacity: 0.8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {report.paperTitle}
                </p>
                {report.mode === "mark" ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{report.marksAttained}</span>
                      <span style={{ fontSize: 24, opacity: 0.7 }}>/ {report.totalPaperMarks}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 15, opacity: 0.9 }}>{report.percentage}% — {
                      report.percentage >= 75 ? "Well done! Strong performance." :
                      report.percentage >= 50 ? "Passing, but room to grow." :
                      "Needs focused work. Sage can help."
                    }</p>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{report.estimatedTotal}</span>
                      <span style={{ fontSize: 24, opacity: 0.7 }}>/ {report.totalPaperMarks}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 15, opacity: 0.9 }}>
                      {report.questionsNeedingHelp.length} question{report.questionsNeedingHelp.length !== 1 ? "s" : ""} to work on with Sage.
                    </p>
                  </>
                )}
              </div>

              {/* Mode warning if detected */}
              {modeWarning && (
                <div style={{ background: "#d9770618", border: "1px solid #d9770640", borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ margin: 0, fontSize: 14, color: "#92400e", lineHeight: 1.6 }}>⚠️ {modeWarning}</p>
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["summary", "questions", "topics"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                      background: activeTab === tab ? "var(--fg)" : "none",
                      color: activeTab === tab ? "var(--bg)" : "var(--mid)",
                      border: `1px solid ${activeTab === tab ? "var(--fg)" : "var(--rule)"}`,
                      cursor: "pointer",
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Tab: Summary */}
              {activeTab === "summary" && report.mode === "mark" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {report.sections.map((section, i) => {
                    const sectionScore = section.questions.reduce((s, q) => s + (q.autoScore ?? 0), 0);
                    return (
                      <div key={i} style={{ ...cardStyle }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--fg)" }}>{section.name}</p>
                          <ScoreBadge score={sectionScore} total={section.sectionTotalMarks} />
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--mid)" }}>{section.questions.length} questions</p>
                      </div>
                    );
                  })}
                  {report.recommendedSessions.length > 0 && (
                    <div style={{ ...cardStyle, border: "1px solid var(--accent)40" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>
                        🎯 Top Sage sessions recommended
                      </p>
                      {report.recommendedSessions.slice(0, 3).map((q, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <span style={{ fontSize: 13, color: "var(--fg)" }}>
                            Q{q.questionNumber}{q.part ? `(${q.part})` : ""} · {q.topic}
                          </span>
                          <ScoreBadge score={q.autoScore} total={q.marks} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "summary" && report.mode === "discuss" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ ...cardStyle }}>
                    <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--fg)" }}>Questions needing Sage sessions</p>
                    {report.questionsNeedingHelp.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 13, color: "var(--mid)" }}>Nil — full marks on every question. 🎉</p>
                    ) : report.questionsNeedingHelp.map((q, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 13, color: "var(--fg)" }}>Q{q.questionNumber}{q.part ? `(${q.part})` : ""} · {q.topic}</span>
                        <ScoreBadge score={q.estimatedScore} total={q.marks} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Questions */}
              {activeTab === "questions" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {report.mode === "mark"
                    ? report.sections.flatMap(s => s.questions).map((q, i) => (
                        <QuestionCard key={i} q={q} onStartSage={handleStartSage} onSaveToRepo={handleSaveToRepo} savedIds={savedIds} />
                      ))
                    : report.markedQuestions.map((q, i) => (
                        <QuestionCard key={i} q={q} onStartSage={handleStartSage} onSaveToRepo={handleSaveToRepo} savedIds={savedIds} />
                      ))
                  }
                </div>
              )}

              {/* Tab: Topics */}
              {activeTab === "topics" && (() => {
                const topicData = report.mode === "mark"
                  ? report.topicAnalysis
                  : (() => {
                      const map = new Map<string, { attained: number; total: number }>();
                      for (const q of report.markedQuestions) {
                        const t = q.topic || "General Science";
                        const ex = map.get(t) ?? { attained: 0, total: 0 };
                        map.set(t, { attained: ex.attained + (q.estimatedScore ?? 0), total: ex.total + (q.marks ?? 0) });
                      }
                      return Array.from(map.entries()).map(([topic, { attained, total }]) => {
                        const pct = total === 0 ? 0 : Math.round((attained / total) * 100);
                        return { topic, marksAttained: attained, totalMarks: total, percentage: pct, status: (pct >= 75 ? "strong" : pct >= 50 ? "needs-work" : "weak") as "strong" | "needs-work" | "weak" };
                      }).sort((a, b) => a.percentage - b.percentage);
                    })();
                return (
                  <div style={{ ...cardStyle, gap: 20 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: "var(--fg)" }}>Performance by topic</p>
                    {topicData.length === 0
                      ? <p style={{ margin: 0, fontSize: 13, color: "var(--mid)" }}>No topic data available.</p>
                      : topicData.map((t, i) => <TopicBar key={i} topic={t} />)
                    }
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--rule)" }}>
                      {[
                        { label: "Strong", color: "#16a34a" },
                        { label: "Needs work", color: "#d97706" },
                        { label: "Weak", color: "#dc2626" },
                      ].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                          <span style={{ fontSize: 12, color: "var(--mid)" }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* New scan button */}
              <button style={btnSecondary} onClick={() => { setStep("choose"); setReport(null); setPdfFile(null); setModeWarning(""); }}>
                Mark another paper
              </button>
            </>
          )}

        </div>
      </div>

      {/* Repository email prompt modal */}
      {repoEmailPrompt && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
        }}>
          <div style={{
            background: "var(--card)", borderRadius: 16, padding: 28,
            width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16,
          }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: "var(--fg)" }}>Save to your repository</p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--mid)", lineHeight: 1.5 }}>
              Enter your email so we can save this question to your personal question bank.
            </p>
            <input
              type="email"
              placeholder="your@email.com"
              value={repoEmailInput}
              onChange={e => setRepoEmailInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRepoEmailConfirm()}
              style={{
                border: "1px solid var(--rule)", borderRadius: 8, padding: "10px 14px",
                fontSize: 15, background: "var(--bg)", color: "var(--fg)", outline: "none",
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleRepoEmailConfirm}
                style={{ flex: 1, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Save
              </button>
              <button
                onClick={() => { setRepoEmailPrompt(null); setRepoEmailInput(""); }}
                style={{ flex: 1, background: "var(--card)", color: "var(--fg)", border: "1px solid var(--rule)", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
