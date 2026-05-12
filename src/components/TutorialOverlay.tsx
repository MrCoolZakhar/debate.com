'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Committee } from '@/lib/types';

interface Props {
  committee: Committee;
  onEnd: () => void;
}

type StepKind = 'questionnaire' | 'video' | 'spotlight' | 'action';

interface TutorialStep {
  id: string;
  kind: StepKind;
  otterImage: string;
  bubbleText: string;
  spotlightTarget?: string;
  spotlightRadius?: number;
  actionDone?: (c: Committee) => boolean;
}

const STEPS: TutorialStep[] = [
  { id: 'questionnaire', kind: 'questionnaire', otterImage: '/WIP.png', bubbleText: '' },
  { id: 'intro-video',   kind: 'video',         otterImage: '/WIP.png', bubbleText: "Let's start." },

  // Speakers list — bottom bar, then sidebar, then action
  {
    id: 'speakers-bottom-bar', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'speakers-bottom-bar', spotlightRadius: 12,
    bubbleText: "This is where you add delegates to the speakers list. Type any country and press Enter.",
  },
  {
    id: 'speakers-sidebar', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'speakers-sidebar', spotlightRadius: 0,
    bubbleText: "The sidebar shows all your delegates and their roll call status. You can update anyone here at any time.",
  },
  {
    id: 'speakers-action', kind: 'action', otterImage: '/WIP.png',
    spotlightTarget: 'speakers-bottom-bar', spotlightRadius: 12,
    bubbleText: "Your turn — add any 3 countries to the speakers list to continue!",
    actionDone: (c) => c.speakersList.length >= 3,
  },

  // Gate: must call first speaker before showing timer/RTR/add-time
  {
    id: 'call-first-speaker', kind: 'action', otterImage: '/WIP.png',
    spotlightTarget: 'call-first-speaker', spotlightRadius: 14,
    bubbleText: "Now click CALL FIRST SPEAKER to bring the first delegate to the floor!",
    actionDone: (c) => !!c.currentSpeaker,
  },

  // Main page controls (only visible once a speaker is active)
  {
    id: 'timer', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'timer', spotlightRadius: 12,
    bubbleText: "The speaking timer counts down for the current delegate. It turns amber when time is almost up.",
  },
  {
    id: 'add-time', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'add-time-button', spotlightRadius: 12,
    bubbleText: "Need to grant more time? Hit +time. You can also restart the clock from the beginning.",
  },
  {
    id: 'rtr', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'rtr-button', spotlightRadius: 12,
    bubbleText: "Right to Reply lets an accused delegate respond briefly without re-entering the queue. Use it sparingly.",
  },

  // Top bar — one tab at a time
  {
    id: 'tab-rollcall', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'tab-rollcall', spotlightRadius: 6,
    bubbleText: "Roll Call — update delegate attendance at any point during the session.",
  },
  {
    id: 'tab-motions', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'tab-motions', spotlightRadius: 6,
    bubbleText: "Motions — delegates raise procedural motions here. Caucuses, closures, and more all come through this tab.",
  },
  {
    id: 'tab-documents', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'tab-documents', spotlightRadius: 6,
    bubbleText: "Documents — Draft Resolutions and amendments submitted by delegates appear here for your review.",
  },
  {
    id: 'tab-chat', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'tab-chat', spotlightRadius: 6,
    bubbleText: "Chat — send messages to all delegates or DM individuals. Great for notes and announcements.",
  },
  {
    id: 'tab-settings', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'tab-settings', spotlightRadius: 6,
    bubbleText: "Settings — configure voting rules, motion types, speaking times, and access controls for your committee.",
  },

  // Join code
  {
    id: 'join-code', kind: 'spotlight', otterImage: '/WIP.png',
    spotlightTarget: 'join-code', spotlightRadius: 8,
    bubbleText: "Your session code. Delegates enter this at gavelling.com to join your committee in real time. Click it to copy.",
  },
];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useViewport() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

