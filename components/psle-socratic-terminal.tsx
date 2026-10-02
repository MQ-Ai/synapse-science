"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { PSLEQuestion } from "@/lib/psle-questions";

function SageMascot({ width, height, bodyFill = "#FBBF9A" }: { width: number; height: number; bodyFill?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-8 55 55)">
        <path d="M55 4 L38 48 L72 48 Z" fill="#C084FC"/>
        <ellipse cx="55" cy="48" rx="17" ry="5" fill="#A855F7"/>
        <path d="M55 4 L56.5 8.5 L61 8.5 L57.5 11.5 L59 16 L55 13 L51 16 L52.5 11.5 L49 8.5 L53.5 8.5 Z" fill="#FCD34D"/>
      </g>
      <path d="M55 30 C30 30 18 55 18 72 C18 92 34 108 55 108 C76 108 92 92 92 72 C92 55 80 30 55 30Z" fill={bodyFill}/>
      <circle cx="34" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
      <circle cx="76" cy="80" r="8" fill="#FFB3C6" opacity="0.5"/>
      <ellipse cx="43" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
      <ellipse cx="67" cy="72" rx="7" ry="8" fill="#1a1a1a"/>
      <circle cx="46" cy="68" r="3" fill="white"/>
      <circle cx="70" cy="68" r="3" fill="white"/>
      <circle cx="41" cy="75" r="1.5" fill="white" opacity="0.7"/>
      <circle cx="65" cy="75" r="1.5" fill="white" opacity="0.7"/>
      <path d="M44 87 Q55 96 66 87" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

// Neuro-chime: 432 Hz / 472 Hz binaural beat (40 Hz gamma entrainment)
// Uses StereoPannerNode for proper L/R routing — fully typed, no channel-index hacks
function playChime(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtxCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtxCtor();
    const now = ctx.currentTime;
    const dur = 2.6;

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    // Envelope: soft attack, sustain, gentle fade
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.14, now + 0.12);
    masterGain.gain.setValueAtTime(0.14, now + 1.6);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Left ear: 432 Hz — panned hard left via StereoPannerNode
    const panL = ctx.createStereoPanner();
    panL.pan.value = -1;
    const oscL = ctx.createOscillator();
    oscL.type = "sine"; oscL.frequency.value = 432;
    oscL.connect(panL); panL.connect(masterGain);
    oscL.start(now); oscL.stop(now + dur);

    // Right ear: 472 Hz (432 + 40 Hz = gamma beat) — panned hard right
    const panR = ctx.createStereoPanner();
    panR.pan.value = 1;
    const oscR = ctx.createOscillator();
    oscR.type = "sine"; oscR.frequency.value = 472;
    oscR.connect(panR); panR.connect(masterGain);
    oscR.start(now); oscR.stop(now + dur);

    // Overtone shimmer: 864 Hz at low volume (centre)
    const oscOver = ctx.createOscillator();
    const gainOver = ctx.createGain();
    oscOver.type = "sine"; oscOver.frequency.value = 864;
    gainOver.gain.value = 0.04;
    oscOver.connect(gainOver); gainOver.connect(masterGain);
    oscOver.start(now); oscOver.stop(now + dur);

    setTimeout(() => ctx.close(), (dur + 0.2) * 1000);
  } catch { /* audio not available */ }
}

function BreathingCircle({ onDone, chimeEnabled, onToggleChime }: {
  onDone: () => void; chimeEnabled: boolean; onToggleChime: () => void;
}) {
  const [phase, setPhase] = useState<"inhale"|"hold"|"exhale"|"done">("inhale");
  const [cycle, setCycle] = useState(0);
  const CYCLES = 3;

  useEffect(() => { playChime(chimeEnabled); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timings: Record<string,number> = { inhale: 4000, hold: 1500, exhale: 5000 };
    if (phase === "done") return;
    const t = setTimeout(() => {
      if (phase === "inhale") { playChime(chimeEnabled); setPhase("hold"); }
      else if (phase === "hold") setPhase("exhale");
      else {
        const next = cycle + 1;
        if (next >= CYCLES) setPhase("done");
        else { playChime(chimeEnabled); setCycle(next); setPhase("inhale"); }
      }
    }, timings[phase]);
    return () => clearTimeout(t);
  }, [phase, cycle, chimeEnabled]);

  const label = phase === "inhale" ? "Breathe in…" : phase === "hold" ? "Hold…" : phase === "exhale" ? "Breathe out…" : "Well done 🌟";
  const scale = (phase === "inhale" || phase === "hold") ? "scale(1.45)" : "scale(1)";
  const dur = phase === "inhale" ? "4s" : phase === "hold" ? "0.1s" : "5s";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background:"rgba(255,248,240,0.97)", backdropFilter:"blur(8px)" }}>
      <button onClick={onToggleChime} title={chimeEnabled ? "Mute chime" : "Enable chime"}
        className="absolute top-5 right-5 rounded-full p-2.5 transition-colors border"
        style={{ background: chimeEnabled ? "#FFF0E8" : "#F3F4F6", borderColor: chimeEnabled ? "#FFD0B0" : "#E5E7EB", color: chimeEnabled ? "#FF6B35" : "#9CA3AF" }}>
        {chimeEnabled ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        )}
      </button>
      <p className="text-xs font-semibold tracking-widest uppercase mb-8" style={{ color:"#B8917A" }}>Take a moment — breathe with Sage</p>
      <div className="relative flex items-center justify-center mb-8" style={{ width:200, height:200 }}>
        <div className="absolute rounded-full" style={{ width:200,height:200,background:"rgba(255,107,53,0.08)",transform:scale,transition:`transform ${dur} ease-in-out` }}/>
        <div className="absolute rounded-full" style={{ width:150,height:150,background:"rgba(255,107,53,0.12)",transform:scale,transition:`transform ${dur} ease-in-out` }}/>
        <div className="absolute rounded-full flex items-center justify-center" style={{ width:100,height:100,background:"linear-gradient(135deg,#FF9A56,#FF6B35)",transform:scale,transition:`transform ${dur} ease-in-out`,boxShadow:"0 8px 32px rgba(255,107,53,0.35)" }}>
          <SageMascot width={44} height={52} bodyFill="white"/>
        </div>
      </div>
      <p className="text-xl font-semibold mb-2" style={{ color:"#2D1B0E",minWidth:160,textAlign:"center" }}>{label}</p>
      <p className="text-sm mb-10" style={{ color:"#B8917A" }}>{phase==="done"?"All done!":`Round ${cycle+1} of ${CYCLES}`}</p>
      {phase === "done" ? (
        <button onClick={onDone} className="px-8 py-3 rounded-2xl text-white font-semibold text-sm" style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B35)" }}>
          I&apos;m ready — let&apos;s go →
        </button>
      ) : (
        <button onClick={onDone} className="text-xs px-4 py-2 rounded-full border" style={{ color:"#B8917A",borderColor:"#E8C9A8",background:"rgba(255,255,255,0.6)" }}>
          Skip → start now
        </button>
      )}
      <p className="text-center mt-8 px-6" style={{ fontSize:"10px",color:"#C4A882",lineHeight:1.6,maxWidth:300 }}>
        Neuroscience-backed <strong>box breathing</strong> — calms the nervous system and sharpens focus.
      </p>
    </div>
  );
}

