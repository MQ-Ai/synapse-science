"use client";

import { useState, useRef, useCallback } from "react";
import { PSLE_QUESTIONS, TOPICS, YEARS, PSLEQuestion } from "@/lib/psle-questions";
import PSLESocraticTerminal from "@/components/psle-socratic-terminal";

export interface StudentProfile {
  email: string;
  name: string;
  level: string;
}

// ─── Email Gate Modal ───────────────────────────────────────────────────────

function EmailGateModal({ onConfirm }: { onConfirm: (profile: StudentProfile) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Please enter a name."); return; }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError("Please enter a valid email address."); return; }
    if (!level) { setError("Please select a level."); return; }
    setError(""); setLoading(true);

    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: trimmedName, level, source: "psle" }),
      });
    } catch { /* silently ignore */ }

    setLoading(false);
    onConfirm({ email: trimmedEmail, name: trimmedName, level });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden" style={{ background: "#FFFFFF" }}>
        <div className="px-6 pt-6 pb-5" style={{ background: "linear-gradient(135deg, #FF9A56 0%, #FF6B9D 100%)" }}>
          <svg width="64" height="76" viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
            <g transform="rotate(-8 55 55)">
              <path d="M55 4 L38 48 L72 48 Z" fill="white"/>
              <ellipse cx="55" cy="48" rx="17" ry="5" fill="#FFB3C6"/>
              <path d="M55 4 L56.5 8.5 L61 8.5 L57.5 11.5 L59 16 L55 13 L51 16 L52.5 11.5 L49 8.5 L53.5 8.5 Z" fill="#FCD34D"/>
            </g>
            <path d="M55 30 C30 30 18 55 18 72 C18 92 34 108 55 108 C76 108 92 92 92 72 C92 55 80 30 55 30Z" fill="white"/>
            <circle cx="34" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
            <circle cx="76" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
            <ellipse cx="43" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
            <ellipse cx="67" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
            <circle cx="46" cy="68" r="3" fill="white"/>
            <circle cx="70" cy="68" r="3" fill="white"/>
            <path d="M44 87 Q55 96 66 87" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
          <h2 className="text-white font-bold text-lg leading-snug">One quick step before Sage can help!</h2>
          <p className="text-orange-100 text-sm mt-1">Free — no spam, ever.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide uppercase">Student&apos;s name</label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="e.g. Sarah" autoComplete="given-name"
              className="w-full rounded-xl border border-orange-200 bg-orange-50/40 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 tracking-wide uppercase">Primary level</label>
            <div className="grid grid-cols-6 gap-2">
              {["P1","P2","P3","P4","P5","P6"].map(l => (
                <button key={l} type="button" onClick={() => { setLevel(l); setError(""); }}
                  className="py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: level === l ? "linear-gradient(135deg,#FF9A56,#FF6B9D)" : "#FFF0E8", color: level === l ? "white" : "#C94A0E", border: level === l ? "none" : "1px solid #FFD0B0" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide uppercase">Parent / guardian email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="you@example.com" autoComplete="email"
              className="w-full rounded-xl border border-orange-200 bg-orange-50/40 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all" />
          </div>
          {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #FF9A56, #FF6B9D)" }}>
            {loading ? "Starting…" : "Start practising with Sage →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Upload Question Modal ──────────────────────────────────────────────────

interface UploadedQuestionPreview {
  id: string;
  year: number;
  questionNumber: number;
  part: string;
  topic: string;
  context: string;
  question: string;
  marks: number;
  keywords: string[];
  modelAnswer: string;
  isUploaded: boolean;
  hasProvidedAnswer: boolean;
}

function UploadQuestionModal({ onConfirm, onClose }: {
  onConfirm: (q: UploadedQuestionPreview) => void;
  onClose: () => void;
}) {
  const [images, setImages] = useState<string[]>([]);       // base64 data URLs
  const [previews, setPreviews] = useState<string[]>([]);   // same, for display
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState<UploadedQuestionPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
          else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = url;
    });
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    const remaining = 2 - images.length;
    const toAdd = Array.from(files).slice(0, remaining);
    if (toAdd.length === 0) { setError("Maximum 2 photos allowed."); return; }

    const compressed = await Promise.all(toAdd.map(f => compressImage(f)));
    setImages(prev => [...prev, ...compressed]);
    setPreviews(prev => [...prev, ...compressed]);
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
    setExtracted(null);
    setError("");
  }

  async function handleExtract() {
    if (images.length === 0) { setError("Please add at least one photo."); return; }
    setLoading(true); setError(""); setExtracted(null);
    try {
      const res = await fetch("/api/upload-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to read question");
      setExtracted(data.question);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-5"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "#FFFFFF", maxHeight: "92vh" }}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0" style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl">📷</div>
              <div>
                <h2 className="text-white font-bold text-base">Upload Your Question</h2>
                <p className="text-purple-100 text-xs mt-0.5">Up to 2 photos • Sage will read and guide you</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-lg leading-none">×</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-4">

          {!extracted ? (
            <>
              {/* Image drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                style={{ borderColor: "#C4B5FD", background: "#FAF5FF", minHeight: "140px", padding: "24px" }}>
                <div className="text-4xl">📸</div>
                <p className="text-sm font-semibold text-purple-700">Tap to add photo{images.length === 1 ? " (1 more allowed)" : "s"}</p>
                <p className="text-xs text-purple-400">Camera or gallery • JPG / PNG</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                />
              </div>

              {/* Previews */}
              {previews.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {previews.map((src, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden" style={{ width: 110, height: 110 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Page ${i+1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center leading-none">
                        ×
                      </button>
                      <div className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-1.5 py-0.5 rounded-md">pg {i+1}</div>
                    </div>
                  ))}
                  {images.length < 2 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl border-2 border-dashed flex items-center justify-center text-2xl text-purple-300 transition-all hover:border-purple-400"
                      style={{ width: 110, height: 110, borderColor: "#C4B5FD", background: "#FAF5FF" }}>
                      +
                    </button>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

              <button
                onClick={handleExtract}
                disabled={images.length === 0 || loading}
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Sage is reading your question…
                  </>
                ) : "Read Question →"}
              </button>
            </>
          ) : (
            /* Confirmation view */
            <>
              <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-semibold text-green-700">Sage read your question!</p>
                  <p className="text-xs text-green-600 mt-0.5">Check it looks right before starting.</p>
                </div>
              </div>

              {extracted.hasProvidedAnswer && (
                <div className="rounded-2xl p-3 flex items-start gap-2" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                  <span className="text-base">💡</span>
                  <p className="text-xs text-orange-700">A suggested answer was detected in the photo. Sage has verified it and will guide your child to the correct understanding.</p>
                </div>
              )}

              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "#F8F7FF", border: "1px solid #E0D9FF" }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: "#6366f1" }}>{extracted.topic}</span>
                  <span className="text-xs text-gray-500">{extracted.marks} mark{extracted.marks !== 1 ? "s" : ""}</span>
                </div>
                {extracted.context && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Context</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{extracted.context}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Question</p>
                  <p className="text-sm text-gray-800 leading-relaxed font-medium">{extracted.question}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setExtracted(null); setError(""); }}
                  className="flex-1 py-3 rounded-2xl font-semibold text-sm border transition-all"
                  style={{ border: "1.5px solid #C4B5FD", color: "#6366f1", background: "white" }}>
                  ← Re-upload
                </button>
                <button
                  onClick={() => onConfirm(extracted)}
                  className="flex-1 py-3 rounded-2xl text-white font-semibold text-sm transition-all"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
                  Start with Sage →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PSLEPage() {
  const [selectedQuestion, setSelectedQuestion] = useState<PSLEQuestion | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PSLEQuestion | null>(null);
  const [filterTopic, setFilterTopic] = useState<string>("All Topics");
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<UploadedQuestionPreview | null>(null);

  function handleQuestionClick(q: PSLEQuestion) {
    if (student) { setSelectedQuestion(q); }
    else { setPendingQuestion(q); }
  }

  function handleEmailConfirm(profile: StudentProfile) {
    setStudent(profile);
    if (pendingQuestion) { setSelectedQuestion(pendingQuestion); setPendingQuestion(null); }
    if (pendingUpload) { setSelectedQuestion(pendingUpload as unknown as PSLEQuestion); setPendingUpload(null); }
  }

  function handleUploadConfirm(q: UploadedQuestionPreview) {
    setShowUpload(false);
    if (student) {
      setSelectedQuestion(q as unknown as PSLEQuestion);
    } else {
      setPendingUpload(q);
      setPendingQuestion({} as PSLEQuestion); // trigger email gate
    }
  }

  const filteredQuestions = PSLE_QUESTIONS.filter((q: PSLEQuestion) => {
    const topicMatch = filterTopic === "All Topics" || q.topic === filterTopic;
    const yearMatch = filterYear === "all" || q.year === filterYear;
    return topicMatch && yearMatch;
  });

  if (selectedQuestion && selectedQuestion.id) {
    return (
      <PSLESocraticTerminal
        key={selectedQuestion.id}
        question={selectedQuestion}
        student={student!}
        onBack={() => setSelectedQuestion(null)}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #FFF9F0 0%, #FFF0F5 50%, #F0F5FF 100%)" }}>

      {/* Email gate — fires for both regular + upload flows */}
      {(pendingQuestion || pendingUpload) && !student && (
        <EmailGateModal onConfirm={handleEmailConfirm} />
      )}

      {showUpload && (
        <UploadQuestionModal
          onConfirm={handleUploadConfirm}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Header */}
      <header className="px-6 py-5 border-b border-orange-100 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="40" height="48" viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-8 55 55)">
                <path d="M55 4 L38 48 L72 48 Z" fill="#C084FC"/>
                <ellipse cx="55" cy="48" rx="17" ry="5" fill="#A855F7"/>
                <path d="M55 4 L56.5 8.5 L61 8.5 L57.5 11.5 L59 16 L55 13 L51 16 L52.5 11.5 L49 8.5 L53.5 8.5 Z" fill="#FCD34D"/>
              </g>
              <path d="M55 30 C30 30 18 55 18 72 C18 92 34 108 55 108 C76 108 92 92 92 72 C92 55 80 30 55 30Z" fill="#FBBF9A"/>
              <circle cx="34" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
              <circle cx="76" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
              <ellipse cx="43" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
              <ellipse cx="67" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
              <circle cx="46" cy="68" r="3" fill="white"/>
              <circle cx="70" cy="68" r="3" fill="white"/>
              <path d="M44 87 Q55 96 66 87" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <line x1="85" y1="75" x2="104" y2="52" stroke="#D4A574" strokeWidth="4" strokeLinecap="round"/>
              <path d="M104 48 L105.8 53.5 L111.5 53.5 L106.9 56.9 L108.7 62.4 L104 59 L99.3 62.4 L101.1 56.9 L96.5 53.5 L102.2 53.5 Z" fill="#FCD34D"/>
            </svg>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Sage — PSLE Science</h1>
              <p className="text-sm text-gray-500">
                {student ? `Hi ${student.name} (${student.level}) 👋` : "Your friendly science guide"}
              </p>
            </div>
          </div>
          {/* Nav — right side */}
          <a
            href="/marking-centre"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)", color: "white" }}
          >
            <span>📋</span>
            <span>Marking Centre</span>
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome Banner */}
        <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: "linear-gradient(135deg, #FF9A56 0%, #FF6B9D 100%)" }}>
          <div className="text-4xl mb-2">🌟</div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {student ? `Ready to practise, ${student.name}?` : "Ready to practise?"}
          </h2>
          <p className="text-orange-100 text-sm">Choose a question below. Sage will guide you — just like a real science conversation!</p>
          <div className="mt-3 flex justify-center gap-4 text-xs text-orange-100 flex-wrap">
            <span>📚 {PSLE_QUESTIONS.length} questions</span>
            <span>·</span>
            <span>📅 2021 – 2024</span>
            <span>·</span>
            <span>🎯 All topics</span>
          </div>
        </div>

        {/* Upload Question Button */}
        <button
          onClick={() => setShowUpload(true)}
          className="w-full mb-6 py-4 rounded-2xl flex items-center justify-center gap-3 font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", color: "white", boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
          <span className="text-xl">📷</span>
          <span>Upload Your Own Question</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,255,255,0.2)" }}>NEW</span>
        </button>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">Topic:</span>
            <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} className="text-sm rounded-xl border border-orange-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300 cursor-pointer">
              <option>All Topics</option>
              {TOPICS.map((t: string) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">Year:</span>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value === "all" ? "all" : parseInt(e.target.value))} className="text-sm rounded-xl border border-orange-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-300 cursor-pointer">
              <option value="all">All Years</option>
              {YEARS.map((y: number) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="ml-auto text-sm text-gray-400 self-center">{filteredQuestions.length} question{filteredQuestions.length !== 1 ? "s" : ""}</div>
        </div>

        {/* Question Cards */}
        <div className="grid gap-3">
          {filteredQuestions.map((q: PSLEQuestion) => (
            <button key={q.id} onClick={() => handleQuestionClick(q)} className="w-full text-left rounded-2xl bg-white border border-orange-100 p-5 hover:border-orange-300 hover:shadow-md transition-all duration-200 group">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: topicColor(q.topic) }}>
                  {topicEmoji(q.topic)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-orange-500 bg-orange-50 rounded-full px-2 py-0.5">{q.year} Q{q.questionNumber}{q.part}</span>
                    <span className="text-xs text-gray-400 bg-gray-50 rounded-full px-2 py-0.5">{q.topic}</span>
                    <span className="text-xs text-gray-400 ml-auto">{q.marks} mark{q.marks !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{q.question}</p>
                </div>
                <div className="flex-shrink-0 text-orange-300 group-hover:text-orange-500 transition-colors text-lg">→</div>
              </div>
            </button>
          ))}
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p>No questions match your filters. Try changing the topic or year!</p>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between" style={{ borderTop: "1px solid #F0DDD0" }}>
        <div style={{ fontSize: "11px", color: "#B8917A" }}>© 2026 Synapse Ecosystem</div>
        <a href="mailto:sage.synapse@gmail.com?subject=Sage%20Feedback" style={{ fontSize: "11px", color: "#B8917A", textDecoration: "none" }}>Send feedback →</a>
      </div>
    </div>
  );
}

function topicColor(topic: string): string {
  const colors: Record<string, string> = {
    "Plants & Environment":"#4CAF50","Digestion":"#FF9800","Digestive System":"#FF9800",
    "Microorganisms & Hygiene":"#9C27B0","Insects & Reproduction":"#E91E63","Insects & Behaviour":"#E91E63",
    "Plant Transport":"#2196F3","Photosynthesis":"#4CAF50","Fair Test":"#607D8B",
    "Forces & Materials":"#795548","Electricity & Magnetism":"#FF5722","Electricity — Circuits":"#FF5722",
    "Energy":"#FFC107","Energy & Forces":"#FFC107","Properties of Air":"#00BCD4",
    "Heat & Temperature":"#F44336","Heat Transfer":"#F44336","States of Matter — Condensation":"#00BCD4",
    "Sound":"#673AB7","Forces & Volume":"#795548","Magnets & Electromagnets":"#FF5722",
    "Respiratory System":"#2196F3","Plant Cells":"#4CAF50","Scientific Method":"#607D8B",
    "Life Cycles":"#E91E63","Food Chains & Webs":"#4CAF50","Water Cycle":"#00BCD4",
    "Forces — Friction":"#795548","Light & Shadows":"#FFC107","Microorganisms":"#9C27B0",
    "Living Things & Survival":"#4CAF50","Heat & Gases":"#F44336",
  };
  return colors[topic] || "#9E9E9E";
}

function topicEmoji(topic: string): string {
  const emojis: Record<string, string> = {
    "Plants & Environment":"🌿","Digestion":"🫀","Digestive System":"🫀",
    "Microorganisms & Hygiene":"🦠","Microorganisms":"🦠","Insects & Reproduction":"🦟","Insects & Behaviour":"🦟",
    "Plant Transport":"🌱","Photosynthesis":"☀️","Fair Test":"⚖️",
    "Forces & Materials":"🔩","Forces & Volume":"📦","Forces — Friction":"🛞",
    "Electricity & Magnetism":"⚡","Electricity — Circuits":"💡","Energy":"🔋","Energy & Forces":"🔋",
    "Properties of Air":"💨","Heat & Temperature":"🌡️","Heat Transfer":"🔥","Heat & Gases":"🌡️",
    "States of Matter — Condensation":"💧","Sound":"🔊","Magnets & Electromagnets":"🧲",
    "Respiratory System":"🫁","Plant Cells":"🔬","Scientific Method":"🧪","Life Cycles":"🐸",
    "Food Chains & Webs":"🌿","Water Cycle":"🌧️","Light & Shadows":"🔦","Living Things & Survival":"🌏",
  };
  return emojis[topic] || "📖";
}
