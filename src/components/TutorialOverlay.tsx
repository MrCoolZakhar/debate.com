'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Committee } from '@/lib/types';

interface Props {
  committee: Committee;
  onEnd: () => void;
}

// ─── Step definitions ──────────────────────────────────────────────────────────

type StepKind = 'questionnaire' | 'video' | 'spotlight' | 'action';

interface TutorialStep {
  id: string;
  kind: StepKind;
  otterImage: string;
  otterSide: 'left' | 'right';     // which side of the spotlight the otter sits
  bubbleText: string;
  spotlightTarget?: string;         // data-tutorial value
  actionDone?: (c: Committee) => boolean;  // for 'action' steps only
}

const STEPS: TutorialStep[] = [
  {
    id: 'questionnaire',
    kind: 'questionnaire',
    otterImage: '/WIP.png',
    otterSide: 'right',
    bubbleText: '',
  },
  {
    id: 'intro-video',
    kind: 'video',
    otterImage: '/WIP.png',
    otterSide: 'right',
    bubbleText: "That's better — let's start.",
  },
  {
    id: 'speakers-add',
    kind: 'action',
    otterImage: '/WIP.png',
    otterSide: 'right',
    spotlightTarget: 'speakers-input',
    bubbleText: "This is the speakers list — the heart of debate. Go ahead and add any 3 countries to get us started!",
    actionDone: (c) => c.speakersList.length >= 3,
  },
  {
    id: 'speakers-done',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    otterSide: 'right',
    spotlightTarget: 'speakers-queue',
    bubbleText: "Great job! You can drag speakers to reorder them, and remove anyone by hovering their row. The delegate at the top speaks next.",
  },
  {
    id: 'timer',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    otterSide: 'left',
    spotlightTarget: 'timer',
    bubbleText: "This is the speaking timer. Hit play to start the clock for the current speaker. It counts down — and turns amber when time is almost up.",
  },
  {
    id: 'timer-controls',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    otterSide: 'left',
    spotlightTarget: 'add-time-button',
    bubbleText: "Need to give a delegate more time? Use the +time button. You can also restart their time entirely.",
  },
  {
    id: 'rtr',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    otterSide: 'left',
    spotlightTarget: 'rtr-button',
    bubbleText: "Right to Reply lets an accused delegate respond briefly without going back to the main queue. Use it sparingly — it's a privilege, not a right.",
  },
  {
    id: 'topbar',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    otterSide: 'right',
    spotlightTarget: 'topbar',
    bubbleText: "Up here you'll find Roll Call (update attendance anytime), Motions (raise or vote on procedural matters), Documents (DRs and amendments), Chat (message delegates), and Settings.",
  },
  {
    id: 'join-code',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    otterSide: 'right',
    spotlightTarget: 'join-code',
    bubbleText: "This is your session code. Delegates go to gavelling.com and enter this to join your committee in real time. Share it at the start of every session.",
  },
];

// ─── Spotlight hook ────────────────────────────────────────────────────────────