function useSpotlightRect(target?: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(`[data-tutorial="${target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    const id = setInterval(update, 200);
    window.addEventListener('resize', update);
    return () => { clearInterval(id); window.removeEventListener('resize', update); };
  }, [target]);
  return rect;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TutorialOverlay({ committee, onEnd }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewport = useViewport();

  const step = STEPS[stepIdx];
  const spotlightRect = useSpotlightRect(step.spotlightTarget);
  const isAction = step.kind === 'action';

  const advance = useCallback(() => {
    setStepIdx((i) => {
      const next = i + 1;
      if (next >= STEPS.length) { onEnd(); return i; }
      return next;
    });
  }, [onEnd]);

  // Auto-advance action steps
  useEffect(() => {
    if (step.kind !== 'action' || !step.actionDone) return;
    if (step.actionDone(committee)) {
      const t = setTimeout(advance, 700);
      return () => clearTimeout(t);
    }
  }, [committee, step, advance]);

  const { w: vw, h: vh } = viewport;
  const r = step.spotlightRadius ?? 12;

  // Spotlight rect — exact element bounds, zero padding
  const sT = spotlightRect?.top    ?? 0;
  const sL = spotlightRect?.left   ?? 0;
  const sW = spotlightRect?.width  ?? 0;
  const sH = spotlightRect?.height ?? 0;

  // ── Questionnaire ─────────────────────────────────────────────────────────
  if (step.kind === 'questionnaire') {
    return (
      <div className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: 'rgba(27,56,40,0.88)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-[#F6F1E9] rounded-3xl shadow-2xl px-12 py-10 max-w-md w-full text-center flex flex-col items-center gap-6"
          style={{ border: '2px solid rgba(27,56,40,0.2)' }}>
          <img src="/WIP.png" alt="Gavin"
            style={{ width: 220, height: 320, objectFit: 'cover', objectPosition: 'top center', borderRadius: 16 }} />
          <h2 className="text-2xl font-black text-[#1C1410]">Have you used Gavelling before?</h2>
          <p className="text-sm text-[#9A8A78]">Selecting <strong>No</strong> starts a short interactive run-through with Gavin.</p>
          <div className="flex gap-4 w-full">
            <button onClick={onEnd}
              className="flex-1 py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', border: '1.5px solid rgba(27,56,40,0.2)' }}>
              Yes, skip tutorial
            </button>
            <button onClick={advance}
              className="flex-1 py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
              No, show me around
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Intro video ───────────────────────────────────────────────────────────
  if (step.kind === 'video') {
    return (
      <div className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={advance}>
        <EndTutorialBtn onEnd={onEnd} />
        <div className="flex flex-col items-center gap-6 pointer-events-none">
          <div className="rounded-2xl overflow-hidden bg-[#1B3828] relative"
            style={{ width: 340, height: 220, border: '2px solid rgba(238,217,138,0.3)' }}>
            <video ref={videoRef} src="/tutorial/Otter.Intro.mp4" autoPlay playsInline
              onEnded={advance} className="w-full h-full object-cover" />
            <img src="/WIP.png" alt="Gavin" className="absolute inset-0 w-full h-full object-contain" />
          </div>
          <p className="text-white/50 text-xs">Click anywhere to continue</p>
        </div>
      </div>
    );
  }

  // ── Spotlight / Action steps ──────────────────────────────────────────────
  return (
    <>
      {/* ── SVG overlay with pixel-perfect mask hole ── */}
      {vw > 0 && (
        <svg
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 9990, pointerEvents: 'none' }}
          width={vw}
          height={vh}
          viewBox={`0 0 ${vw} ${vh}`}
        >
          <defs>
            <mask id={`tmask-${step.id}`}>
              {/* White = show dark overlay */}
              <rect x={0} y={0} width={vw} height={vh} fill="white" />
              {/* Black = hole — exact element bounds with correct radius */}
              {spotlightRect && (
                <rect x={sL} y={sT} width={sW} height={sH} rx={r} ry={r} fill="black" />
              )}
            </mask>
          </defs>
          <rect
            x={0} y={0} width={vw} height={vh}
            fill="rgba(0,0,0,0.48)"
            mask={`url(#tmask-${step.id})`}
          />
        </svg>
      )}

      {/* ── Click-to-advance catcher (spotlight steps only, not action steps) ── */}
      {!isAction && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9991, cursor: 'pointer' }}
          onClick={advance}
        />
      )}

      {/* ── Gavin — fixed bottom-right portrait, touching bottom ── */}
      <div
        style={{
          position: 'fixed', bottom: 0, right: 32,
          zIndex: 9993, width: 220,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {/* Speech bubble above Gavin */}
        {step.bubbleText && (
          <div style={{ marginBottom: 10, position: 'relative' }}>
            <div style={{
              padding: '12px 16px', borderRadius: 16, fontSize: 13, fontWeight: 500,
              lineHeight: 1.45, color: '#1C1410', textAlign: 'center',
              backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 210,
            }}>
              {step.bubbleText}
            </div>
            {/* Tail */}
            <div style={{
              position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
              width: 14, height: 14,
              backgroundColor: '#FAF8F3',
              borderRight: '1.5px solid rgba(27,56,40,0.18)',
              borderBottom: '1.5px solid rgba(27,56,40,0.18)',
            }} />
          </div>
        )}
        {/* Portrait image — 3× size, touches bottom edge */}
        <img
          src={step.otterImage}
          alt="Gavin"
          style={{ width: 220, height: 330, objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
        />
      </div>

      {/* ── End Tutorial ── */}
      <EndTutorialBtn onEnd={onEnd} />
    </>
  );
}

function EndTutorialBtn({ onEnd }: { onEnd: () => void }) {
  return (
    <button
      onClick={onEnd}
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 9999,
        padding: '8px 16px', borderRadius: 12, fontWeight: 700, fontSize: 13,
        backgroundColor: '#1B3828', color: '#EED98A',
        border: 'none', cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      End Tutorial
    </button>
  );
}
