'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Committee } from '@/lib/types';

interface Props {
  committee: Committee;
  onEnd: () => void;
}

// ─── Step definitions ────────────────────────────────────────────────────────

type StepKind = 'questionnaire' | 'video' | 'spotlight' | 'action';

interface TutorialStep {
  id: string;
  kind: StepKind;
  otterImage: string;
  bubbleText: string;
  spotlightTarget?: string;       // matches data-tutorial="X"
  spotlightRadius?: number;       // border-radius of spotlight ring in px
  actionDone?: (c: Committee) => boolean;
}

const STEPS: TutorialStep[] = [
  {
    id: 'questionnaire',
    kind: 'questionnaire',
    otterImage: '/WIP.png',
    bubbleText: '',
  },
  {
    id: 'intro-video',
    kind: 'video',
    otterImage: '/WIP.png',
    bubbleText: "Let's start.",
  },
  // Speakers — bottom bar first, then sidebar, then action
  {
    id: 'speakers-bottom-bar',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'speakers-bottom-bar',
    spotlightRadius: 12,
    bubbleText: "This bar is how you add delegates to the speakers list. Type any country name and press Enter.",
  },
  {
    id: 'speakers-sidebar',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'speakers-sidebar',
    spotlightRadius: 0,
    bubbleText: "This sidebar shows all your delegates and their attendance. You can update statuses here anytime.",
  },
  {
    id: 'speakers-action',
    kind: 'action',
    otterImage: '/WIP.png',
    spotlightTarget: 'speakers-bottom-bar',
    spotlightRadius: 12,
    bubbleText: "Your turn! Add any 3 countries to the speakers list to continue.",
    actionDone: (c) => c.speakersList.length >= 3,
  },
  {
    id: 'speakers-congrats',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'speakers-queue',
    spotlightRadius: 12,
    bubbleText: "Great job! You can drag speakers to reorder them, and hover any row to remove a delegate.",
  },
  // Main page features
  {
    id: 'timer',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'timer',
    spotlightRadius: 12,
    bubbleText: "The speaking timer. Press play to start counting down for the current speaker. It turns amber when time runs low.",
  },
  {
    id: 'add-time',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'add-time-button',
    spotlightRadius: 12,
    bubbleText: "Need to give a delegate more time? Use +time. You can also restart the clock entirely.",
  },
  {
    id: 'rtr',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'rtr-button',
    spotlightRadius: 12,
    bubbleText: "Right to Reply lets an accused delegate respond briefly without re-entering the queue. Use it sparingly.",
  },
  // Top bar
  {
    id: 'topbar',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'topbar',
    spotlightRadius: 0,
    bubbleText: "Up here: Roll Call, Motions, Documents, Chat, and Settings. Everything you need to run the room.",
  },
  // Join code
  {
    id: 'join-code',
    kind: 'spotlight',
    otterImage: '/WIP.png',
    spotlightTarget: 'join-code',
    spotlightRadius: 12,
    bubbleText: "Your session code. Delegates go to gavelling.com and enter this to join your committee in real time.",
  },
];

// ─── Spotlight hook ──────────────────────────────────────────────────────────

