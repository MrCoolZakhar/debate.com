'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Committee } from '@/lib/types';
import { useT, useLanguage } from '@/contexts/LanguageContext';

interface Props {
  committee: Committee;
  onEnd: () => void;
  onStepId?: (id: string) => void;
}

type StepKind = 'questionnaire' | 'spotlight' | 'action' | 'goodbye';

interface TutorialStep {
  id: string;
  kind: StepKind;
  otterImage: string;
  bubbleText: React.ReactNode;
  // Array of data-tutorial values — all light up simultaneously
  spotlightTargets?: string[];
  spotlightRadius?: number;
  // Committee-state condition to auto-advance
  actionDone?: (c: Committee) => boolean;
  // DOM-attribute condition to auto-advance (for non-committee state)
  domActionDone?: () => boolean;
}

// ─── Rich text helpers ────────────────────────────────────────────────────────
const G  = (t: string) => <span style={{ color: '#B6871F', fontWeight: 700 }}>{t}</span>; // gold
const GR = (t: string) => <span style={{ color: '#2A5A3C', fontWeight: 700 }}>{t}</span>; // green

function getSteps(language: string): TutorialStep[] {
  return [
    {
      id: 'questionnaire', kind: 'questionnaire',
      otterImage: '/Otter.Tutorial.Intro.webp', bubbleText: '',
    },
    {
      id: 'welcome', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: [],
      bubbleText: language === 'fr'
        ? <>Bienvenue dans votre <strong>salle de comité</strong>. {GR('Orateurs')}, {GR('chronomètres')}, {GR('votes')}, {GR('motions')}, {GR('chat')}, {GR('documents')} — tout en un seul endroit, conçu pour gérer votre <strong>session MUN complète</strong> du premier coup de maillet au dernier.</>
        : language === 'es'
        ? <>Bienvenido a tu <strong>sala de comité</strong>. {GR('Oradores')}, {GR('cronómetros')}, {GR('votos')}, {GR('mociones')}, {GR('chat')}, {GR('documentos')} — todo en un solo lugar para dirigir tu <strong>sesión completa de MUN</strong>.</>
        : <>Welcome to your <strong>committee room</strong>. {GR('Speakers')}, {GR('timers')}, {GR('voting')}, {GR('motions')}, {GR('chat')}, {GR('documents')} — all bundled in one place, built to run your <strong>entire MUN session</strong> from the first gavel to the last.</>,
    },
    {
      id: 'speakers-bottom-bar', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['speakers-bottom-bar'], spotlightRadius: 12,
      bubbleText: language === 'fr'
        ? <>Cette barre vous permet d&apos;<strong>ajouter des délégués</strong> à la liste des orateurs. Tapez n&apos;importe quel {G('nom de pays')} et appuyez sur {G('Entrée')}.</>
        : language === 'es'
        ? <>Esta barra sirve para <strong>agregar delegados</strong> a la lista de oradores. Escribe cualquier {G('nombre de país')} y presiona {G('Enter')}.</>
        : <>This bar is how you <strong>add delegates</strong> to the speakers list. Type any {G('country name')} and press {G('Enter')}.</>,
    },
    {
      id: 'sidebar-view-toggle', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['sidebar-view-toggle'], spotlightRadius: 99,
      bubbleText: language === 'fr'
        ? <>Le panneau latéral a deux vues — {G('A-Z')} et {G('LISTE')}. Passez sur <strong>LISTE</strong> pour voir l&apos;ordre des orateurs.</>
        : language === 'es'
        ? <>El panel lateral tiene dos opciones — {G('A-Z')} y {G('FILA')}. Cambia a <strong>FILA</strong> para ver el orden de oradores.</>
        : <>The sidebar has two views — {G('A-Z')} and {G('QUEUE')}. Switch to <strong>QUEUE</strong> to see the speaking order.</>,
      domActionDone: () => {
        const el = document.querySelector('[data-tutorial="sidebar-view-toggle"]');
        return el?.getAttribute('data-current-view') === 'queue';
      },
    },
    {
      id: 'speakers-action', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['speakers-bottom-bar', 'speakers-sidebar', 'speakers-autocomplete'],
      spotlightRadius: 12,
      bubbleText: language === 'fr'
        ? <>Ajoutez <strong>3 pays</strong> à la liste — utilisez la {G('barre de recherche')} ou cliquez sur des délégués dans le {G('panneau latéral')}. Les deux fonctionnent !</>
        : language === 'es'
        ? <>Agrega <strong>3 países</strong> a la lista — usa la {G('barra de búsqueda')} o haz clic en delegados del {G('panel lateral')}. ¡Ambos funcionan!</>
        : <>Add <strong>any 3 countries</strong> to the speakers list — use the {G('input bar')} below or click delegates in the {G('sidebar')}. Both work!</>,
      actionDone: (c) => c.speakersList.length >= 3,
    },
    {
      id: 'call-first-speaker', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['call-first-speaker'], spotlightRadius: 14,
      bubbleText: language === 'fr'
        ? <>Cliquez maintenant sur <strong>APPELER LE PREMIER ORATEUR</strong> pour donner la parole au {G('premier délégué')} !</>
        : language === 'es'
        ? <>Ahora haz clic en <strong>LLAMAR PRIMER ORADOR</strong> para llamar al {G('primer delegado')} al piso.</>
        : <>Now click <strong>CALL FIRST SPEAKER</strong> to bring the {G('first delegate')} to the floor!</>,
      actionDone: (c) => !!c.currentSpeaker,
    },
    {
      id: 'timer', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['timer'], spotlightRadius: 12,
      bubbleText: language === 'fr'
        ? <>Le <strong>chronomètre</strong> décompte pour le délégué actuel. Il devient {G('ambré')} quand le temps est presque écoulé.</>
        : language === 'es'
        ? <>El <strong>cronómetro</strong> cuenta regresivamente para el delegado actual. Se vuelve {G('ámbar')} cuando el tiempo se acaba.</>
        : <>The <strong>speaking timer</strong> counts down for the current delegate. Turns {G('amber')} when time runs low.</>,
    },
    {
      id: 'add-time', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['add-time-button'], spotlightRadius: 12,
      bubbleText: language === 'fr'
        ? <>Besoin d&apos;accorder plus de temps ? Appuyez sur {G('+temps')}. Vous pouvez aussi <strong>réinitialiser le chronomètre</strong> complètement.</>
        : language === 'es'
        ? <>¿Necesitas dar más tiempo? Presiona {G('+tiempo')}. También puedes <strong>reiniciar el cronómetro</strong> completamente.</>
        : <>Need to grant more time? Hit {G('+time')}. You can also <strong>restart the clock</strong> entirely.</>,
    },
    {
      id: 'rtr', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['rtr-button'], spotlightRadius: 12,
      bubbleText: language === 'fr'
        ? <>{GR('Droit de Réponse')} permet à un délégué de répondre brièvement <strong>sans reprendre sa place en liste</strong>. À utiliser avec modération.</>
        : language === 'es'
        ? <>{GR('Derecho a Réplica')} permite que un delegado responda brevemente <strong>sin volver a la fila</strong>. Úsalo con moderación.</>
        : <>{GR('Right to Reply')} lets an accused delegate respond briefly <strong>without re-entering the queue</strong>. Use it sparingly.</>,
    },
    {
      id: 'tab-rollcall', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-rollcall'], spotlightRadius: 6,
      bubbleText: language === 'fr'
        ? <>{G('Appel')} — cliquer ici pour marquer chaque délégué comme <strong>Absent</strong>, <strong>Présent</strong> ou <strong>Présent et Votant</strong>. Mettre à jour l&apos;assiduité à tout moment pendant la session.</>
        : language === 'es'
        ? <>{G('Lista de Asistencia')} — marca a cada delegado como <strong>Ausente</strong>, <strong>Presente</strong> o <strong>Presente y Votante</strong>. Puedes actualizar la asistencia en cualquier momento.</>
        : <>{G('Roll Call')} — click here to mark each delegate as <strong>Absent</strong>, <strong>Present</strong>, or <strong>Present & Voting</strong>. You can update attendance at any point during the session.</>,
    },
    {
      id: 'tab-motions', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-motions'], spotlightRadius: 6,
      bubbleText: language === 'fr'
        ? <>{G('Motions')} — les délégués proposent ici un <strong>Caucus modéré</strong>, un <strong>Caucus non modéré</strong>, un <strong>Tour de table</strong> et une <strong>Consultation de l&apos;assemblée</strong>. Vous pouvez aussi <strong>clôturer</strong> ou <strong>suspendre le débat</strong> depuis cet onglet.</>
        : language === 'es'
        ? <>{G('Mociones')} — los delegados levantan <strong>Cáucus Moderado</strong>, <strong>Cáucus No Moderado</strong>, <strong>Round Robin</strong> y <strong>Consulta de Gabinete</strong>. También puedes <strong>cerrar</strong> o <strong>suspender el debate</strong>.</>
        : <>{G('Motions')} — delegates raise <strong>Moderated Caucus</strong>, <strong>Unmoderated Caucus</strong>, <strong>Tour de Table</strong>, and <strong>Consultation of the Whole</strong> here. You can also <strong>close</strong> or <strong>suspend debate</strong> from this tab.</>,
    },
    {
      id: 'tab-documents', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-documents'], spotlightRadius: 6,
      bubbleText: language === 'fr'
        ? <>{G('Documents')} — les <strong>Documents de travail</strong> et <strong>Projets de résolution</strong> soumis par les délégués apparaissent ici. Une fois approuvés, les délégués obtiennent une page dédiée de {GR('Lecture')}, {GR('Présentation')} et {GR('Q&R')}.</>
        : language === 'es'
        ? <>{G('Documentos')} — las <strong>Hojas de Trabajo</strong> y <strong>Proyectos de Resolución</strong> aparecen aquí. Una vez aprobados, los delegados tienen páginas de {GR('Lectura')}, {GR('Presentación')} y {GR('Preguntas')}.</>
        : <>{G('Documents')} — <strong>Working Papers</strong> and <strong>Draft Resolutions</strong> submitted by delegates appear here. Once approved, delegates get a dedicated {GR('Reading')}, {GR('Presentation')}, and {GR('Q&A')} page.</>,
    },
    {
      id: 'tab-chat', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-chat'], spotlightRadius: 6,
      bubbleText: language === 'fr'
        ? <>{G('Chat')} — envoyez un message à <strong>tous les délégués</strong> ou des messages privés individuels. Nous recommandons de le garder ouvert sur votre <strong>appareil personnel</strong> plutôt que sur l&apos;écran principal du comité.</>
        : language === 'es'
        ? <>{G('Chat')} — envía mensajes a <strong>todos los delegados</strong> o DM individuales. Recomendamos tenerlo abierto en tu <strong>dispositivo personal</strong>.</>
        : <>{G('Chat')} — message <strong>all delegates</strong> at once or DM individuals. We recommend keeping this open on your <strong>personal device</strong> rather than the main committee screen.</>,
    },
    {
      id: 'tab-settings', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-settings'], spotlightRadius: 6,
      bubbleText: language === 'fr'
        ? <>{G('Paramètres')} — configurez les <strong>règles de vote</strong>, les types de motions, les temps de parole et les contrôles d&apos;accès.</>
        : language === 'es'
        ? <>{G('Configuración')} — configura <strong>reglas de votación</strong>, tipos de mociones, tiempos de habla y controles de acceso.</>
        : <>{G('Settings')} — configure <strong>voting rules</strong>, motion types, speaking times, and access controls.</>,
    },
    {
      id: 'join-code', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['join-code'], spotlightRadius: 8,
      bubbleText: language === 'fr'
        ? <>Votre <strong>code de session</strong>. Les délégués l&apos;entrent sur {G('gavelling.com')} pour rejoindre en temps réel. {GR('Cliquez pour copier')}.</>
        : language === 'es'
        ? <>Tu <strong>código de sesión</strong>. Los delegados lo ingresan en {G('gavelling.com')} para unirse en tiempo real. {GR('Haz clic para copiar')}.</>
        : <>Your <strong>session code</strong>. Delegates enter this at {G('gavelling.com')} to join in real time. {GR('Click to copy')}.</>,
    },
    {
      id: 'goodbye', kind: 'goodbye',
      otterImage: '/Otter.Tutorial.Outro.webp',
      bubbleText: language === 'fr'
        ? <>Amusez-vous à explorer ! Et donnez-nous toujours votre {G('avis')} — c&apos;est comme ça que Gavelling s&apos;améliore. Écrivez-nous sur IG {GR('@wearegavelling')} à tout moment 🎉</>
        : language === 'es'
        ? <>¡Diviértete explorando! Y siempre {G('danos tu opinión')} — así mejora Gavelling. Escríbenos en IG {GR('@wearegavelling')} cuando quieras 🎉</>
        : <>Have fun exploring! And always {G('give us feedback')} — it&apos;s how Gavelling gets better. Text us on IG {GR('@wearegavelling')} any time 🎉</>,
    },
  ];
}

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