interface TurnRecord { studentText:string; sageReply:string; stars:number; elapsedMs:number; }

function SessionReport({ question,turns,totalStars,totalMs,onClose }: {
  question:PSLEQuestion; turns:TurnRecord[]; totalStars:number; totalMs:number; onClose:()=>void;
}) {
  const mins = Math.floor(totalMs/60000);
  const secs = Math.floor((totalMs%60000)/1000);
  const pct = Math.round((totalStars/3)*100);
  const obs: string[] = [];
  if (turns.length >= 6) obs.push("Extended engagement — showed persistence through a multi-step problem.");
  if (turns.length <= 2 && totalStars >= 3) obs.push("Quick mastery — reached full marks with minimal prompting, suggesting strong prior knowledge.");
  if (totalMs > 300000) obs.push("Reflective pace — took time to think before responding, linked to deeper encoding.");
  if (totalMs < 60000 && turns.length >= 2) obs.push("Fast responder — consider revisiting to deepen reasoning.");
  const avgMs = turns.length ? totalMs/turns.length : 0;
  if (avgMs > 90000) obs.push("Long think-time per turn — may indicate careful reasoning or uncertainty; worth a follow-up conversation.");
  if (obs.length === 0) obs.push("Steady engagement — completed the question with consistent effort.");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background:"rgba(0,0,0,0.5)",backdropFilter:"blur(6px)" }}>
      <div className="min-h-screen flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" style={{ background:"#FFFBF7" }}>
          <div className="px-6 pt-6 pb-5" style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/80 text-xs font-semibold tracking-widest uppercase">Session Report</span>
              <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
            </div>
            <h2 className="text-white font-bold text-lg leading-snug mb-1">{question.year} Q{question.questionNumber}{question.part}</h2>
            <p className="text-orange-100 text-sm">{question.topic} · {question.marks} mark{question.marks!==1?"s":""}</p>
          </div>
          <div className="px-6 py-5 flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              {[{label:"Score",value:`${pct}%`,sub:`${totalStars}/3 ★`},{label:"Time",value:`${mins}m ${secs}s`,sub:"total"},{label:"Turns",value:`${turns.length}`,sub:"exchanges"}].map(s=>(
                <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background:"#FFF0E8" }}>
                  <div className="text-lg font-bold" style={{ color:"#FF6B35" }}>{s.value}</div>
                  <div className="text-xs font-semibold text-gray-500 mt-0.5">{s.label}</div>
                  <div className="text-xs text-gray-400">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-4" style={{ background:"#F0F4FF",border:"1px solid #C7D2FE" }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color:"#6366F1" }}>🧠 Learner Observations</p>
              <div className="flex flex-col gap-1.5">
                {obs.map((o,i)=>(
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-indigo-400 text-xs mt-0.5">◆</span>
                    <p className="text-xs text-gray-600 leading-relaxed">{o}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color:"#B8917A" }}>Journey Through the Question</p>
              <div className="flex flex-col gap-2">
                {turns.map((t,i)=>(
                  <div key={i} className="rounded-xl border border-orange-100 p-3 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-500">Turn {i+1}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{Math.round(t.elapsedMs/1000)}s</span>
                        <div className="flex gap-0.5">{[1,2,3].map(s=><span key={s} className={`text-xs ${s<=t.stars?"text-yellow-400":"text-gray-200"}`}>★</span>)}</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-2"><span className="font-medium text-orange-500">You: </span>{t.studentText}</p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose} className="w-full py-3 rounded-2xl text-white font-semibold text-sm" style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>Close report</button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Message { role:"sage"|"student"; content:string; stars?:number; ts:number; elapsedMs?:number; }
export interface StudentProfile { email:string; name:string; level:string; }
interface Props { question:PSLEQuestion; onBack:()=>void; student?:StudentProfile; }
const SEED_MESSAGE: Message = { role:"sage", content:"", ts:0 };
function fmtTime(ts:number):string { if(ts===0)return""; return new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); }

function DiagramPanel({ src,caption,question,marks }: { src:string;caption?:string;question:string;marks:number }) {
  const [expanded,setExpanded]=useState(false);
  return (
    <div className="border-b border-orange-100 bg-amber-50/60 px-4 py-3">
      <div className="max-w-2xl mx-auto">
        {question&&(
          <div className="mb-2 flex items-start gap-2">
            <span className="text-orange-500 font-bold text-xs mt-0.5 flex-shrink-0">❓</span>
            <p className="text-sm text-gray-700 font-medium leading-snug">{question}</p>
            {marks>0&&<span className="ml-auto flex-shrink-0 text-xs text-gray-400 bg-white border border-orange-100 rounded-full px-2 py-0.5">{marks}m</span>}
          </div>
        )}
        <div className={`relative rounded-xl overflow-hidden border border-orange-100 bg-white cursor-pointer transition-all ${expanded?"max-h-none":"max-h-48"}`} onClick={()=>setExpanded(!expanded)}>
          {src.startsWith("data:")
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={src} alt={caption||"Exam diagram"} className="w-full object-contain" style={{ maxHeight:expanded?"none":"192px",objectFit:"contain",objectPosition:"top" }}/>
            : <Image src={src} alt={caption||"Exam diagram"} width={700} height={400} className="w-full object-contain" style={{ maxHeight:expanded?"none":"192px",objectFit:"contain",objectPosition:"top" }}/>
          }
          {!expanded&&<div className="absolute bottom-0 left-0 right-0 h-10 flex items-center justify-center" style={{ background:"linear-gradient(to top,rgba(255,249,240,0.95),transparent)" }}><span className="text-xs text-orange-400 font-medium">Tap to expand ↕</span></div>}
          {expanded&&<div className="flex justify-center py-1 border-t border-orange-50"><span className="text-xs text-orange-400 font-medium">Tap to collapse ↑</span></div>}
        </div>
        {caption&&<p className="text-xs text-gray-400 mt-1 text-center italic">{caption}</p>}
      </div>
    </div>
  );
}

function StarRating({ stars }: { stars:number }) {
  return <div className="flex gap-0.5">{[1,2,3].map(s=><span key={s} className={`text-sm ${s<=stars?"text-yellow-400":"text-gray-200"}`}>★</span>)}</div>;
}

// ── Parse "(a) ... (b) ..." into parts ──────────────────────────────────────
function parseQuestionParts(raw: string): { label: string; text: string }[] {
  // Match only single-letter part labels (a)–(z), NOT multi-char like (cm), (bi), etc.
  const re = /\(([a-z])\)\s*/gi;
  const matches = Array.from(raw.matchAll(re));
  if (matches.length < 2) return []; // single part — use normal flow
  const parts: { label: string; text: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1];
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    parts.push({ label, text: raw.slice(start, end).trim() });
  }
  return parts;
}

// ── Single-part Sage chat (reused per part) ──────────────────────────────────
function SageChat({ partQuestion, partLabel, marks, modelAnswer, keywords, context, onPartComplete, isLastPart, firstName, initialAnswer }: {
  partQuestion: string; partLabel?: string; marks: number; modelAnswer: string; keywords: string[];
  context: string; onPartComplete: (stars: number) => void; isLastPart: boolean; firstName: string;
  initialAnswer?: string;
}) {
  const label = partLabel ? `(${partLabel})` : "";
  const openingMsg = `Hi ${firstName}! 👋 Let's tackle ${label ? `part ${label}` : "this question"}.\n\n❓ **${label} ${partQuestion}** *(${marks} mark${marks !== 1 ? "s" : ""})*\n\nWrite your answer below — take your time, I'll guide you step by step!`;

  const [messages, setMessages] = useState<Message[]>([{ ...SEED_MESSAGE, content: openingMsg }]);
  const [input, setInput] = useState(initialAnswer ?? "");
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalStars, setTotalStars] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSkip() {
    setIsComplete(true);
    onPartComplete(0); // 0 stars for skipped part
  }

  function speak(text: string) {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/\*\*/g, "").replace(/[#_~`]/g, "").replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, "").replace(/[☀-➿]/g, "").replace(/\n+/g, " ").trim();
    if (!clean) return;
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 1.08; utt.pitch = 1.22;
    window.speechSynthesis.speak(utt);
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); const last = messages[messages.length - 1]; if (last?.role === "sage" && last.content) speak(last.content); }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!ttsEnabled && typeof window !== "undefined") window.speechSynthesis?.cancel(); }, [ttsEnabled]);

  // Core eval — takes the answer text directly so closures can't capture stale state
  const evalAnswer = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || isComplete) return;
    const studentMsg: Message = { role: "student", content: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, studentMsg]);
    setInput(""); setLoading(true);
    const history = messages.filter(m => m.ts !== 0).map(m => ({ role: m.role === "sage" ? "assistant" : "user", content: m.content }));
    try {
      const res = await fetch("/api/psle-eval", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ questionContext: `${context}\n\nQuestion: ${partQuestion}`, studentAnswer: trimmed, conversationHistory: history, modelAnswer, keywords, marks }) });
      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { role: "sage", content: "Oops! Something went wrong. Please try again 😅", ts: Date.now() }]);
      } else {
        const stars = data.stars ?? 0;
        setTotalStars(prev => Math.max(prev, stars));
        setMessages(prev => [...prev, { role: "sage", content: data.reply, stars, ts: Date.now() }]);
        if (data.isComplete) { setIsComplete(true); onPartComplete(stars); }
      }
    } catch {
      setMessages(prev => [...prev, { role: "sage", content: "Something went wrong. Please check your connection! 🌐", ts: Date.now() }]);
    } finally { setLoading(false); }
  }, [loading, isComplete, messages, context, partQuestion, modelAnswer, keywords, marks, onPartComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(() => evalAnswer(input), [evalAnswer, input]);

  // Auto-evaluate the pre-filled photo answer — pass it directly, never rely on input state
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (initialAnswer && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      const t = setTimeout(() => evalAnswer(initialAnswer), 900);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }

  return (
    <div className="rounded-2xl overflow-hidden border border-orange-100 bg-white shadow-sm">
      {/* Part label header */}
      {partLabel && (
        <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "linear-gradient(90deg,#FFF7ED,#FFF0F5)" }}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#FF6B35" }}>Part ({partLabel})</span>
          <span className="text-xs text-gray-400">· {marks} mark{marks !== 1 ? "s" : ""}</span>
          {totalStars > 0 && <StarRating stars={totalStars} />}
          {/* Skip button — show on any incomplete part */}
          {!isComplete && (
            <button
              onClick={() => setShowSkipConfirm(true)}
              className="ml-auto text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{ color: "#9CA3AF", borderColor: "#E5E7EB", background: "white" }}
              title="Skip this part">
              Skip →
            </button>
          )}
          <button onClick={() => setTtsEnabled(v => !v)} title={ttsEnabled ? "Mute" : "Read aloud"} className="rounded-full p-1 transition-colors" style={{ background: ttsEnabled ? "#FFF0E8" : "#F3F4F6", color: ttsEnabled ? "#FF6B35" : "#9CA3AF" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {ttsEnabled ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></> : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>}
            </svg>
          </button>
        </div>
      )}
      {/* Messages */}
      <div className="px-4 py-4 flex flex-col gap-3 max-h-96 overflow-y-auto">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${msg.role === "student" ? "text-white rounded-br-md" : "bg-gray-50 text-gray-800 rounded-bl-md border border-orange-100"}`} style={msg.role === "student" ? { background: "linear-gradient(135deg,#FF9A56,#FF6B9D)" } : {}}>
                {msg.role === "sage" && <div className="flex items-center gap-1.5 mb-1.5"><SageMascot width={16} height={19} /><span className="text-xs font-semibold text-orange-500">Sage</span>{msg.stars !== undefined && msg.stars > 0 && <StarRating stars={msg.stars} />}</div>}
                <p className="whitespace-pre-wrap">{msg.content.split(/(\*\*[^*]+\*\*)/).map((p, j) => p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : p)}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-orange-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2"><SageMascot width={16} height={19} /><div className="flex gap-1">{[0, 1, 2].map(i => <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-300" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />)}</div></div>
            </div>
          </div>
        )}
        {/* Skip confirm dialog */}
        {showSkipConfirm && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-1">Skip this part?</p>
            <p className="text-xs text-gray-500 mb-3">You won&apos;t get stars for it, but you can move to the next part.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowSkipConfirm(false)} className="flex-1 py-2 rounded-lg text-xs font-semibold border" style={{ borderColor: "#FFD0B0", color: "#FF6B35", background: "white" }}>Keep trying</button>
              <button onClick={handleSkip} className="flex-1 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: "#9CA3AF" }}>Yes, skip →</button>
            </div>
          </motion.div>
        )}
        {isComplete && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg,#FFD700,#FFA500)" }}>
            <div className="p-3 text-center">
              <p className="text-white font-bold text-sm">{totalStars === 0 ? "⏭ Part skipped" : `⭐ Part (${partLabel}) complete!`}</p>
              {!isLastPart && <p className="text-orange-100 text-xs mt-1">Scroll down for the next part →</p>}
            </div>
            {keywords.length > 0 && (
              <div className="px-3 pb-3">
                <div className="rounded-lg p-2.5" style={{ background: "rgba(0,0,0,0.12)" }}>
                  <p className="text-orange-100 text-xs font-semibold mb-1.5">🔑 Key concepts for this part:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((kw, i) => (
                      <span key={i} className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      {!isComplete && (
        <div className="border-t border-orange-100 px-4 py-3" style={{ background: "#FFFBF7" }}>
          <div className="flex gap-2 items-end">
            <textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }} onKeyDown={handleKeyDown} placeholder="Write your answer…  Enter to send" maxLength={600} rows={2} className="flex-1 resize-none rounded-xl border border-orange-200 bg-orange-50/50 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all" style={{ minHeight: "44px", maxHeight: "120px" }} />
            <button onClick={handleSubmit} disabled={!input.trim() || loading} className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40" style={{ background: "linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          {/* Skip link — shown when there's no part-label header (single part or no label) */}
          {!partLabel && (
            <button onClick={() => setShowSkipConfirm(true)} className="mt-2 text-xs text-gray-400 hover:text-gray-500 transition-colors w-full text-center">
              Skip this question →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Post-session survey ────────────────────────────────────────────────────────
const TOPICS_LIST = [
  "Plants & Photosynthesis","Digestion","Forces & Motion","Electricity","Heat Transfer",
  "Water Cycle","Food Chains","Life Cycles","Sound","Light","States of Matter","Magnetism","Other",
];

function SageSurvey({ student, topic, onDone, onSkip }: {
  student: { email: string; name: string; level: string } | null;
  topic: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const firstName = student?.name?.split(" ")[0] || "there";
  const [rating, setRating] = useState(0);
  const [nextTopic, setNextTopic] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: student?.email ?? "",
          name: student?.name ?? "",
          level: student?.level ?? "",
          source: "survey",
          rating,
          nextTopic,
          feedback,
          sessionTopic: topic,
        }),
      });
    } catch { /* non-fatal */ }
    setLoading(false);
    setSubmitted(true);
    setTimeout(onDone, 2000);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-5"
      style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(6px)" }}>
      <motion.div initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} transition={{duration:0.3,ease:"easeOut"}}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ background:"#FFFFFF" }}>

        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-bold text-base">Quick check-in 💬</span>
            <button onClick={onSkip} className="text-white/60 hover:text-white text-xl leading-none">✕</button>
          </div>
          <p className="text-orange-100 text-sm">30 seconds — helps us make Sage better for you!</p>
        </div>

        {submitted ? (
          <div className="px-6 py-10 text-center flex flex-col items-center gap-3">
            <div className="text-5xl">🙏</div>
            <p className="font-bold text-gray-800 text-lg">Thank you, {firstName}!</p>
            <p className="text-sm text-gray-500">Your feedback helps Sage get smarter. See you next time!</p>
          </div>
        ) : (
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* Q1: Star rating */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">How helpful was Sage today?</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={()=>setRating(n)}
                    className="text-2xl transition-transform active:scale-90"
                    style={{ opacity: rating >= n ? 1 : 0.3 }}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Next topic chips */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">What topic do you want to practise next?</p>
              <div className="flex flex-wrap gap-2">
                {TOPICS_LIST.map(t => (
                  <button key={t} onClick={()=>setNextTopic(t)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: nextTopic === t ? "linear-gradient(135deg,#FF9A56,#FF6B9D)" : "#FFF0E8",
                      color: nextTopic === t ? "white" : "#C94A0E",
                      border: nextTopic === t ? "none" : "1px solid #FFD0B0",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Free text */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">One thing we could improve? <span className="font-normal text-gray-400">(optional)</span></p>
              <textarea
                value={feedback}
                onChange={e=>setFeedback(e.target.value)}
                placeholder="e.g. Sage talked too much, I wanted more hints..."
                rows={2}
                className="w-full rounded-xl border border-orange-200 bg-orange-50/40 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={onSkip} className="flex-1 py-3 rounded-2xl text-sm font-semibold border transition-colors"
                style={{ borderColor:"#E5E7EB",color:"#9CA3AF",background:"white" }}>
                Skip
              </button>
              <button onClick={handleSubmit} disabled={rating===0||loading}
                className="flex-2 flex-1 py-3 rounded-2xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
                {loading ? "Sending…" : "Send feedback →"}
              </button>
            </div>

          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function PSLESocraticTerminal({ question, onBack, student }: Props) {
  const q2 = question as PSLEQuestion & { isUploaded?: boolean; diagramImage2?: string };
  const isUploaded = !!q2.isUploaded;
  const hasDiagram = !!question.diagramImage;
  const firstName = student?.name?.split(" ")[0] || "there";

  // Parse multi-part questions for uploaded flow
  const uploadedParts = isUploaded ? parseQuestionParts(question.question) : [];
  const isMultiPart = uploadedParts.length >= 2;

  // Parse student answers into a map { "a": "...", "b": "...", ... } once
  // Only split on single-letter labels (a)–(z) to avoid matching "(cm)", "(bi)" etc.
  const studentAnswerMap = useMemo<Record<string, string>>(() => {
    const sa = (question as PSLEQuestion & { studentAnswer?: string }).studentAnswer;
    if (!sa) return {};
    const map: Record<string, string> = {};
    const parts = sa.split(/(?=\([a-z]\)(?!\w))/i);
    for (const part of parts) {
      const labelMatch = part.match(/^\(([a-z])\)(?!\w)\s*([\s\S]*)/i);
      if (labelMatch) {
        map[labelMatch[1].toLowerCase()] = labelMatch[2].trim();
      }
    }
    if (Object.keys(map).length === 0 && sa.trim()) {
      map["_raw"] = sa.trim();
    }
    return map;
  }, [question]);

  // Per-part completion tracking
  const [partStars, setPartStars] = useState<number[]>(isMultiPart ? Array(uploadedParts.length).fill(-1) : []);
  const partRefs = useRef<(HTMLDivElement | null)[]>([]);

  function handlePartComplete(idx: number, stars: number) {
    setPartStars(prev => { const next = [...prev]; next[idx] = stars; return next; });
    // Auto-scroll to next part after a short delay
    setTimeout(() => {
      if (idx + 1 < uploadedParts.length) {
        partRefs.current[idx + 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 1200);
  }

  const allPartsComplete = isMultiPart && partStars.every(s => s >= 0);

  // For regular (non-uploaded) questions — keep original single-chat flow
  const openingMessage = `Hi ${firstName}! 👋 Let's look at this question together.\n\n${question.context ? `📖 **Context:** ${question.context}\n\n` : ""}❓ **Question (${question.marks} mark${question.marks !== 1 ? "s" : ""}):** ${question.question}\n\nTake your time — write down what you think, and I'll help you build your answer!`;
  const [messages,setMessages] = useState<Message[]>([{...SEED_MESSAGE,content:openingMessage}]);
  const [input,setInput] = useState("");
  const [loading,setLoading] = useState(false);
  const [isComplete,setIsComplete] = useState(false);
  const [totalStars,setTotalStars] = useState(0);
  const [turnCount,setTurnCount] = useState(0);
  const [ttsEnabled,setTtsEnabled] = useState(false);
  const [chimeEnabled,setChimeEnabled] = useState(false);
  const [showBreathing,setShowBreathing] = useState(false);
  const [breathingKey,setBreathingKey] = useState(0);
  const [showReport,setShowReport] = useState(false);
  const [turns,setTurns] = useState<TurnRecord[]>([]);
  const [showPauseMenu,setShowPauseMenu] = useState(false);
  const [sessionEnded,setSessionEnded] = useState(false);
  const [showSurvey,setShowSurvey] = useState(false);
  const [surveyDone,setSurveyDone] = useState(false);
  const sessionStartMs = useRef(Date.now());
  const turnStartMs = useRef(Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Send session data to Google Sheets when question is completed
  useEffect(()=>{
    if(!isComplete||!student?.email)return;
    const timeSeconds = Math.round((Date.now()-sessionStartMs.current)/1000);
    fetch("/api/sessions",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        email:student.email,
        name:student.name,
        level:student.level,
        questionId:`${question.year}-Q${question.questionNumber}${question.part}`,
        year:question.year,
        topic:question.topic,
        stars:totalStars,
        timeSeconds,
        turns:turns.length,
        completed:true,
      }),
    }).catch(()=>{/* silent — don't block UI */});
  },[isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  function speak(text:string) {
    if(!ttsEnabled||typeof window==="undefined"||!window.speechSynthesis)return;
    window.speechSynthesis.cancel();

    // Strip markdown, emoji, emoticons, and symbols that TTS reads aloud
    const clean = text
      .replace(/\*\*/g,"").replace(/[#_~`]/g,"")
      // Remove all emoji (Unicode ranges)
      .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g,"")
      .replace(/[\u2600-\u27BF]/g,"")
      .replace(/[\uFE00-\uFEFF]/g,"")
      // Remove emoticons like :) :D :-) etc
      .replace(/[:;=8][-o*']?[)(\]\[dDpP/\\:}{@|]/gi,"")
      // Remove leftover punctuation clusters and bullets
      .replace(/[→←↑↓•◆▸▹►]/g,"")
      // Clean up multiple spaces/newlines
      .replace(/\n+/g," ").replace(/\s{2,}/g," ").trim();

    if(!clean)return;

    // Split into sentences for consistent pacing — avoids the speed-drift glitch
    // where long utterances accelerate mid-way through
    const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];

    const voices = window.speechSynthesis.getVoices();
    // Warm, bright, natural-sounding English voices — child-friendly feel
    const preferred =
      voices.find(v=>/samantha|karen|moira|fiona/i.test(v.name)&&v.lang.startsWith("en")) ||
      voices.find(v=>/zira|hazel|susan/i.test(v.name)&&v.lang.startsWith("en")) ||
      voices.find(v=>v.lang==="en-GB"&&!v.name.toLowerCase().includes("male")) ||
      voices.find(v=>v.lang.startsWith("en-")&&v.localService);

    let i=0;
    function speakNext(){
      if(i>=sentences.length||!window.speechSynthesis)return;
      const utt=new SpeechSynthesisUtterance(sentences[i].trim());
      utt.rate=1.08;   // Naturally brisk but not rushed
      utt.pitch=1.22;  // Lifted, bright, encouraging
      utt.volume=1;
      if(preferred)utt.voice=preferred;
      utt.onend=()=>{ i++; speakNext(); };
      window.speechSynthesis.speak(utt);
    }
    speakNext();
  }

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
    const last=messages[messages.length-1];
    if(last?.role==="sage"&&last.content)speak(last.content);
  },[messages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{ if(!ttsEnabled&&typeof window!=="undefined")window.speechSynthesis?.cancel(); },[ttsEnabled]);

  const handleSubmit = useCallback(async()=>{
    const trimmed=input.trim();
    if(!trimmed||loading||isComplete)return;
    const elapsed = Date.now()-turnStartMs.current;
    const studentMsg:Message={role:"student",content:trimmed,ts:Date.now(),elapsedMs:elapsed};
    setMessages(prev=>[...prev,studentMsg]);
    setInput(""); setLoading(true);
    const history=messages.filter(m=>m.ts!==0).map(m=>({role:m.role==="sage"?"assistant":"user",content:m.content}));
    try {
      const res = await fetch("/api/psle-eval",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({questionContext:`${question.context}\n\nQuestion: ${question.question}`,studentAnswer:trimmed,conversationHistory:history,modelAnswer:question.modelAnswer,keywords:question.keywords,marks:question.marks})});
      const data = await res.json();
      const newTurn = turnCount+1; setTurnCount(newTurn);
      if(data.error){
        setMessages(prev=>[...prev,{role:"sage",content:"Oops! Something went wrong. Please try again 😅",ts:Date.now()}]);
      } else {
        const stars=data.stars??0;
        setTotalStars(prev=>Math.max(prev,stars));
        setTurns(prev=>[...prev,{studentText:trimmed,sageReply:data.reply,stars,elapsedMs:elapsed}]);
        setMessages(prev=>[...prev,{role:"sage",content:data.reply,stars,ts:Date.now()}]);
        if(data.isComplete)setIsComplete(true);
      }
    } catch {
      setMessages(prev=>[...prev,{role:"sage",content:"Something went wrong. Please check your connection! 🌐",ts:Date.now()}]);
    } finally {
      setLoading(false); turnStartMs.current=Date.now();
    }
  },[input,loading,isComplete,messages,turnCount,question]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e:React.KeyboardEvent){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSubmit();}}

  function resetQuestion(){
    setMessages([{...SEED_MESSAGE,content:openingMessage}]);
    setInput(""); setIsComplete(false); setTotalStars(0); setTurnCount(0);
    setTurns([]); sessionStartMs.current=Date.now(); turnStartMs.current=Date.now();
  }

  const totalSessionMs = Date.now()-sessionStartMs.current;

  return (
    <div className="min-h-screen flex flex-col" style={{ background:"linear-gradient(135deg,#FFF9F0 0%,#FFF0F5 50%,#F0F5FF 100%)" }}>

      {showBreathing&&(
        <BreathingCircle key={breathingKey} onDone={()=>setShowBreathing(false)} chimeEnabled={chimeEnabled} onToggleChime={()=>setChimeEnabled(v=>!v)}/>
      )}

      {showReport&&(
        <SessionReport question={question} turns={turns} totalStars={totalStars} totalMs={totalSessionMs} onClose={()=>setShowReport(false)}/>
      )}

      {/* Pause / End session menu */}
      {showPauseMenu&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background:"rgba(0,0,0,0.45)",backdropFilter:"blur(8px)" }}>
          <motion.div initial={{opacity:0,scale:0.93,y:16}} animate={{opacity:1,scale:1,y:0}} transition={{duration:0.25,ease:"easeOut"}}
            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background:"#FFFBF7" }}>
            <div className="px-6 pt-6 pb-5" style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
              <div className="flex items-center justify-between">
                <span className="text-white font-bold text-base">Take a break?</span>
                <button onClick={()=>setShowPauseMenu(false)} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
              </div>
              <p className="text-orange-100 text-sm mt-1">You can always come back where you left off.</p>
            </div>
            <div className="px-6 py-5 flex flex-col gap-3">
              <button onClick={()=>setShowPauseMenu(false)}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B35)" }}>
                Continue — I&apos;m ready!
              </button>
              <button onClick={()=>{ setBreathingKey(k=>k+1); setShowBreathing(true); setShowPauseMenu(false); }}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm border transition-colors"
                style={{ borderColor:"#FFD0B0",color:"#FF6B35",background:"#FFF8F3" }}>
                Breathe first, then continue
              </button>
              <div style={{ height:"1px",background:"#F0DDD0" }}/>
              <button onClick={()=>{ setShowPauseMenu(false); setSessionEnded(true); window.speechSynthesis?.cancel(); }}
                className="w-full py-3 rounded-2xl text-sm font-medium transition-colors"
                style={{ color:"#9CA3AF",background:"#F9FAFB" }}>
                End session for now
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Warm end-of-session closure */}
      {sessionEnded&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5" style={{ background:"rgba(255,248,240,0.97)",backdropFilter:"blur(8px)" }}>
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.4,ease:"easeOut"}}
            className="w-full max-w-sm text-center flex flex-col items-center gap-5">
            <div className="text-6xl">🌟</div>
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color:"#2D1B0E",fontFamily:"Georgia,serif" }}>
                Well done, {firstName}!
              </h2>
              <p className="text-sm leading-relaxed" style={{ color:"#7A5540" }}>
                Every question you try makes your brain stronger.<br/>
                Rest, recharge, and come back whenever you&apos;re ready — Sage will be here!
              </p>
            </div>
            {turns.length>0&&(
              <div className="rounded-2xl px-6 py-4 w-full" style={{ background:"#FFF0E8" }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color:"#B8917A" }}>Your progress today</p>
                <div className="flex justify-center gap-6">
                  <div className="text-center"><div className="text-xl font-bold" style={{ color:"#FF6B35" }}>{turns.length}</div><div className="text-xs text-gray-400">turns</div></div>
                  <div className="text-center"><div className="text-xl font-bold" style={{ color:"#FF6B35" }}>{totalStars}</div><div className="text-xs text-gray-400">stars</div></div>
                  <div className="text-center"><div className="text-xl font-bold" style={{ color:"#FF6B35" }}>{Math.floor((Date.now()-sessionStartMs.current)/60000)}m</div><div className="text-xs text-gray-400">time</div></div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 w-full">
              {turns.length>0&&(
                <button onClick={()=>{ setSessionEnded(false); setShowReport(true); }}
                  className="w-full py-3 rounded-2xl text-sm font-semibold border transition-colors"
                  style={{ borderColor:"#FFD0B0",color:"#FF6B35",background:"white" }}>
                  See session report
                </button>
              )}
              {!surveyDone&&(
                <button onClick={()=>setShowSurvey(true)}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm"
                  style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
                  Quick feedback &amp; what&apos;s next →
                </button>
              )}
              {surveyDone&&(
                <button onClick={()=>{ window.speechSynthesis?.cancel(); onBack(); }}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm"
                  style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
                  Back to questions
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Post-session survey overlay */}
      {showSurvey&&(
        <SageSurvey
          student={student ?? null}
          topic={question.topic}
          onDone={()=>{ setSurveyDone(true); setShowSurvey(false); }}
          onSkip={()=>{ setShowSurvey(false); window.speechSynthesis?.cancel(); onBack(); }}
        />
      )}

      <header className="px-4 py-4 border-b border-orange-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={()=>{window.speechSynthesis?.cancel();onBack();}} className="text-gray-400 hover:text-gray-600 transition-colors text-sm flex items-center gap-1 mr-1">← Back</button>
          <SageMascot width={32} height={38}/>
          <div className="flex-1 min-w-0">
            {isUploaded ? (
              <>
                <h2 className="font-bold text-gray-800 text-sm truncate">Your Question — {question.topic}</h2>
                <p className="text-xs text-gray-400">{question.marks} mark{question.marks!==1?"s":""} · Sage is here to help</p>
              </>
            ) : (
              <>
                <h2 className="font-bold text-gray-800 text-sm truncate">{question.year} Q{question.questionNumber}{question.part} — {question.topic}</h2>
                <p className="text-xs text-gray-400">{question.marks} mark{question.marks!==1?"s":""} · Sage is here to help</p>
              </>
            )}
          </div>
          {totalStars>0&&<StarRating stars={totalStars}/>}
          {turns.length>0&&(
            <button onClick={()=>setShowReport(true)} title="View session report" className="flex-shrink-0 rounded-full p-1.5 transition-colors" style={{ background:"#F0F4FF",color:"#6366F1" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            </button>
          )}
          <button onClick={()=>setShowPauseMenu(true)} title="Pause or end session" className="flex-shrink-0 rounded-full p-1.5 transition-colors" style={{ background:"#F3F4F6",color:"#9CA3AF" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/>
            </svg>
          </button>
          <button onClick={()=>{setBreathingKey(k=>k+1);setShowBreathing(true);}} title="Breathing exercise" className="flex-shrink-0 rounded-full p-1.5 transition-colors" style={{ background:"#FFF0E8",color:"#FF6B35" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4"/>
            </svg>
          </button>
          <button onClick={()=>setTtsEnabled(v=>!v)} title={ttsEnabled?"Mute Sage":"Unmute Sage"} className="flex-shrink-0 rounded-full p-1.5 transition-colors" style={{ background:ttsEnabled?"#FFF0E8":"#F3F4F6",color:ttsEnabled?"#FF6B35":"#9CA3AF" }}>
            {ttsEnabled?(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            ):(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── UPLOADED QUESTION: structured layout ─────────────────────────────── */}
      {isUploaded ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5">

            {/* 1. Image(s) */}
            {question.diagramImage && (
              <DiagramPanel src={question.diagramImage} caption={undefined} question="" marks={0} />
            )}
            {q2.diagramImage2 && (
              <DiagramPanel src={q2.diagramImage2} caption="Page 2" question="" marks={0} />
            )}

            {/* 2. Question card */}
            <div className="rounded-2xl overflow-hidden border border-indigo-100 shadow-sm">
              <div className="px-4 py-3" style={{ background: "linear-gradient(135deg,#EEF2FF,#FAF5FF)" }}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{ background: "#6366f1" }}>{question.topic}</span>
                  <span className="text-xs text-gray-400">{question.marks} mark{question.marks !== 1 ? "s" : ""} total</span>
                </div>
                {question.context && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-1">Context</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{question.context}</p>
                  </div>
                )}
                {!isMultiPart && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-1">Question</p>
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">{question.question}</p>
                  </div>
                )}
                {isMultiPart && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">Question</p>
                    <div className="flex flex-col gap-2">
                      {uploadedParts.map((p, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-xs font-bold text-indigo-500 mt-0.5 flex-shrink-0">({p.label})</span>
                          <p className="text-sm text-gray-800 leading-relaxed">{p.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Part chats (or single chat for single-part uploaded) */}
            {isMultiPart ? (
              uploadedParts.map((p, i) => (
                <div key={i} ref={el => { partRefs.current[i] = el; }}>
                  {(i === 0 || partStars[i - 1] >= 0) && (
                    <SageChat
                      partQuestion={p.text}
                      partLabel={p.label}
                      marks={Math.round(question.marks / uploadedParts.length) || 1}
                      modelAnswer={question.modelAnswer}
                      keywords={question.keywords}
                      context={question.context}
                      firstName={firstName}
                      isLastPart={i === uploadedParts.length - 1}
                      onPartComplete={(stars) => handlePartComplete(i, stars)}
                      initialAnswer={studentAnswerMap[p.label?.toLowerCase() ?? ""] || undefined}
                    />
                  )}
                </div>
              ))
            ) : (
              <SageChat
                partQuestion={question.question}
                partLabel={undefined}
                marks={question.marks}
                modelAnswer={question.modelAnswer}
                keywords={question.keywords}
                context={question.context}
                firstName={firstName}
                isLastPart={true}
                onPartComplete={(stars) => setPartStars([stars])}
                initialAnswer={studentAnswerMap["_raw"] || (question as PSLEQuestion & { studentAnswer?: string }).studentAnswer || undefined}
              />
            )}

            {/* All parts done */}
            {allPartsComplete && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 text-center" style={{ background: "linear-gradient(135deg,#FFD700,#FFA500)" }}>
                  <div className="text-4xl mb-2">🏆</div>
                  <h3 className="font-bold text-white text-lg mb-1">All parts complete!</h3>
                  <p className="text-orange-100 text-sm">Brilliant work, {firstName}!</p>
                  <div className="flex justify-center gap-1 mt-3">
                    {partStars.map((s, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <div className="flex gap-0.5">{[1,2,3].map(n=><span key={n} className={`text-xs ${n<=s?"text-yellow-200":"text-orange-300/40"}`}>★</span>)}</div>
                        <span className="text-orange-100/80 text-xs">({uploadedParts[i]?.label})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-5 py-4 flex flex-col gap-2" style={{ background: "#FFFBF7" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl p-3 text-center" style={{ background: "#FFF0E8" }}>
                      <div className="text-base font-bold" style={{ color: "#FF6B35" }}>{partStars.reduce((a,b)=>a+b,0)}/{partStars.length*3} ★</div>
                      <div className="text-xs text-gray-400 mt-0.5">Total stars</div>
                    </div>
                    <div className="rounded-xl p-3 text-center" style={{ background: "#FFF0E8" }}>
                      <div className="text-base font-bold" style={{ color: "#FF6B35" }}>{uploadedParts.length}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Parts tackled</div>
                    </div>
                  </div>
                  <button onClick={onBack} className="w-full py-3 rounded-xl text-white font-semibold text-sm" style={{ background: "linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>Back to questions →</button>
                </div>
              </motion.div>
            )}

            <div style={{ height: 24 }} />
          </div>
        </div>

      ) : (
      /* ── REGULAR QUESTION: original single-chat layout ──────────────────── */
      <>
      {hasDiagram && (
        <DiagramPanel src={question.diagramImage!} caption={question.diagramCaption} question={`Q${question.questionNumber}${question.part}: ${question.question}`} marks={question.marks} />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg,i)=>(
              <motion.div key={i} initial={{opacity:0,y:12,scale:0.97}} animate={{opacity:1,y:0,scale:1}} transition={{duration:0.25,ease:"easeOut"}} className={`flex ${msg.role==="student"?"justify-end":"justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${msg.role==="student"?"text-white rounded-br-md":"bg-white text-gray-800 rounded-bl-md border border-orange-100"}`} style={msg.role==="student"?{background:"linear-gradient(135deg,#FF9A56,#FF6B9D)"}:{}}>
                  {msg.role==="sage"&&(
                    <div className="flex items-center gap-2 mb-2">
                      <SageMascot width={20} height={24}/>
                      <span className="text-xs font-semibold text-orange-500">Sage</span>
                      {msg.stars!==undefined&&msg.stars>0&&<StarRating stars={msg.stars}/>}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content.split(/(\*\*[^*]+\*\*)/).map((part,j)=>part.startsWith("**")&&part.endsWith("**")?<strong key={j}>{part.slice(2,-2)}</strong>:part)}
                  </p>
                  {msg.ts!==0&&(
                    <div className={`flex items-center gap-2 mt-1.5 ${msg.role==="student"?"justify-end":""}`}>
                      <p className={`text-xs ${msg.role==="student"?"text-orange-200":"text-gray-300"}`}>{fmtTime(msg.ts)}</p>
                      {msg.elapsedMs!==undefined&&msg.elapsedMs>5000&&<p className={`text-xs ${msg.role==="student"?"text-orange-200":"text-gray-300"}`}>· {Math.round(msg.elapsedMs/1000)}s</p>}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading&&(
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex justify-start">
              <div className="bg-white border border-orange-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <SageMascot width={20} height={24}/>
                  <div className="flex gap-1">
                    {[0,1,2].map(i=>(
                      <motion.div key={i} className="w-2 h-2 rounded-full bg-orange-300" animate={{scale:[1,1.4,1]}} transition={{duration:0.6,repeat:Infinity,delay:i*0.15}}/>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {isComplete&&(
            <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 text-center" style={{ background:"linear-gradient(135deg,#FFD700 0%,#FFA500 100%)" }}>
                <div className="text-4xl mb-2">🏆</div>
                <h3 className="font-bold text-white text-lg mb-1">Excellent work!</h3>
                <p className="text-orange-100 text-sm mb-1">You answered this in {turnCount} attempt{turnCount!==1?"s":""}!</p>
                <p className="text-orange-200 text-xs mb-3">Time: {Math.floor(totalSessionMs/60000)}m {Math.floor((totalSessionMs%60000)/1000)}s</p>
                <div className="flex justify-center gap-1 mb-4">{[1,2,3].map(s=><span key={s} className="text-2xl">⭐</span>)}</div>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button onClick={()=>setShowReport(true)} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-xl transition-colors">📋 View report</button>
                  <button onClick={resetQuestion} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-xl transition-colors">Try again</button>
                  <button onClick={onBack} className="px-4 py-2 bg-white text-orange-500 font-semibold text-sm rounded-xl hover:bg-orange-50 transition-colors">Next question →</button>
                </div>
              </div>
              {question.keywords.length > 0 && (
                <div className="px-5 py-3" style={{ background:"rgba(0,0,0,0.12) " }}>
                  <div className="rounded-xl p-3" style={{ background:"rgba(255,255,255,0.15)" }}>
                    <p className="text-white/80 text-xs font-semibold mb-2">🔑 Key concepts for this question:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {question.keywords.map((kw,i)=>(
                        <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background:"rgba(255,255,255,0.25)",color:"white" }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          <div ref={bottomRef}/>
        </div>
      </div>

      {!isComplete&&(
        <div className="border-t border-orange-100 bg-white/80 backdrop-blur-sm px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea ref={textareaRef} value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,140)+"px";}} onKeyDown={handleKeyDown} placeholder="Write your answer here… Press Enter to send" maxLength={600} rows={2} className="w-full resize-none rounded-2xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all" style={{ minHeight:"52px",maxHeight:"140px" }}/>
                <span className="absolute bottom-2 right-3 text-xs text-gray-300">{input.length}/600</span>
              </div>
              <button onClick={handleSubmit} disabled={!input.trim()||loading} className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0" style={{ background:"linear-gradient(135deg,#FF9A56,#FF6B9D)" }}>
                {loading?(
                  <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" animate={{rotate:360}} transition={{duration:0.7,repeat:Infinity,ease:"linear"}}/>
                ):(
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Shift+Enter for new line · Enter to send</p>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