function useSpotlightRect(target?: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(`[data-tutorial="${target}"]`);
      if (el) setRect(el.getBoundingClientRect());
      else setRect(null);
    };
    update();
    const id = setInterval(update, 300); // re-measure as layout settles
    window.addEventListener('resize', update);
    return () => { clearInterval(id); window.removeEventListener('resize', update); };
  }, [target]);
  return rect;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function TutorialOverlay({ committee, onEnd }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
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

  // Auto-advance action step when condition met
  useEffect(() => {
    if (step.kind !== 'action' || !step.actionDone) return;
    if (step.actionDone(committee)) {
      const t = setTimeout(advance, 700);
      return () => clearTimeout(t);
    }
  }, [committee, step, advance]);

  // ── Questionnaire ──────────────────────────────────────────────────────────
  if (step.kind === 'questionnaire') {
    return (
      <div className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: 'rgba(27,56,40,0.88)', backdropFilter: 'blur(4px)' }}>
        <div className="relative bg-[#F6F1E9] rounded-3xl shadow-2xl px-12 py-10 max-w-md w-full text-center flex flex-col items-center gap-6"
          style={{ border: '2px solid rgba(27,56,40,0.2)' }}>
          <img src="/WIP.png" alt="Gavin" style={{ width: 220, height: 320, objectFit: 'cover', objectPosition: 'top center' }} className="rounded-2xl" />
          <h2 className="text-2xl font-black text-[#1C1410]">Have you used Gavelling before?</h2>
          <p className="text-sm text-[#9A8A78]">Selecting <strong>No</strong> will start a short interactive run-through with Gavin.</p>
          <div className="flex gap-4 w-full">
            <button
              onClick={onEnd}
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

  // ── Intro video ────────────────────────────────────────────────────────────
  if (step.kind === 'video') {
    return (
      <div className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={advance}>
        <EndTutorialBtn onEnd={onEnd} />
        <div className="flex flex-col items-center gap-6 pointer-events-none">
          <div className="rounded-2xl overflow-hidden bg-[#1B3828] relative flex items-center justify-center"
            style={{ width: 340, height: 220, border: '2px solid rgba(238,217,138,0.3)' }}>
            <video
              ref={videoRef}
              src="/tutorial/Otter.Intro.mp4"
              autoPlay
              playsInline
              onEnded={advance}
              className="w-full h-full object-cover"
            />
            {/* Fallback when video not yet uploaded */}
            <img src="/WIP.png" alt="Gavin" className="absolute inset-0 w-full h-full object-contain" />
          </div>
          <p className="text-white/50 text-xs">Click anywhere to continue</p>
        </div>
      </div>
    );
  }

  // ── Spotlight / Action steps ───────────────────────────────────────────────
  const PAD = 4; // tight — matches the element exactly
  const radius = step.spotlightRadius ?? 12;
  const isAction = step.kind === 'action';

  const sT = spotlightRect?.top ?? 0;
  const sL = spotlightRect?.left ?? 0;
  const sR = spotlightRect?.right ?? 0;
  const sB = spotlightRect?.bottom ?? 0;
  const sW = spotlightRect?.width ?? 0;
  const sH = spotlightRect?.height ?? 0;

  const hasCutout = isAction && !!spotlightRect;
  const handleOverlayClick = () => { if (!isAction) advance(); };

  return (
    <>
      {/* ── Overlay ── */}
      {hasCutout ? (
        // 4-panel cutout for action steps — leaves spotlight area interactive
        <>
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: 0, left: 0, right: 0, height: Math.max(sT - PAD, 0), background: 'rgba(0,0,0,0.45)' }} />
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: sB + PAD, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: sT - PAD, left: 0, width: Math.max(sL - PAD, 0), height: sH + PAD * 2, background: 'rgba(0,0,0,0.45)' }} />
          <div className="fixed z-[9990]" onClick={handleOverlayClick}
            style={{ top: sT - PAD, left: sR + PAD, right: 0, height: sH + PAD * 2, background: 'rgba(0,0,0,0.45)' }} />
        </>
      ) : (
        <div className="fixed inset-0 z-[9990]"
          style={{ background: 'rgba(0,0,0,0.45)', cursor: isAction ? 'default' : 'pointer' }}
          onClick={handleOverlayClick} />
      )}

      {/* ── Spotlight ring ── */}
      {spotlightRect && (
        <div className="fixed pointer-events-none z-[9991] transition-all duration-300"
          style={{
            top: sT - PAD,
            left: sL - PAD,
            width: sW + PAD * 2,
            height: sH + PAD * 2,
            borderRadius: radius,
            boxShadow: '0 0 0 3px rgba(238,217,138,0.8), 0 0 24px rgba(238,217,138,0.2)',
          }} />
      )}

      {/* ── Gavin — fixed bottom-right portrait, touching the bottom ── */}
      <div className="fixed bottom-0 right-8 z-[9993] flex flex-col items-center pointer-events-none"
        style={{ width: 220 }}>
        {/* Speech bubble above Gavin */}
        {step.bubbleText && (
          <div className="mb-3 relative">
            <div className="px-4 py-3 rounded-2xl text-sm font-medium leading-snug text-[#1C1410] text-center shadow-xl"
              style={{ backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)', maxWidth: 210 }}>
              {step.bubbleText}
            </div>
            {/* Bubble tail pointing down */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
              style={{ backgroundColor: '#FAF8F3', borderRight: '1.5px solid rgba(27,56,40,0.18)', borderBottom: '1.5px solid rgba(27,56,40,0.18)' }} />
          </div>
        )}
        {/* Gavin portrait — 3× size, touching bottom edge */}
        <img
          src={step.otterImage}
          alt="Gavin"
          style={{ width: 220, height: 330, objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
        />
        {/* Click-to-advance hint for spotlight steps */}
        {!isAction && step.kind === 'spotlight' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/40 text-[10px] whitespace-nowrap">
            click anywhere to continue
          </div>
        )}
      </div>

      {/* ── End Tutorial button ── */}
      <EndTutorialBtn onEnd={onEnd} />
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EndTutorialBtn({ onEnd }: { onEnd: () => void }) {
  return (
    <button
      onClick={onEnd}
      className="fixed top-4 right-4 z-[9999] px-4 py-2 rounded-xl font-bold text-sm transition-all"
      style={{ backgroundColor: '#1B3828', color: '#EED98A', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      End Tutorial
    </button>
  );
}
