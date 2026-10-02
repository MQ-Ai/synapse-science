"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimation, useReducedMotion } from "framer-motion";

// ── Breath cycle constants (seconds) ────────────────────────────────────────
const INHALE = 4;
const HOLD = 1.5;
const EXHALE = 6;
const PAUSE = 1;

const EASE_IN: [number, number, number, number] = [0.4, 0, 0.2, 1];
const EASE_OUT: [number, number, number, number] = [0.6, 0, 0.4, 1];

interface BreathingRingProps {
  /** SVG viewBox side length in px. Default 320. */
  size?: number;
  className?: string;
}

export default function BreathingRing({
  size = 320,
  className = "",
}: BreathingRingProps) {
  const prefersReduced = useReducedMotion();
  const outerCtrl = useAnimation();
  const middleCtrl = useAnimation();
  const innerCtrl = useAnimation();
  const glowCtrl = useAnimation();
  const alive = useRef(true);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;
  const middleR = size * 0.28;
  const innerR = size * 0.16;
  const glowR = size * 0.42;

  useEffect(() => {
    if (prefersReduced) return;
    alive.current = true;

    async function breathe() {
      while (alive.current) {
        // — INHALE —
        await Promise.all([
          outerCtrl.start({
            scale: 1.22,
            opacity: 0.95,
            transition: { duration: INHALE, ease: EASE_IN },
          }),
          middleCtrl.start({
            scale: 1.18,
            opacity: 0.7,
            transition: { duration: INHALE, ease: EASE_IN, delay: 0.08 },
          }),
          innerCtrl.start({
            scale: 1.14,
            opacity: 0.55,
            transition: { duration: INHALE, ease: EASE_IN, delay: 0.16 },
          }),
          glowCtrl.start({
            opacity: 0.2,
            scale: 1.3,
            transition: { duration: INHALE, ease: EASE_IN },
          }),
        ]);

        // — HOLD —
        await new Promise((r) => setTimeout(r, HOLD * 1000));

        // — EXHALE —
        await Promise.all([
          outerCtrl.start({
            scale: 1,
            opacity: 0.72,
            transition: { duration: EXHALE, ease: EASE_OUT },
          }),
          middleCtrl.start({
            scale: 1,
            opacity: 0.42,
            transition: { duration: EXHALE, ease: EASE_OUT, delay: 0.08 },
          }),
          innerCtrl.start({
            scale: 1,
            opacity: 0.28,
            transition: { duration: EXHALE, ease: EASE_OUT, delay: 0.16 },
          }),
          glowCtrl.start({
            opacity: 0.04,
            scale: 1,
            transition: { duration: EXHALE, ease: EASE_OUT },
          }),
        ]);

        // — PAUSE —
        await new Promise((r) => setTimeout(r, PAUSE * 1000));
      }
    }

    breathe();
    return () => {
      alive.current = false;
      outerCtrl.stop();
      middleCtrl.stop();
      innerCtrl.stop();
      glowCtrl.stop();
    };
  }, [prefersReduced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`flex flex-col items-center gap-5 select-none ${className}`}
      aria-label="Breathing rhythm guide"
      role="img"
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Ambient glow gradient */}
          <radialGradient id="synGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7B9EA6" stopOpacity="1" />
            <stop offset="100%" stopColor="#7B9EA6" stopOpacity="0" />
          </radialGradient>

          {/* Outer ring stroke gradient */}
          <linearGradient id="synRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C5D5DA" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#5C7A85" stopOpacity="0.58" />
          </linearGradient>

          {/* Inner fill */}
          <radialGradient id="synInner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A8C4CB" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#A8C4CB" stopOpacity="0" />
          </radialGradient>

          {/* Blur for glow layer */}
          <filter id="synBlur" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" />
          </filter>

          {/* Soft halo on the outer ring */}
          <filter id="synHalo" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient glow */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={glowR}
          fill="url(#synGlow)"
          filter="url(#synBlur)"
          initial={{ opacity: 0.04, scale: 1 }}
          animate={glowCtrl}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Outer geometric ring */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill="none"
          stroke="url(#synRing)"
          strokeWidth={size * 0.008}
          filter="url(#synHalo)"
          initial={{ scale: 1, opacity: 0.72 }}
          animate={outerCtrl}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* 12 tick marks on the outer ring */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const tLen = size * 0.024;
          const r1 = outerR - tLen / 2;
          const r2 = outerR + tLen / 2;
          return (
            <line
              key={i}
              x1={cx + Math.cos(angle) * r1}
              y1={cy + Math.sin(angle) * r1}
              x2={cx + Math.cos(angle) * r2}
              y2={cy + Math.sin(angle) * r2}
              stroke="#C5D5DA"
              strokeWidth={size * 0.003}
              strokeOpacity={i % 3 === 0 ? 0.55 : 0.18}
            />
          );
        })}

        {/* Middle dashed ring */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={middleR}
          fill="none"
          stroke="#8AAAB2"
          strokeWidth={size * 0.005}
          strokeDasharray={`${size * 0.06} ${size * 0.032}`}
          initial={{ scale: 1, opacity: 0.42 }}
          animate={middleCtrl}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Inner translucent fill disc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill="url(#synInner)"
          initial={{ scale: 1, opacity: 0.28 }}
          animate={innerCtrl}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Central nucleus dot */}
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.018}
          fill="#C5D5DA"
          opacity={0.65}
        />
      </svg>

      {/* Phase label */}
      {!prefersReduced && <PhaseLabel />}
    </div>
  );
}

// ── Phase Label Component ─────────────────────────────────────────────────────

const PHASES = [
  { text: "breathe in", dur: INHALE },
  { text: "hold", dur: HOLD },
  { text: "breathe out", dur: EXHALE },
  { text: "", dur: PAUSE },
];

function PhaseLabel() {
  const ctrl = useAnimation();
  const phaseRef = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    async function cycle() {
      while (alive.current) {
        const phase = PHASES[phaseRef.current % PHASES.length];
        await ctrl.start({
          opacity: phase.text ? 1 : 0,
          transition: { duration: 0.5 },
        });
        await new Promise((r) => setTimeout(r, phase.dur * 1000));
        phaseRef.current++;
      }
    }

    cycle();
    return () => {
      alive.current = false;
      ctrl.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={ctrl}
      className="text-[10px] tracking-[0.28em] uppercase font-light"
      style={{ color: "#5C7A85" }}
      aria-live="polite"
    >
      breathe in · hold · breathe out
    </motion.p>
  );
}
