"use client";

import { useState, useRef, useEffect } from "react";
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

// Synthesise a Tibetan singing bowl chime using Web Audio API.
// 432 Hz fundamental + natural harmonics — research links this frequency
// to parasympathetic nervous system activation and reduced cortisol.
// Soft attack, long resonant decay (~5s) mimics a struck metal bowl.
function playBowlChime(type: "inhale" | "exhale" | "done") {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // Frequency map: inhale = rising (4th harmonic of 432), hold/exhale = fundamental, done = pure fifth
    const freq = type === "inhale" ? 528 : type === "exhale" ? 432 : 396;
    const duration = type === "done" ? 6 : 5;

    // Master limiter — caps output at 12% regardless of device volume.
    // Gentle enough to never startle a child even at full device volume.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.12, ctx.currentTime);
    master.connect(ctx.destination);

    // Layer 3 harmonics for a rich bowl overtone series
    [1, 2.756, 5.404].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volume = [0.5, 0.3, 0.12][i]; // relative mix of harmonics

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * ratio, ctx.currentTime);

      // Soft strike attack + long natural decay
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(master); // routed through master limiter
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    });

    // Auto-close context after chime fades
    setTimeout(() => ctx.close(), (duration + 0.2) * 1000);
  } catch {
    // Audio not available — silently skip
  }
}

function BreathingCircle({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale" | "done">("inhale");
  const [cycle, setCycle] = useState(0);
  const CYCLES = 3;

  useEffect(() => {
    // Chime on every phase change — browser requires user gesture first,
    // which is satisfied by the button click that opened this overlay
    // Chimes disabled — uncomment to re-enable
    // if (phase !== "done") {
    //   playBowlChime(phase === "inhale" ? "inhale" : "exhale");
    // } else {
    //   playBowlChime("done");
    // }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timings: Record<string, number> = { inhale: 5000, hold: 5000, exhale: 5000 };
    if (phase === "done") return;
    const t = setTimeout(() => {
      if (phase === "inhale") setPhase("hold");
      else if (phase === "hold") setPhase("exhale");
      else if (phase === "exhale") {
        const next = cycle + 1;
        if (next >= CYCLES) setPhase("done");
        else { setCycle(next); setPhase("inhale"); }
      }
    }, timings[phase]);
    return () => clearTimeout(t);
  }, [phase, cycle]);

  const label = phase === "inhale" ? "Breathe in…" : phase === "hold" ? "Hold…" : phase === "exhale" ? "Breathe out…" : "Well done 🌟";
  const scale = phase === "inhale" ? "scale(1.45)" : phase === "hold" ? "scale(1.45)" : "scale(1)";
  const duration = phase === "inhale" ? "4s" : phase === "hold" ? "0.1s" : "5s";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "rgba(255,248,240,0.97)", backdropFilter: "blur(8px)" }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "#B8917A" }}>
        Take a moment — breathe with Sage
      </p>
      <p className="text-xs mb-8" style={{ color: "#C4A882" }}>
        Follow the circle — in, hold, out
      </p>
      <div className="relative flex items-center justify-center mb-8" style={{ width: 200, height: 200 }}>
        {/* Outer ripple */}
        <div className="absolute rounded-full" style={{
          width: 200, height: 200,
          background: "rgba(255,107,53,0.08)",
          transform: scale,
          transition: `transform ${duration} ease-in-out`,
        }} />
        {/* Middle ring */}
        <div className="absolute rounded-full" style={{
          width: 150, height: 150,
          background: "rgba(255,107,53,0.12)",
          transform: scale,
          transition: `transform ${duration} ease-in-out`,
        }} />
        {/* Core */}
        <div className="absolute rounded-full flex items-center justify-center" style={{
          width: 100, height: 100,
          background: "linear-gradient(135deg, #FF9A56, #FF6B35)",
          transform: scale,
          transition: `transform ${duration} ease-in-out`,
          boxShadow: "0 8px 32px rgba(255,107,53,0.35)",
        }}>
          <SageMascot width={44} height={52} bodyFill="white" />
        </div>
      </div>
      <p className="text-xl font-semibold mb-2" style={{ color: "#2D1B0E", minWidth: 160, textAlign: "center" }}>{label}</p>
      <p className="text-sm mb-10" style={{ color: "#B8917A" }}>Round {Math.min(cycle + 1, CYCLES)} of {CYCLES}</p>
      {phase === "done" ? (
        <button
          onClick={onDone}
          className="px-8 py-3 rounded-2xl text-white font-semibold text-sm"
          style={{ background: "linear-gradient(135deg, #FF9A56, #FF6B35)" }}
        >
          I&apos;m ready — let&apos;s go →
        </button>
      ) : (
        <button onClick={onDone} className="text-xs" style={{ color: "#B8917A" }}>
          Skip breathing exercise
        </button>
      )}
      <p className="text-center mt-8 px-6" style={{ fontSize: "10px", color: "#C4A882", lineHeight: 1.6, maxWidth: 300 }}>
        This is the neuroscience-backed <strong>5‑5‑5 box breathing</strong> technique — shown to calm the nervous system and sharpen focus. Once you are familiar with the timer, close your eyes to deepen the effect.
      </p>
    </div>
  );
}

