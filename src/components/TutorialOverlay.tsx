'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Committee } from '@/lib/types';

interface Props {
  committee: Committee;
  onEnd: () => void;
}

type StepKind = 'questionnaire' | 'spotlight' | 'action';

interface TutorialStep {
  id: string;
  kind: StepKind;
  otterImage: string;
  bubbleText: string;
  // Array of data-tutorial values — all light up simultaneously
  spotlightTargets?: string[];
  spotlightRadius?: number;
  // Committee-state condition to auto-advance
  actionDone?: (c: Committee) => boolean;
  // DOM-attribute condition to auto-advance (for non-committee state)
  domActionDone?: () => boolean;
}

const STEPS: TutorialStep[] = [
  {
    id: 'questionnaire', kind: 'questionnaire',
    otterImage: '/Otter.Tutorial.png', bubbleText: '',
  },
  {
    id: 'welcome', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: [],   // no hole — full overlay, click anywhere to advance
    bubbleText: "Welcome to your committee room. Speakers, timers, voting, motions, chat, documents — everything bundled in one place, built to run your entire MUN session from the first gavel to the last. Let's walk through it together.",
  },
  // Speakers list — bottom bar first
  {
    id: 'speakers-bottom-bar', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['speakers-bottom-bar'], spotlightRadius: 12,
    bubbleText: "This input bar adds delegates to the speakers list. Type any country name and press Enter.",
  },
  // Sidebar — spotlight just the A-Z/QUEUE toggle, action to switch to queue view
  {
    id: 'sidebar-view-toggle', kind: 'action',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['sidebar-view-toggle'], spotlightRadius: 99,
    bubbleText: "The sidebar has two views: A-Z and QUEUE. Switch to QUEUE to see the speaking order.",
    domActionDone: () => {
      const el = document.querySelector('[data-tutorial="sidebar-view-toggle"]');
      return el?.getAttribute('data-current-view') === 'queue';
    },
  },
  // Add 3 speakers — both bottom bar and sidebar light up; autocomplete auto-joins when typing
  {
    id: 'speakers-action', kind: 'action',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['speakers-bottom-bar', 'speakers-sidebar', 'speakers-autocomplete'],
    spotlightRadius: 12,
    bubbleText: "Add any 3 countries to the speakers list — use the input bar below or click delegates in the sidebar.",
    actionDone: (c) => c.speakersList.length >= 3,
  },
  // Must call first speaker before RTR and add-time are visible
  {
    id: 'call-first-speaker', kind: 'action',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['call-first-speaker'], spotlightRadius: 14,
    bubbleText: "Click CALL FIRST SPEAKER to bring the first delegate to the floor!",
    actionDone: (c) => !!c.currentSpeaker,
  },
  // Timer and controls (only visible once a speaker is active)
  {
    id: 'timer', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['timer'], spotlightRadius: 12,
    bubbleText: "The speaking timer counts down for the current delegate. It turns amber when time runs low.",
  },
  {
    id: 'add-time', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['add-time-button'], spotlightRadius: 12,
    bubbleText: "Grant more time with +time, or restart the clock from the beginning.",
  },
  {
    id: 'rtr', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['rtr-button'], spotlightRadius: 12,
    bubbleText: "Right to Reply lets an accused delegate respond briefly without re-entering the queue.",
  },
  // Top bar — one tab at a time
  {
    id: 'tab-rollcall', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['tab-rollcall'], spotlightRadius: 6,
    bubbleText: "Roll Call — update delegate attendance at any point during the session.",
  },
  {
    id: 'tab-motions', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['tab-motions'], spotlightRadius: 6,
    bubbleText: "Motions — caucuses, closure of debate, and procedural votes all flow through here.",
  },
  {
    id: 'tab-documents', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['tab-documents'], spotlightRadius: 6,
    bubbleText: "Documents — Draft Resolutions and amendments submitted by delegates appear here for your review.",
  },
  {
    id: 'tab-chat', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['tab-chat'], spotlightRadius: 6,
    bubbleText: "Chat — message all delegates at once or DM individuals. Great for announcements.",
  },
  {
    id: 'tab-settings', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['tab-settings'], spotlightRadius: 6,
    bubbleText: "Settings — voting rules, motion types, speaking times, and access controls for your committee.",
  },
  // Join code
  {
    id: 'join-code', kind: 'spotlight',
    otterImage: '/Otter.Tutorial.png',
    spotlightTargets: ['join-code'], spotlightRadius: 8,
    bubbleText: "Your session code. Delegates enter this at gavelling.com to join in real time. Click it to copy.",
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

// Returns an array of rects (one per target, null if element not found)
function useSpotlightRects(targets: string[] = []) {
  const [rects, setRects] = useState<(DOMRect | null)[]>([]);
  useEffect(() => {
    if (!targets.length) { setRects([]); return; }
    const update = () => {
      setRects(targets.map(t => {
        const el = document.querySelector(`[data-tutorial="${t}"]`);
        return el ? el.getBoundingClientRect() : null;
      }));
    };
    update();
    const id = setInterval(update, 200);
    window.addEventListener('resize', update);
    return () => { clearInterval(id); window.removeEventListener('resize', update); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.join(',')]);
  return rects;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TutorialOverlay({ committee, onEnd }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const { w: vw, h: vh } = useViewport();

  const step = STEPS[stepIdx];
  const spotlightRects = useSpotlightRects(step.spotlightTargets);
  const isAction = step.kind === 'action';

  const advance = useCallback(() => {
    setStepIdx(i => {
      const next = i + 1;
      if (next >= STEPS.length) { onEnd(); return i; }
      return next;
    });
  }, [onEnd]);

  // Poll action conditions every 200ms (covers both committee-state and DOM-state checks)
  useEffect(() => {
    if (step.kind !== 'action') return;
    const check = () => {
      const stateOk = step.actionDone ? step.actionDone(committee) : true;
      const domOk   = step.domActionDone ? step.domActionDone() : true;
      if (stateOk && domOk) advance();
    };
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, [committee, step, advance]);

  const r = step.spotlightRadius ?? 12;

  // ── Questionnaire ─────────────────────────────────────────────────────────
  if (step.kind === 'questionnaire') {
    return (
      <div className="fixed inset-0 z-[9990] flex items-center justify-center"
        style={{ background: 'rgba(27,56,40,0.88)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-[#F6F1E9] rounded-3xl shadow-2xl px-12 py-10 max-w-md w-full text-center flex flex-col items-center gap-6"
          style={{ border: '2px solid rgba(27,56,40,0.2)' }}>
          <img src="/Otter.Tutorial.png" alt="Gavin"
            style={{ width: 220, height: 320, objectFit: 'contain', objectPosition: 'center', borderRadius: 0 }} />
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

  // ── Spotlight / Action steps ──────────────────────────────────────────────
  return (
    <>
      {/* SVG mask — one hole per spotlight target */}
      {vw > 0 && (
        <svg
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 9990, pointerEvents: 'none' }}
          width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`}
        >
          <defs>
            <mask id={`tmask-${step.id}`}>
              <rect x={0} y={0} width={vw} height={vh} fill="white" />
              {spotlightRects.map((rect, i) =>
                rect ? (
                  <rect
                    key={i}
                    x={rect.left} y={rect.top}
                    width={rect.width} height={rect.height}
                    rx={r} ry={r}
                    fill="black"
                  />
                ) : null
              )}
            </mask>
          </defs>
          <rect x={0} y={0} width={vw} height={vh}
            fill="rgba(0,0,0,0.48)"
            mask={`url(#tmask-${step.id})`} />
        </svg>
      )}

      {/* Click-to-advance catcher — spotlight steps only */}
      {!isAction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9991, cursor: 'pointer' }}
          onClick={advance} />
      )}

      {/* End Tutorial — fixed, just below the h-11 (44px) top navbar */}
      <EndTutorialBtn onEnd={onEnd} />

      {/* Gavin — fixed bottom-right, portrait touching bottom */}
      {/*
        PNG is 2000×2000 with 528px transparent top.
        Rendered at 440×440 (fit-to-width) inside the 660px box, bottom-anchored:
          - rendered image occupies container y[220..660] (from top)
          - transparent top within rendered image: 528/2000 × 440 ≈ 116px
          - first actual otter pixel: 220+116 = 336px from container top
            = 660−336 = 324px from container bottom
        Bubble bottom is set to 334px → lands ~10px above the first otter pixel.
      */}
      <div style={{
        position: 'fixed', bottom: 0, right: -20, zIndex: 9993,
        width: 440, height: 660,
        pointerEvents: 'none',
      }}>
        {/* Portrait image — fills the container, content anchored to bottom */}
        <img
          src={step.otterImage} alt="Gavin"
          style={{
            position: 'absolute', bottom: 0, left: 0,
            width: 440, height: 660,
            objectFit: 'contain', objectPosition: 'bottom center',
            display: 'block',
          }}
        />

        {/* Speech bubble — pinned just above first otter pixel */}
        {step.bubbleText && (
          <div style={{
            position: 'absolute', bottom: 334, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{
              padding: '14px 20px', borderRadius: 16, fontSize: 14, fontWeight: 500,
              lineHeight: 1.45, color: '#1C1410', textAlign: 'center',
              backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 380,
            }}>
              {step.bubbleText}
            </div>
            {/* Bubble tail pointing down toward otter */}
            <div style={{
              width: 14, height: 14, marginTop: -1,
              backgroundColor: '#FAF8F3',
              borderRight: '1.5px solid rgba(27,56,40,0.18)',
              borderBottom: '1.5px solid rgba(27,56,40,0.18)',
              transform: 'rotate(45deg)',
            }} />
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EndTutorialBtn({ onEnd }: { onEnd: () => void }) {
  return (
    <button
      onClick={onEnd}
      style={{
        position: 'fixed', top: 52, right: 16, zIndex: 9999,
        padding: '7px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13,
        backgroundColor: '#1B3828', color: '#EED98A',
        border: 'none', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      End Tutorial
    </button>
  );
}