function useSpotlightRect(target?: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(`[data-tutorial="${target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [target]);
  return rect;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function TutorialOverlay({ committee, onEnd }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [skipped, setSkipped] = useState(false);   // "Yes I've used Gavelling" was chosen
  const videoRef = useRef<HTMLVideoElement>(null);

  const step = STEPS[stepIdx];
  const spotlightRect = useSpotlightRect(step.spotlightTarget);

  const advance = useCallback(() => {
    setStepIdx((i) => {
      const next = i + 1;
      if (next >= STEPS.length) { onEnd(); return i; }
      return next;
    });
  }, [onEnd]);

  // Auto-advance action step when condition is met
  useEffect(() => {
    if (step.kind !== 'action' || !step.actionDone) return;
    if (step.actionDone(committee)) {
      const t = setTimeout(advance, 800); // brief pause so user sees their action worked
      return () => clearTimeout(t);
    }
  }, [committee, step, advance]);

  if (skipped) return null;

  const PAD = 20; // padding around spotlight rect

  // ── Questionnaire ──────────────────────────────────────────────────────────
  if (step.kind === 'questionnaire') {
    return (
      <div className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: 'rgba(27,56,40,0.85)', backdropFilter: 'blur(4px)' }}>
        <div className="relative bg-[#F6F1E9] rounded-3xl shadow-2xl px-12 py-10 max-w-md w-full text-center flex flex-col items-center gap-6"
          style={{ border: '2px solid rgba(27,56,40,0.2)' }}>
          <img src="/WIP.png" alt="Gavin" className="w-28 h-28 object-contain" />
          <h2 className="text-2xl font-black text-[#1C1410]">Have you used Gavelling before?</h2>
          <p className="text-sm text-[#9A8A78]">Selecting <strong>No</strong> will start a short interactive run-through with Gavin.</p>
          <div className="flex gap-4 w-full">
            <button
              onClick={() => { setSkipped(true); onEnd(); }}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', border: '1.5px solid rgba(27,56,40,0.2)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.14)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(27,56,40,0.08)'; }}
            >
              Yes, skip tutorial
            </button>
            <button
              onClick={advance}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
            >
              No, show me around
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Intro video ─────────────────────────────────────────────────────────────
  if (step.kind === 'video') {
    return (
      <div className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={advance}>
        <EndTutorialBtn onEnd={onEnd} />
        <div className="relative flex flex-col items-center gap-6 max-w-lg w-full">
          {/* Placeholder video — Peter will replace /tutorial/Otter.Intro.mp4 */}
          <div className="w-72 h-48 rounded-2xl overflow-hidden bg-[#1B3828] flex items-center justify-center"
            style={{ border: '2px solid rgba(238,217,138,0.3)' }}>
            <video
              ref={videoRef}
              src="/tutorial/Otter.Intro.mp4"
              autoPlay
              muted={false}
              playsInline
              onEnded={advance}
              className="w-full h-full object-cover"
              onError={() => {
                // Video not yet uploaded — show placeholder otter
              }}
            />
            {/* Fallback if video missing */}
            <img src="/WIP.png" alt="Gavin" className="absolute w-40 h-40 object-contain" />
          </div>
          <SpeechBubble text={step.bubbleText} />
          <p className="text-xs text-white/50">Click anywhere to continue</p>
        </div>
      </div>
    );
  }

  // ── Spotlight / Action steps ────────────────────────────────────────────────

  const isAction = step.kind === 'action';

  // Build 4 surrounding overlay panels (leaves spotlight rect clear for action steps)
  // For pure spotlight steps, full overlay + click-anywhere advances
  const hasCutout = isAction && spotlightRect;
  const { top: sT = 0, left: sL = 0, right: sR = 0, bottom: sB = 0, width: sW = 0, height: sH = 0 } = spotlightRect ?? {};

  // Otter position: to the right or left of the spotlight rect
  const otterTop = spotlightRect ? Math.max(sT + sH / 2 - 80, 20) : window.innerHeight / 2 - 80;
  const otterLeft = step.otterSide === 'right'
    ? (spotlightRect ? sR + PAD + 16 : window.innerWidth / 2 + 120)
    : (spotlightRect ? sL - PAD - 200 : window.innerWidth / 2 - 320);

  const handleOverlayClick = () => {
    if (!isAction) advance();
  };

  return (
    <>
      {/* ── Gray tint overlay ── */}
      {hasCutout ? (
        // 4-panel cutout approach for action steps
        <>
          {/* Top panel */}
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: 0, left: 0, right: 0, height: Math.max(sT - PAD, 0), background: 'rgba(0,0,0,0.42)', cursor: 'default' }} />
          {/* Bottom panel */}
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: sB + PAD, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.42)', cursor: 'default' }} />
          {/* Left panel */}
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: sT - PAD, left: 0, width: Math.max(sL - PAD, 0), height: sH + PAD * 2, background: 'rgba(0,0,0,0.42)', cursor: 'default' }} />
          {/* Right panel */}
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: sT - PAD, left: sR + PAD, right: 0, height: sH + PAD * 2, background: 'rgba(0,0,0,0.42)', cursor: 'default' }} />
          {/* Spotlight border ring */}
          <div className="fixed pointer-events-none z-[9991]"
            style={{ top: sT - PAD, left: sL - PAD, width: sW + PAD * 2, height: sH + PAD * 2,
              borderRadius: 16, boxShadow: '0 0 0 3px rgba(238,217,138,0.7)', transition: 'all 300ms ease' }} />
        </>
      ) : (
        // Full overlay for click-to-advance steps
        <div className="fixed inset-0 z-[9990]"
          style={{ background: 'rgba(0,0,0,0.42)', cursor: 'pointer' }}
          onClick={handleOverlayClick} />
      )}

      {/* ── Spotlight border for non-action steps ── */}
      {!hasCutout && spotlightRect && (
        <div className="fixed pointer-events-none z-[9991]"
          style={{ top: sT - PAD, left: sL - PAD, width: sW + PAD * 2, height: sH + PAD * 2,
            borderRadius: 16, boxShadow: '0 0 0 3px rgba(238,217,138,0.7)', background: 'rgba(238,217,138,0.04)', transition: 'all 300ms ease' }} />
      )}

      {/* ── Otter + Speech bubble ── */}
      <div className="fixed z-[9993] flex flex-col items-center gap-3 pointer-events-none"
        style={{ top: otterTop, left: Math.min(Math.max(otterLeft, 12), window.innerWidth - 220), maxWidth: 200 }}>
        <SpeechBubble text={step.bubbleText} />
        <img src={step.otterImage} alt="Gavin" className="w-28 h-28 object-contain drop-shadow-xl" />
        {!isAction && (
          <p className="text-white/60 text-xs text-center">Click anywhere to continue</p>
        )}
      </div>

      {/* ── End Tutorial button ── */}
      <EndTutorialBtn onEnd={onEnd} />
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SpeechBubble({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="relative px-4 py-3 rounded-2xl text-sm font-medium leading-snug text-[#1C1410] max-w-[200px] text-center shadow-lg"
      style={{ backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)' }}>
      {text}
      {/* Tail */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
        style={{ backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)', borderTop: 'none', borderLeft: 'none' }} />
    </div>
  );
}

function EndTutorialBtn({ onEnd }: { onEnd: () => void }) {
  return (
    <button
      onClick={onEnd}
      className="fixed top-4 right-4 z-[9999] px-4 py-2 rounded-xl font-bold text-sm transition-all"
      style={{ backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 4px 14px rgba(0,0,0,0.25)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      End Tutorial
    </button>
  );
}