export default function TutorialOverlay({ committee, onEnd, onStepId }: Props) {
  const t = useT();
  const { language } = useLanguage();
  const STEPS = useMemo(() => getSteps(language), [language]);
  const [stepIdx, setStepIdx] = useState(0);
  const { w: vw, h: vh } = useViewport();

  const step = STEPS[stepIdx];
  const spotlightRects = useSpotlightRects(step.spotlightTargets);
  const isAction = step.kind === 'action';

  // Inject pulse animation once
  useEffect(() => {
    const id = 'tutorial-pulse-style';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes tutorial-pulse {
          0%, 100% { box-shadow: 0 0 0 2px #EED98A, 0 0 8px rgba(238,217,138,0.25); }
          50%       { box-shadow: 0 0 0 4px rgba(238,217,138,0.6), 0 0 20px rgba(238,217,138,0.35); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Preload all otter images on mount so they never flash when a step arrives
  useEffect(() => {
    const srcs = [...new Set(STEPS.map(s => s.otterImage))];
    srcs.forEach(src => { const img = new window.Image(); img.src = src; });
  }, []);

  const advance = useCallback(() => {
    setStepIdx(i => {
      const next = i + 1;
      if (next >= STEPS.length) { onEnd(); return i; }
      return next;
    });
  }, [onEnd]);

  // Notify parent whenever step.id changes.
  // Use a ref so the effect ONLY fires on step changes — not every time the
  // parent re-renders and passes a new inline function reference (which would
  // continuously reset the toggle view during the timer's per-second re-renders).
  const onStepIdRef = useRef(onStepId);
  onStepIdRef.current = onStepId;
  useEffect(() => { onStepIdRef.current?.(step.id); }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <img src="/Otter.Tutorial.Intro.webp" alt="Gavin"
            style={{ width: 260, height: 260, objectFit: 'cover', objectPosition: 'center', borderRadius: 0 }} />
          <h2 className="text-3xl font-black text-[#1C1410] tracking-tight">{t('tutorial_have_you_used')}</h2>
          <p className="text-sm text-[#9A8A78]">{t('tutorial_gavin_prepared')}</p>
          <div className="flex gap-4 w-full">
            <button onClick={advance}
              className="flex-1 py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
              {t('tutorial_show_me')}
            </button>
            <button onClick={onEnd}
              className="flex-1 py-3 rounded-xl font-bold text-sm"
              style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828', border: '1.5px solid rgba(27,56,40,0.2)' }}>
              {t('tutorial_skip')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Goodbye slide ─────────────────────────────────────────────────────────
  if (step.kind === 'goodbye') {
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(3px)', cursor: 'pointer' }}
        onClick={onEnd}
      >
        {/*
          Outro PNG: 2000×2000, 475px transparent top.
          Rendered at 440×440 (fit-to-width) inside 660px box, bottom-anchored:
            - transparent top within rendered area: 475/2000 × 440 ≈ 105px
            - otter head from bottom: 440 − 105 = 335px
          Container uses absolute layout matching main tutorial Gavin.
        */}
        <div style={{
          position: 'fixed', bottom: 0, right: -20, zIndex: 9993,
          width: 440, height: 660,
          pointerEvents: 'none',
        }}>
          {/* Portrait image — anchored to bottom */}
          <img
            src={step.otterImage} alt="Gavin"
            style={{
              position: 'absolute', bottom: 0, left: 0,
              width: 440, height: 660,
              objectFit: 'contain', objectPosition: 'bottom center',
              display: 'block',
            }}
          />

          {/* Bubble + button — pinned just above first otter pixel (335px from bottom) */}
          <div style={{
            position: 'absolute', bottom: 345, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                padding: '14px 20px', borderRadius: 16, fontSize: 14, fontWeight: 500,
                lineHeight: 1.5, color: '#1C1410', textAlign: 'center',
                backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 380,
              }}>
                {step.bubbleText}
              </div>
              <div style={{
                position: 'absolute', bottom: -7, left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: 14, height: 14, backgroundColor: '#FAF8F3',
                borderRight: '1.5px solid rgba(27,56,40,0.18)',
                borderBottom: '1.5px solid rgba(27,56,40,0.18)',
              }} />
            </div>

            {/* Start Exploring button */}
            <div style={{ pointerEvents: 'auto', marginTop: 6 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onEnd(); }}
                style={{
                  padding: '7px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13,
                  backgroundColor: '#1B3828', color: '#EED98A',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
              >
                {t('tutorial_start_exploring')}
              </button>
            </div>
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
              {spotlightRects.map((rect, i) => {
                if (!rect) return null;
                // Cap at half element height so pill buttons get circular
                // corners (matching border-radius: 9999px visually) rather
                // than SVG's elliptical clamping artefact.
                const cr = Math.min(r, rect.height / 2);
                return (
                  <rect
                    key={i}
                    x={rect.left} y={rect.top}
                    width={rect.width} height={rect.height}
                    rx={cr} ry={cr}
                    fill="black"
                  />
                );
              })}
            </mask>
          </defs>
          <rect x={0} y={0} width={vw} height={vh}
            fill="rgba(0,0,0,0.48)"
            mask={`url(#tmask-${step.id})`} />
        </svg>
      )}

      {/* Pulsating gold ring on action step targets */}
      {isAction && spotlightRects.map((rect, i) => {
        if (!rect) return null;
        const cr = Math.min(r, rect.height / 2);
        return (
          <div key={`pulse-${i}`} style={{
            position: 'fixed',
            top: rect.top, left: rect.left,
            width: rect.width, height: rect.height,
            borderRadius: cr,
            zIndex: 9992,
            pointerEvents: 'none',
            animation: 'tutorial-pulse 1.6s ease-in-out infinite',
          }} />
        );
      })}

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
  const t = useT();
  return (
    <button
      onClick={onEnd}
      style={{
        position: 'fixed', top: 52, right: 16, zIndex: 9999,
        padding: '7px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13,
        backgroundColor: '#1B3828', color: '#EED98A',
        border: 'none', cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
    >
      {t('tutorial_end')}
    </button>
  );
}