interface Message {
  role: "sage" | "student";
  content: string;
  stars?: number;
  ts: number;
}

interface StudentProfile {
  email: string;
  name: string;
  level: string;
}

interface Props {
  question: PSLEQuestion;
  student: StudentProfile;
  onBack: () => void;
}

const SEED_MESSAGE: Message = {
  role: "sage",
  content: "",
  ts: 0,
};

function fmtTime(ts: number): string {
  if (ts === 0) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function DiagramPanel({ src, caption, question, marks }: { src: string; caption?: string; question: string; marks: number }) {
  return (
    <div className="border-b border-orange-100 bg-amber-50/60 px-4 py-3">
      <div className="max-w-2xl mx-auto">
        {/* Question text */}
        <div className="mb-2 flex items-start gap-2">
          <span className="text-orange-500 font-bold text-xs mt-0.5 flex-shrink-0">❓</span>
          <p className="text-sm text-gray-700 font-medium leading-snug">{question}</p>
          <span className="ml-auto flex-shrink-0 text-xs text-gray-400 bg-white border border-orange-100 rounded-full px-2 py-0.5">
            {marks}m
          </span>
        </div>
        {/* Diagram — always shown in full, never cropped */}
        <div className="rounded-xl border border-orange-100 bg-white p-2">
          <Image
            src={src}
            alt={caption || "Exam diagram"}
            width={700}
            height={500}
            className="w-full h-auto"
            style={{ objectFit: "contain" }}
          />
        </div>
        {caption && (
          <p className="text-xs text-gray-400 mt-1 text-center italic">{caption}</p>
        )}
      </div>
    </div>
  );
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((s) => (
        <span key={s} className={`text-sm ${s <= stars ? "text-yellow-400" : "text-gray-200"}`}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function PSLESocraticTerminal({ question, student, onBack }: Props) {
  const hasDiagram = !!question.diagramImage;
  const openingMessage = hasDiagram
    ? `Hi there! 👋 Look at the diagram above carefully, then try to answer the question. I'll guide you step by step — no rush!`
    : `Hi there! 👋 Let's look at this question together.\n\n📖 **Context:** ${question.context}\n\n❓ **Question (${question.marks} mark${question.marks !== 1 ? "s" : ""}):** ${question.question}\n\nTake your time — write down what you think, and I'll help you build your answer!`;

  const [messages, setMessages] = useState<Message[]>([
    { ...SEED_MESSAGE, content: openingMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalStars, setTotalStars] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  // Ref mirrors state so speak() can read current value without being a useEffect dependency
  const setShowBreathingSafe = (val: boolean) => {
    showBreathingRef.current = val;
    setShowBreathing(val);
  };
  const [breathingKey, setBreathingKey] = useState(0);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const showBreathingRef = useRef(false);
  const ttsEnabledRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-trigger breathing after 6 turns (neuro overload threshold)
  const OVERLOAD_TURNS = 6;

  // Pre-load voices as soon as they're available (iOS Safari returns empty on first call)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  function pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = voicesRef.current.length
      ? voicesRef.current
      : window.speechSynthesis.getVoices();

    // iOS/macOS — best available in order:
    // "Samantha (Enhanced)" is the warmest built-in on iOS/macOS, sounds genuinely human
    // "Karen (Enhanced)" — bright Australian, great for Singapore kids
    // "Nicky" — clear and friendly American female, ships on newer iOS
    // "Siri" — if accessible, highest quality
    const iosMac =
      voices.find(v => /samantha/i.test(v.name) && /enhanced/i.test(v.name)) ||
      voices.find(v => /\bkaren\b/i.test(v.name) && /enhanced/i.test(v.name)) ||
      voices.find(v => /\bnicky\b/i.test(v.name) && v.lang.startsWith("en")) ||
      voices.find(v => /\bsiri\b/i.test(v.name) && v.lang.startsWith("en")) ||
      voices.find(v => /samantha/i.test(v.name) && v.lang.startsWith("en")) ||
      voices.find(v => /\bkaren\b/i.test(v.name) && v.lang.startsWith("en"));

    // Windows Edge — neural voices, genuinely warm and natural:
    // "Microsoft Aria" is the clear winner — warm, conversational, kid-friendly
    // "Microsoft Jenny" — friendly and clear
    // "Microsoft Ava" — softer, gentle tone
    const edge =
      voices.find(v => /microsoft aria/i.test(v.name)) ||
      voices.find(v => /microsoft jenny/i.test(v.name)) ||
      voices.find(v => /microsoft ava/i.test(v.name));

    // Windows Chrome (no Edge neural voices) — best built-in:
    // "Google UK English Female" is notably warmer than US
    const winChrome =
      voices.find(v => /google uk english female/i.test(v.name)) ||
      voices.find(v => /google us english/i.test(v.name));

    // Android — Google TTS female voices, UK > AU > US for warmth
    const android =
      voices.find(v => /google.*en.*gb/i.test(v.name)) ||
      voices.find(v => /google.*en.*au/i.test(v.name)) ||
      voices.find(v => /google.*english/i.test(v.name) && v.lang.startsWith("en"));

    return (
      iosMac ||
      edge ||
      winChrome ||
      android ||
      voices.find(v => v.lang === "en-AU") ||
      voices.find(v => v.lang === "en-GB") ||
      voices.find(v => v.lang.startsWith("en-"))
    );
  }

  function speak(text: string) {
    if (!ttsEnabledRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/\*\*/g, "")
      .replace(/[#_~`]/g, "")
      // Strip emoji — remove surrogate pairs (all emoji above U+FFFF) and common symbol blocks
      .replace(/[\uD800-\uDFFF]/g, "")
      .replace(/[☀-➿]/g, "")
      .replace(/[︀-﻿]/g, "")
      .trim();
    const utt = new SpeechSynthesisUtterance(clean);
    const voice = pickVoice();
    if (voice) utt.voice = voice;
    utt.rate = 0.92;   // measured, not rushed
    utt.pitch = 1.15;  // bright and encouraging, not flat
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    const last = messages[messages.length - 1];
    // Use ref so this effect doesn't re-fire when breathing state toggles
    if (last?.role === "sage" && last.content && !showBreathingRef.current) speak(last.content);
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop speech when TTS toggled off
  useEffect(() => {
    if (!ttsEnabled && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [ttsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || loading || isComplete) return;

    const studentMsg: Message = {
      role: "student",
      content: trimmed,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, studentMsg]);
    setInput("");
    setLoading(true);

    const history = messages
      .filter((m) => m.ts !== 0)
      .map((m) => ({ role: m.role === "sage" ? "assistant" : "user", content: m.content }));

    try {
      const res = await fetch("/api/psle-eval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionContext: `${question.context}\n\nQuestion: ${question.question}`,
          studentAnswer: trimmed,
          conversationHistory: history,
          modelAnswer: question.modelAnswer,
          keywords: question.keywords,
          marks: question.marks,
        }),
      });

      const data = await res.json();
      const newTurn = turnCount + 1;
      setTurnCount(newTurn);
      if (newTurn === OVERLOAD_TURNS) {
        setBreathingKey(k => k + 1);
        setShowBreathingSafe(true);
      }

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "sage", content: "Oops! Something went wrong. Please try again 😅", ts: Date.now() },
        ]);
      } else {
        const stars = data.stars ?? 0;
        setTotalStars(Math.max(totalStars, stars));
        setMessages((prev) => [
          ...prev,
          { role: "sage", content: data.reply, stars, ts: Date.now() },
        ]);
        if (data.isComplete) {
          setIsComplete(true);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "sage", content: "Something went wrong. Please check your connection and try again! 🌐", ts: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function resetQuestion() {
    setMessages([{ ...SEED_MESSAGE, content: openingMessage }]);
    setInput("");
    setIsComplete(false);
    setTotalStars(0);
    setTurnCount(0);
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "linear-gradient(135deg, #FFF9F0 0%, #FFF0F5 50%, #F0F5FF 100%)" }}>

      {/* Breathing overlay */}
      {showBreathing && (
        <BreathingCircle key={breathingKey} onDone={() => {
          setShowBreathingSafe(false);
          // Speak the last Sage message now that the student is ready
          const last = messages[messages.length - 1];
          if (last?.role === "sage" && last.content) speak(last.content);
        }} />
      )}

      {/* Header */}
      <header className="px-4 py-4 border-b border-orange-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {!isComplete && (
            <button
              onClick={() => { window.speechSynthesis?.cancel(); onBack(); }}
              className="text-gray-400 hover:text-gray-600 transition-colors text-sm flex items-center gap-1 mr-1"
              title="Skip this question"
            >
              ⊘ Skip
            </button>
          )}
          <SageMascot width={32} height={38} />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-800 text-sm truncate">
              {question.year} Q{question.questionNumber}{question.part} — {question.topic}
            </h2>
            <p className="text-xs text-gray-400">
              {question.marks} mark{question.marks !== 1 ? "s" : ""} · Sage is here to help
            </p>
          </div>
          {totalStars > 0 && <StarRating stars={totalStars} />}
          <button
            onClick={() => { setBreathingKey(k => k + 1); setShowBreathingSafe(true); }}
            title="Breathing exercise"
            className="flex-shrink-0 rounded-full p-1.5 transition-colors"
            style={{ background: "#FFF0E8", color: "#FF6B35" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </button>
          <button
            onClick={() => setTtsEnabled(v => { ttsEnabledRef.current = !v; return !v; })}
            title={ttsEnabled ? "Mute Sage's voice" : "Unmute Sage's voice"}
            className="flex-shrink-0 rounded-full p-1.5 transition-colors"
            style={{ background: ttsEnabled ? "#FFF0E8" : "#F3F4F6", color: ttsEnabled ? "#FF6B35" : "#9CA3AF" }}
          >
            {ttsEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Diagram panel — shown when question has a diagram */}
      {question.diagramImage && (
        <DiagramPanel
          src={question.diagramImage}
          caption={question.diagramCaption}
          question={`Q${question.questionNumber}${question.part}: ${question.question}`}
          marks={question.marks}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                    msg.role === "student"
                      ? "text-white rounded-br-md"
                      : "bg-white text-gray-800 rounded-bl-md border border-orange-100"
                  }`}
                  style={
                    msg.role === "student"
                      ? { background: "linear-gradient(135deg, #FF9A56, #FF6B9D)" }
                      : {}
                  }
                >
                  {msg.role === "sage" && (
                    <div className="flex items-center gap-2 mb-2">
                      <SageMascot width={20} height={24} />
                      <span className="text-xs font-semibold text-orange-500">Sage</span>
                      {msg.stars !== undefined && msg.stars > 0 && <StarRating stars={msg.stars} />}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={i}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </p>
                  {msg.ts !== 0 && (
                    <p className={`text-xs mt-1.5 ${msg.role === "student" ? "text-orange-200" : "text-gray-300"}`}>
                      {fmtTime(msg.ts)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-orange-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <SageMascot width={20} height={24} />
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-orange-300"
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Completion card */}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl p-5 text-center shadow-sm"
              style={{ background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)" }}
            >
              <div className="text-4xl mb-2">🏆</div>
              <h3 className="font-bold text-white text-lg mb-1">Excellent work!</h3>
              <p className="text-orange-100 text-sm mb-3">
                You answered this in {turnCount} attempt{turnCount !== 1 ? "s" : ""}!
              </p>
              <div className="flex justify-center gap-1 mb-4">
                {[1, 2, 3].map((s) => (
                  <span key={s} className="text-2xl">⭐</span>
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={resetQuestion}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm rounded-xl transition-colors"
                >
                  Try again
                </button>
                <button
                  onClick={onBack}
                  className="px-4 py-2 bg-white text-orange-500 font-semibold text-sm rounded-xl hover:bg-orange-50 transition-colors"
                >
                  Next question →
                </button>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      {!isComplete && (
        <div className="border-t border-orange-100 bg-white/80 backdrop-blur-sm px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Write your answer here... Press Enter to send"
                  maxLength={600}
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition-all"
                  style={{ minHeight: "52px", maxHeight: "140px" }}
                />
                <span className="absolute bottom-2 right-3 text-xs text-gray-300">
                  {input.length}/600
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || loading}
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #FF9A56, #FF6B9D)" }}
              >
                {loading ? (
                  <motion.div
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Shift+Enter for new line · Enter to send
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
