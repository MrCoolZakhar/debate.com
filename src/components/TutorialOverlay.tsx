'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Portal from '@/components/Portal';
import { FlagImg } from '@/components/FlagImg';
import type { Committee } from '@/lib/types';
import { getCountryByName, getCountryDisplayName } from '@/lib/countries';
import { getScoringConfig } from '@/lib/scoring';
import { docName } from '@/lib/docNames';
import { useT, useLanguage } from '@/contexts/LanguageContext';

interface Props {
  committee: Committee;
  onEnd: () => void;
  onStepId?: (id: string) => void;
}

type StepKind = 'questionnaire' | 'spotlight' | 'action' | 'panel' | 'goodbye';

interface TutorialStep {
  id: string;
  kind: StepKind;
  otterImage: string;
  bubbleText: React.ReactNode;
  // Array of data-tutorial values, all light up simultaneously
  spotlightTargets?: string[];
  spotlightRadius?: number;
  // Committee-state condition to auto-advance
  actionDone?: (c: Committee) => boolean;
  // DOM-attribute condition to auto-advance (for non-committee state)
  domActionDone?: () => boolean;
}

// ─── i18n helper ──────────────────────────────────────────────────────────────
// This component keeps its copy inline (rather than in translations.ts) so a step's
// text lives next to the step it belongs to. `pick` is just a typed lookup with an
// English fallback, so a missing locale degrades instead of rendering `undefined`.
function pick<T>(language: string, m: { en: T; es: T; fr: T; ar: T }): T {
  return (m as unknown as Record<string, T>)[language] ?? m.en;
}

// ─── Rich text helpers ────────────────────────────────────────────────────────
const G  = (t: string) => <span style={{ color: '#B6871F', fontWeight: 700 }}>{t}</span>; // gold
const GR = (t: string) => <span style={{ color: '#2A5A3C', fontWeight: 700 }}>{t}</span>; // green

/** Chair-renameable document labels, already resolved + locale-defaulted via
 *  `docName()`. Passed in so the tutorial never hardcodes "Working Paper" /
 *  "Draft Resolution" — a committee that renamed them must read consistently. */
interface DocLabels {
  wpPlural: string;
  drPlural: string;
  wpSingular: string;
  drSingular: string;
}

function getSteps(language: string, docs: DocLabels): TutorialStep[] {
  return [
    {
      id: 'questionnaire', kind: 'questionnaire',
      otterImage: '/Otter.Tutorial.Intro.webp', bubbleText: '',
    },
    {
      id: 'welcome', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: [],
      bubbleText: pick(language, {
        ar: <>مرحباً بك في <strong>قاعة لجنتك</strong>. {GR('المتحدثون')}، {GR('المؤقّتات')}، {GR('التصويت')}، {GR('الاقتراحات')}، {GR('المحادثة')}، {GR('المستندات')}، كل ذلك في مكان واحد، مُصمَّم لإدارة <strong>جلسة المحاكاة الكاملة</strong> من أول ضربة مطرقة إلى آخرها.</>,
        fr: <>Bienvenue dans votre <strong>salle de comité</strong>. {GR('Orateurs')}, {GR('chronomètres')}, {GR('votes')}, {GR('motions')}, {GR('chat')}, {GR('documents')}, tout en un seul endroit, conçu pour gérer votre <strong>session MUN complète</strong> du premier coup de maillet au dernier.</>,
        es: <>Bienvenido a tu <strong>sala de comité</strong>. {GR('Oradores')}, {GR('cronómetros')}, {GR('votos')}, {GR('mociones')}, {GR('chat')}, {GR('documentos')}, todo en un solo lugar para dirigir tu <strong>sesión completa de MUN</strong>.</>,
        en: <>Welcome to your <strong>committee room</strong>. {GR('Speakers')}, {GR('timers')}, {GR('voting')}, {GR('motions')}, {GR('chat')}, {GR('documents')}, all bundled in one place, built to run your <strong>entire MUN session</strong> from the first gavel to the last.</>,
      }),
    },
    {
      id: 'speakers-bottom-bar', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['speakers-bottom-bar'], spotlightRadius: 12,
      bubbleText: pick(language, {
        ar: <>هذا الشريط هو وسيلتك <strong>لإضافة المندوبين</strong> إلى قائمة المتحدثين. اكتب اسم أي {G('دولة')} ثم اضغط {G('Enter')}.</>,
        fr: <>Cette barre vous permet d&apos;<strong>ajouter des délégués</strong> à la liste des orateurs. Tapez n&apos;importe quel {G('nom de pays')} et appuyez sur {G('Entrée')}.</>,
        es: <>Esta barra sirve para <strong>agregar delegados</strong> a la lista de oradores. Escribe cualquier {G('nombre de país')} y presiona {G('Enter')}.</>,
        en: <>This bar is how you <strong>add delegates</strong> to the speakers list. Type any {G('country name')} and press {G('Enter')}.</>,
      }),
    },
    {
      id: 'sidebar-view-toggle', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['sidebar-view-toggle'], spotlightRadius: 99,
      bubbleText: pick(language, {
        ar: <>للوحة الجانبية عرضان: {G('أ-ي')} و{G('القائمة')}. بدّل إلى <strong>القائمة</strong> لرؤية ترتيب المتحدثين.</>,
        fr: <>Le panneau latéral a deux vues : {G('A-Z')} et {G('LISTE')}. Passez sur <strong>LISTE</strong> pour voir l&apos;ordre des orateurs.</>,
        es: <>El panel lateral tiene dos opciones: {G('A-Z')} y {G('FILA')}. Cambia a <strong>FILA</strong> para ver el orden de oradores.</>,
        en: <>The sidebar has two views: {G('A-Z')} and {G('QUEUE')}. Switch to <strong>QUEUE</strong> to see the speaking order.</>,
      }),
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
      bubbleText: pick(language, {
        ar: <>أضف <strong>3 دول</strong> إلى القائمة: استخدم {G('شريط البحث')} أو انقر على المندوبين في {G('اللوحة الجانبية')}. كلاهما يعمل!</>,
        fr: <>Ajoutez <strong>3 pays</strong> à la liste : utilisez la {G('barre de recherche')} ou cliquez sur des délégués dans le {G('panneau latéral')}. Les deux fonctionnent !</>,
        es: <>Agrega <strong>3 países</strong> a la lista: usa la {G('barra de búsqueda')} o haz clic en delegados del {G('panel lateral')}. ¡Ambos funcionan!</>,
        en: <>Add <strong>any 3 countries</strong> to the speakers list: use the {G('input bar')} below or click delegates in the {G('sidebar')}. Both work!</>,
      }),
      actionDone: (c) => c.speakersList.length >= 3,
    },
    {
      id: 'call-first-speaker', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['call-first-speaker'], spotlightRadius: 14,
      bubbleText: pick(language, {
        ar: <>الآن انقر على <strong>استدعاء أول متحدث</strong> لإعطاء الكلمة إلى {G('أول مندوب')}!</>,
        fr: <>Cliquez maintenant sur <strong>APPELER LE PREMIER ORATEUR</strong> pour donner la parole au {G('premier délégué')} !</>,
        es: <>Ahora haz clic en <strong>LLAMAR PRIMER ORADOR</strong> para llamar al {G('primer delegado')} al piso.</>,
        en: <>Now click <strong>CALL FIRST SPEAKER</strong> to bring the {G('first delegate')} to the floor!</>,
      }),
      actionDone: (c) => !!c.currentSpeaker,
    },
    {
      id: 'timer', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['timer'], spotlightRadius: 12,
      bubbleText: pick(language, {
        ar: <>يبدأ <strong>مؤقّت الكلام</strong> بالعد التنازلي للمندوب الحالي. يتحوّل إلى {G('الكهرماني')} في آخر 10 ثوانٍ.</>,
        fr: <>Le <strong>chronomètre</strong> décompte pour le délégué actuel. Il passe à l&apos;{G('ambre')} dans les 10 dernières secondes.</>,
        es: <>El <strong>cronómetro</strong> cuenta regresivamente para el delegado actual. Se vuelve {G('ámbar')} en los últimos 10 segundos.</>,
        en: <>The <strong>speaking timer</strong> counts down for the current delegate. It turns {G('amber')} for the last 10 seconds.</>,
      }),
    },
    {
      id: 'add-time', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['add-time-button'], spotlightRadius: 12,
      bubbleText: pick(language, {
        ar: <>تحتاج إلى منح وقت إضافي؟ اضغط {G('+وقت')} لإضافة {G('15 / 30 / 60')} ثانية أو أي مقدار مخصّص. وزر {G('↺')} في الصف نفسه يعيد المؤقّت إلى مدّة الكلام الكاملة.</>,
        fr: <>Besoin d&apos;accorder plus de temps ? {G('+temps')} ajoute {G('15 / 30 / 60')} secondes, ou le montant de votre choix. Le {G('↺')} de la même rangée remet le chronomètre au temps de parole complet.</>,
        es: <>¿Necesitas dar más tiempo? {G('+tiempo')} agrega {G('15 / 30 / 60')} segundos, o los que quieras. El {G('↺')} de la misma fila devuelve el cronómetro al tiempo completo.</>,
        en: <>Need to grant more time? {G('+time')} adds {G('15 / 30 / 60')} seconds, or any amount you type. The {G('↺')} in the same row restarts the clock at the full speaking time.</>,
      }),
    },
    {
      id: 'rtr', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['rtr-button'], spotlightRadius: 12,
      bubbleText: pick(language, {
        ar: <>يمنح {GR('حق الرد')} مندوباً مؤقّتاً منفصلاً للردّ. إنه <strong>لا يمسّ قائمة المتحدثين</strong> إطلاقاً، لذا لا يفقد أحد مكانه في الطابور.</>,
        fr: <>{GR('Droit de Réponse')} donne à un délégué un chronomètre séparé pour répondre. Il <strong>ne touche jamais à la liste des orateurs</strong>, donc personne ne perd sa place.</>,
        es: <>{GR('Derecho a Réplica')} le da al delegado un cronómetro aparte para responder. <strong>Nunca toca la lista de oradores</strong>, así que nadie pierde su lugar.</>,
        en: <>{GR('Right to Reply')} gives an accused delegate a separate timer to answer. It <strong>never touches the speakers list</strong>, so nobody loses their place in the queue.</>,
      }),
    },
    {
      id: 'tab-rollcall', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-rollcall'], spotlightRadius: 6,
      bubbleText: pick(language, {
        ar: <>{G('تدقيق الحضور')}: انقر هنا لتحديد كل مندوب على أنه <strong>غائب</strong> أو <strong>حاضر</strong> أو <strong>حاضر ومصوّت</strong>. يمكنك تحديث الحضور في أي وقت أثناء الجلسة.</>,
        fr: <>{G('Appel')} : cliquer ici pour marquer chaque délégué comme <strong>Absent</strong>, <strong>Présent</strong> ou <strong>Présent et Votant</strong>. Mettre à jour l&apos;assiduité à tout moment pendant la session.</>,
        es: <>{G('Lista de Asistencia')}: marca a cada delegado como <strong>Ausente</strong>, <strong>Presente</strong> o <strong>Presente y Votante</strong>. Puedes actualizar la asistencia en cualquier momento.</>,
        en: <>{G('Roll Call')}: click here to mark each delegate as <strong>Absent</strong>, <strong>Present</strong>, or <strong>Present & Voting</strong>. You can update attendance at any point during the session.</>,
      }),
    },
    {
      id: 'tab-motions', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-motions'], spotlightRadius: 6,
      bubbleText: pick(language, {
        ar: <>{G('الاقتراحات')}: عندما يرفع مندوب لافتته، <strong>تُدخل الاقتراح أنت</strong> هنا وتختار مَن اقترحه: <strong>حوار منهجي</strong> أو <strong>حرّ</strong> أو <strong>جولة متحدثين</strong> أو <strong>مشاورات الهيئة</strong>. ومن هنا أيضاً {GR('تعليق')} أو {GR('إنهاء النقاش')}.</>,
        fr: <>{G('Motions')} : quand un délégué lève sa pancarte, <strong>c&apos;est vous qui saisissez la motion</strong> ici et choisissez qui la propose : <strong>Caucus modéré</strong>, <strong>non modéré</strong>, <strong>Tour de table</strong> ou <strong>Consultation de l&apos;assemblée</strong>. C&apos;est aussi d&apos;ici qu&apos;on {GR('suspend')} ou {GR('clôture le débat')}.</>,
        es: <>{G('Mociones')}: cuando un delegado levanta su placa, <strong>tú registras la moción</strong> aquí y eliges quién la propone: <strong>Cáucus Moderado</strong>, <strong>No Moderado</strong>, <strong>Round Robin</strong> o <strong>Consulta de Gabinete</strong>. También {GR('suspendes')} o {GR('cierras el debate')} desde aquí.</>,
        en: <>{G('Motions')}: when a delegate raises their placard, <strong>you key the motion in</strong> here and pick who proposed it: <strong>Moderated Caucus</strong>, <strong>Unmoderated</strong>, <strong>Tour de Table</strong>, or <strong>Consultation of the Whole</strong>. {GR('Suspend')} and {GR('close debate')} live here too.</>,
      }),
    },
    {
      id: 'tab-documents', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-documents'], spotlightRadius: 6,
      bubbleText: pick(language, {
        ar: <>{G('المستندات')}: تصل هنا <strong>{docs.wpPlural}</strong> و<strong>{docs.drPlural}</strong> التي يقدّمها المندوبون. اضغط <strong>تقديم</strong> لتشغيل مراحل {GR('القراءة')} و{GR('العرض')} و{GR('الأسئلة')} على شاشتك؛ تُعتمد {docs.wpSingular} تلقائياً بعدها، أمّا {docs.drSingular} فينتقل إلى صفحة التصويت.</>,
        fr: <>{G('Documents')} : les <strong>{docs.wpPlural}</strong> et <strong>{docs.drPlural}</strong> soumis par les délégués arrivent ici. <strong>Introduire</strong> lance les étapes {GR('Lecture')}, {GR('Présentation')} et {GR('Q&R')} sur votre écran ; {docs.wpSingular} est adopté automatiquement ensuite, {docs.drSingular} part vers la page de vote.</>,
        es: <>{G('Documentos')}: aquí llegan <strong>{docs.wpPlural}</strong> y <strong>{docs.drPlural}</strong> que envían los delegados. <strong>Introducir</strong> lanza las etapas de {GR('Lectura')}, {GR('Presentación')} y {GR('Preguntas')} en tu pantalla; {docs.wpSingular} se aprueba automáticamente al terminar, y {docs.drSingular} pasa a la página de votación.</>,
        en: <>{G('Documents')}: <strong>{docs.wpPlural}</strong> and <strong>{docs.drPlural}</strong> submitted by delegates land here. <strong>Introduce</strong> runs the {GR('Reading')}, {GR('Presentation')} and {GR('Q&A')} stages on your screen; a {docs.wpSingular} auto-passes afterwards, a {docs.drSingular} goes to the voting page.</>,
      }),
    },
    {
      id: 'tab-chat', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-chat'], spotlightRadius: 6,
      bubbleText: pick(language, {
        ar: <>{G('المحادثة')}: راسل <strong>جميع المندوبين</strong> دفعة واحدة أو أرسل رسائل خاصة فردية. نوصي بإبقائها مفتوحة على <strong>جهازك الشخصي</strong> بدلاً من شاشة اللجنة الرئيسية.</>,
        fr: <>{G('Chat')} : envoyez un message à <strong>tous les délégués</strong> ou des messages privés individuels. Nous recommandons de le garder ouvert sur votre <strong>appareil personnel</strong> plutôt que sur l&apos;écran principal du comité.</>,
        es: <>{G('Chat')}: envía mensajes a <strong>todos los delegados</strong> o DM individuales. Recomendamos tenerlo abierto en tu <strong>dispositivo personal</strong>.</>,
        en: <>{G('Chat')}: message <strong>all delegates</strong> at once or DM individuals. We recommend keeping this open on your <strong>personal device</strong> rather than the main committee screen.</>,
      }),
    },
    {
      id: 'tab-settings', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-settings'], spotlightRadius: 6,
      bubbleText: pick(language, {
        ar: <>{G('الإعدادات')} أربع تبويبات: {GR('الوصول')} (رمز الرئاسة والموافقة والمشرف)، و{GR('الاقتراحات')} (تفعيل الاقتراحات وترتيبها وإعادة تسميتها، واعتماد المستندات وأسماؤها)، و{GR('التصويت')} (النِّصاب والأغلبيات وحق النقض)، و{GR('النقاط')}.</>,
        fr: <>{G('Paramètres')}, quatre onglets : {GR('Accès')} (code président, approbation, modérateur), {GR('Motions')} (activer, réordonner et renommer les motions, approbation et noms des documents), {GR('Vote')} (quorum, majorités, veto) et {GR('Points')}.</>,
        es: <>{G('Configuración')}, cuatro pestañas: {GR('Acceso')} (código de presidencia, aprobación, moderador), {GR('Mociones')} (activar, reordenar y renombrar mociones, aprobación y nombres de documentos), {GR('Votación')} (cuórum, mayorías, veto) y {GR('Puntos')}.</>,
        en: <>{G('Settings')} has four tabs: {GR('Access')} (chair code, delegate approval, Moderator), {GR('Motions')} (enable, reorder and rename motions, document approval and names), {GR('Voting')} (quorum, majorities, veto), and {GR('Points')}.</>,
      }),
    },
    {
      id: 'scoreboard', kind: 'panel',
      otterImage: '/Otter.Tutorial.webp',
      bubbleText: '',
    },
    {
      id: 'join-code', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['join-code'], spotlightRadius: 8,
      bubbleText: pick(language, {
        ar: <>هذا <strong>رمز جلستك</strong>. يُدخله المندوبون في {G('gavelling.com')} للانضمام في الوقت الفعلي. {GR('انقر للنسخ')}. أمّا الرؤساء الذين ينضمون إلى المنصة فيحتاجون رمز الرئاسة الكامل من {GR('الإعدادات ← الوصول')}.</>,
        fr: <>Votre <strong>code de session</strong>. Les délégués l&apos;entrent sur {G('gavelling.com')} pour rejoindre en temps réel. {GR('Cliquez pour copier')}. Les présidents qui rejoignent le présidium ont besoin du code président complet, dans {GR('Paramètres → Accès')}.</>,
        es: <>Tu <strong>código de sesión</strong>. Los delegados lo ingresan en {G('gavelling.com')} para unirse en tiempo real. {GR('Haz clic para copiar')}. Las presidencias que se unen a la mesa necesitan el código de presidencia completo, en {GR('Configuración → Acceso')}.</>,
        en: <>Your <strong>session code</strong>. Delegates enter this at {G('gavelling.com')} to join in real time. {GR('Click to copy')}. Chairs joining the dais need the longer chair code instead, found in {GR('Settings → Access')}.</>,
      }),
    },
    {
      id: 'goodbye', kind: 'goodbye',
      otterImage: '/Otter.Tutorial.Outro.webp',
      bubbleText: pick(language, {
        ar: <>استمتع بالاستكشاف! وزوّدنا دائماً بـ {G('ملاحظاتك')}، فهكذا يتحسّن Gavelling. راسلنا على إنستغرام {GR('@wearegavelling')} في أي وقت 🎉</>,
        fr: <>Amusez-vous à explorer ! Et donnez-nous toujours votre {G('avis')}, c&apos;est comme ça que Gavelling s&apos;améliore. Écrivez-nous sur IG {GR('@wearegavelling')} à tout moment 🎉</>,
        es: <>¡Diviértete explorando! Y siempre {G('danos tu opinión')}, así mejora Gavelling. Escríbenos en IG {GR('@wearegavelling')} cuando quieras 🎉</>,
        en: <>Have fun exploring! And always {G('give us feedback')}, it&apos;s how Gavelling gets better. Text us on IG {GR('@wearegavelling')} any time 🎉</>,
      }),
    },
  ];
}

// ─── Coordinate space ─────────────────────────────────────────────────────────
// Every overlay here is portalled into #fit-root, which FitToScreen renders with a
// `transform: scale()`. A transformed ancestor becomes the containing block for its
// `position: fixed` descendants, so "fixed" coordinates inside the portal are in
// fit-root's own *unscaled* design units — while getBoundingClientRect() (and
// window.innerWidth/Height) report real, post-transform viewport pixels.
//
// Mixing the two is what pushed the spotlight holes off their targets. `DesignBox`
// carries everything needed to convert: the design-space size of the overlay, plus
// the scale and viewport origin of the fit-root box. When there is no fit-root
// (marketing pages, or if Portal ever falls back to document.body) it degrades to
// the identity transform and plain viewport pixels.
interface DesignBox { w: number; h: number; scale: number; left: number; top: number; }
interface Rect { left: number; top: number; width: number; height: number; }

const IDENTITY: DesignBox = { w: 0, h: 0, scale: 1, left: 0, top: 0 };

function measureBox(): DesignBox {
  if (typeof window === 'undefined') return IDENTITY;
  const root = document.getElementById('fit-root');
  if (!root) return { w: window.innerWidth, h: window.innerHeight, scale: 1, left: 0, top: 0 };
  const r = root.getBoundingClientRect();
  const w = root.offsetWidth || r.width;
  const h = root.offsetHeight || r.height;
  const scale = w > 0 && r.width > 0 ? r.width / w : 1;
  return { w, h, scale: scale || 1, left: r.left, top: r.top };
}

function toDesign(rect: DOMRect, box: DesignBox): Rect {
  const s = box.scale || 1;
  return {
    left: (rect.left - box.left) / s,
    top: (rect.top - box.top) / s,
    width: rect.width / s,
    height: rect.height / s,
  };
}

// Measures the design box and every spotlight target together, on one animation
// frame, so the mask and its holes can never disagree by a frame. Also listens for
// scroll (capture phase, to catch scrolling containers) and resize, as required for
// any floating layer in this codebase.
function useSpotlight(targets: string[] = []) {
  const key = targets.join(',');
  const [state, setState] = useState<{ box: DesignBox; rects: (Rect | null)[] }>({ box: IDENTITY, rects: [] });
  const sigRef = useRef('');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    let frame = 0;
    let stopped = false;
    let last = 0;
    // Driven by rAF so the spotlight tracks layout changes without the visible lag of
    // the old 200ms poll, but gated to ~33fps: each pass forces a layout read, and the
    // chair cockpit is re-rendering a timer underneath us.
    const MIN_MS = 30;

    const update = (now = 0) => {
      if (now && now - last < MIN_MS) {
        if (!stopped) frame = requestAnimationFrame(update);
        return;
      }
      last = now;
      const box = measureBox();
      const rects = list.map((tName) => {
        const el = document.querySelector(`[data-tutorial="${tName}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        // A zero-area element is present but not laid out (collapsed panel,
        // display:contents parent) — treat it as absent so we do not punch a
        // degenerate hole.
        if (r.width <= 0 || r.height <= 0) return null;
        return toDesign(r, box);
      });
      // Re-render only when something actually moved: this runs every frame.
      const sig = `${box.w}|${box.h}|${box.scale}|${box.left}|${box.top}|` +
        rects.map((r) => (r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : 'x')).join(';');
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setState({ box, rects });
      }
      if (!stopped) frame = requestAnimationFrame(update);
    };

    update();
    const onScroll = () => { sigRef.current = ''; };
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [key]);

  return state;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TutorialOverlay({ committee, onEnd, onStepId }: Props) {
  const t = useT();
  const { language } = useLanguage();
  // Resolved once per rename (not per committee tick) so STEPS stays referentially
  // stable across the realtime updates that stream through `committee`.
  const wpPlural = docName(committee, 'working-paper', 'plural', t('documents_working_papers_tab'));
  const drPlural = docName(committee, 'draft-resolution', 'plural', t('documents_draft_resolutions_tab'));
  const wpSingular = docName(committee, 'working-paper', 'singular', t('documents_working_paper'));
  const drSingular = docName(committee, 'draft-resolution', 'singular', t('documents_draft_resolution'));
  const STEPS = useMemo(
    () => getSteps(language, { wpPlural, drPlural, wpSingular, drSingular }),
    [language, wpPlural, drPlural, wpSingular, drSingular],
  );
  const [stepIdx, setStepIdx] = useState(0);
  // Which way the chair is walking, so an unreachable step is skipped in the same
  // direction rather than bouncing them back where they came from.
  const dirRef = useRef<1 | -1>(1);

  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)];
  const { box, rects: spotlightRects } = useSpotlight(step.spotlightTargets);
  const isAction = step.kind === 'action';
  const isLast = stepIdx >= STEPS.length - 1;

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
        .tut-scroll::-webkit-scrollbar { width: 6px; }
        .tut-scroll::-webkit-scrollbar-thumb { background: rgba(27,56,40,0.25); border-radius: 3px; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Preload all otter images on mount so they never flash when a step arrives
  useEffect(() => {
    const srcs = [...new Set(STEPS.map((s) => s.otterImage))];
    srcs.forEach((src) => { const img = new window.Image(); img.src = src; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = useCallback(() => {
    dirRef.current = 1;
    setStepIdx((i) => (i >= STEPS.length - 1 ? i : i + 1));
  }, [STEPS.length]);

  const goBack = useCallback(() => {
    dirRef.current = -1;
    setStepIdx((i) => (i <= 0 ? 0 : i - 1));
  }, []);

  // Notify parent whenever step.id changes.
  // Use a ref so the effect ONLY fires on step changes, not every time the
  // parent re-renders and passes a new inline function reference (which would
  // continuously reset the toggle view during the timer's per-second re-renders).
  const onStepIdRef = useRef(onStepId);
  onStepIdRef.current = onStepId;
  useEffect(() => { onStepIdRef.current?.(step.id); }, [step.id]);

  // Auto-advance action steps. Checked immediately (so a condition already met does
  // not sit on screen for a beat) and then polled — both committee state and DOM
  // state are covered.
  useEffect(() => {
    if (step.kind !== 'action') return;
    const check = () => {
      const stateOk = step.actionDone ? step.actionDone(committee) : true;
      const domOk = step.domActionDone ? step.domActionDone() : true;
      if (stateOk && domOk) advance();
    };
    check();
    const id = setInterval(check, 200);
    return () => clearInterval(id);
  }, [committee, step, advance]);

  // Survive a phase change mid-tutorial. The tab row only exists outside
  // pre-session, and the timer / +time / RTR controls only exist while someone
  // holds the floor on the GSL — so a suspend, an accepted caucus motion, or a
  // Commenter losing the gavel can strip a step's target out from under it. Rather
  // than dimming the screen and pointing at nothing, walk past any step whose
  // targets have all vanished, continuing in the direction of travel.
  useEffect(() => {
    const targets = step.spotlightTargets;
    if (!targets || targets.length === 0) return;
    const id = setTimeout(() => {
      const anyPresent = targets.some((name) => {
        const el = document.querySelector(`[data-tutorial="${name}"]`);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (anyPresent) return;
      if (dirRef.current === -1 && stepIdx > 0) setStepIdx((i) => i - 1);
      else if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
    }, 700);
    return () => clearTimeout(id);
  }, [step, stepIdx, STEPS.length]);

  // Keyboard. Esc always ends. Arrows / Enter / Space navigate — but never while
  // the chair is typing into the real app, which action steps require them to do
  // (adding countries to the speakers list is literally "type, press Enter").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onEnd(); return; }
      const el = e.target as HTMLElement | null;
      const typing = !!el && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      );
      if (typing) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isLast) onEnd(); else advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, goBack, onEnd, isLast]);

  const r = step.spotlightRadius ?? 12;
  const vw = box.w;
  const vh = box.h;

  const nav = (
    <TutorialNav
      idx={stepIdx}
      total={STEPS.length}
      onBack={goBack}
      onNext={isLast ? onEnd : advance}
      isAction={isAction}
      isLast={isLast}
      language={language}
    />
  );

  // ── Questionnaire ─────────────────────────────────────────────────────────
  if (step.kind === 'questionnaire') {
    return (
      <Portal><div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
        style={{ background: 'rgba(27,56,40,0.88)', backdropFilter: 'blur(4px)' }}>
        <div className="tut-scroll bg-[#F6F1E9] rounded-3xl shadow-2xl px-12 py-10 max-w-md w-full text-center flex flex-col items-center gap-6"
          style={{ border: '2px solid rgba(27,56,40,0.2)', maxHeight: '92%', overflowY: 'auto' }}>
          <img src="/Otter.Tutorial.Intro.webp" alt="Gavin"
            style={{ width: 260, height: 260, objectFit: 'cover', objectPosition: 'center', borderRadius: 0, flexShrink: 0 }} />
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
      </div></Portal>
    );
  }

  // ── Goodbye slide ─────────────────────────────────────────────────────────
  if (step.kind === 'goodbye') {
    return (
      <Portal>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(3px)', cursor: 'pointer' }}
          onClick={onEnd}
        />
        {nav}
        {/*
          Outro PNG: 2000×2000, 475px transparent top.
          Rendered at 440×440 (fit-to-width) inside 660px box, bottom-anchored:
            - transparent top within rendered area: 475/2000 × 440 ≈ 105px
            - otter head from bottom: 440 − 105 = 335px
        */}
        <div style={{
          position: 'fixed', bottom: 0, right: -20, zIndex: 9993,
          width: 440, height: 660,
          pointerEvents: 'none',
        }}>
          <img
            src={step.otterImage} alt="Gavin"
            style={{
              position: 'absolute', bottom: 0, left: 0,
              width: 440, height: 660,
              objectFit: 'contain', objectPosition: 'bottom center',
              display: 'block',
            }}
          />

          <div style={{
            position: 'absolute', bottom: 345, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ position: 'relative' }}>
              <div className="tut-scroll" style={{
                padding: '14px 20px', borderRadius: 16, fontSize: 14, fontWeight: 500,
                lineHeight: 1.5, color: '#1C1410', textAlign: 'center',
                backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 380,
                maxHeight: 240, overflowY: 'auto', overscrollBehavior: 'contain',
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
      </Portal>
    );
  }

  // ── Scoreboard panel step ─────────────────────────────────────────────────
  if (step.kind === 'panel') {
    return (
      <Portal>
        {/* Padded clear of the top nav pill (top:52) and the End Tutorial button, so a
            tall card is never overlapped by its own controls. The card's max-height is
            100% of that already-inset content box — never vh, which would resolve
            against the real viewport instead of fit-root's design box. */}
        <div className="fixed inset-0 z-[9990] flex items-center justify-center px-6 pb-6"
          style={{ background: 'rgba(27,56,40,0.80)', backdropFilter: 'blur(3px)', paddingTop: 96 }}>
          <ScoreboardTutorialCard committee={committee} language={language} box={box} />
        </div>
        <EndTutorialBtn onEnd={onEnd} />
        {nav}
      </Portal>
    );
  }

  // ── Spotlight / Action steps ──────────────────────────────────────────────
  return (
    <Portal>
      {/* SVG mask, one hole per spotlight target. Sized and positioned in fit-root
          design units, exactly like the rects punched out of it. */}
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

      {/* Click-to-advance catcher, spotlight steps only */}
      {!isAction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9991, cursor: 'pointer' }}
          onClick={advance} />
      )}

      {/* End Tutorial, fixed, just below the h-11 (44px) top navbar */}
      <EndTutorialBtn onEnd={onEnd} />
      {nav}

      {/* Gavin, fixed bottom-right, portrait touching bottom */}
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
        {/* Portrait image, fills the container, content anchored to bottom */}
        <img
          src={step.otterImage} alt="Gavin"
          style={{
            position: 'absolute', bottom: 0, left: 0,
            width: 440, height: 660,
            objectFit: 'contain', objectPosition: 'bottom center',
            display: 'block',
          }}
        />

        {/* Speech bubble, pinned just above first otter pixel. Capped and scrollable
            so a long localised string can never grow past the top of the screen. */}
        {step.bubbleText && (
          <div style={{
            position: 'absolute', bottom: 334, left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div className="tut-scroll" style={{
              padding: '14px 20px', borderRadius: 16, fontSize: 14, fontWeight: 500,
              lineHeight: 1.45, color: '#1C1410', textAlign: 'center',
              backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: 380,
              maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain',
              pointerEvents: 'auto',
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
    </Portal>
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

// Back / counter / Next. Sits top-centre, opposite End Tutorial, clear of every
// spotlight target (bottom bar, sidebar, centre column, tab row).
// On an action step Next reads "Skip" — the chair must always be able to leave a
// step they cannot complete (Commenter, below quorum, too few delegates).
function TutorialNav({
  idx, total, onBack, onNext, isAction, isLast, language,
}: {
  idx: number; total: number; onBack: () => void; onNext: () => void;
  isAction: boolean; isLast: boolean; language: string;
}) {
  const label = isLast
    ? pick(language, { en: 'Finish', es: 'Terminar', fr: 'Terminer', ar: 'إنهاء' })
    : isAction
      ? pick(language, { en: 'Skip', es: 'Omitir', fr: 'Passer', ar: 'تخطٍّ' })
      : pick(language, { en: 'Next', es: 'Siguiente', fr: 'Suivant', ar: 'التالي' });
  const backLabel = pick(language, { en: 'Back', es: 'Atrás', fr: 'Retour', ar: 'رجوع' });

  const btn: React.CSSProperties = {
    padding: '5px 12px', borderRadius: 8, fontWeight: 700, fontSize: 12,
    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.4,
  };

  return (
    <div
      style={{
        position: 'fixed', top: 52, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 12,
        backgroundColor: '#FAF8F3', border: '1.5px solid rgba(27,56,40,0.18)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={onBack}
        disabled={idx <= 0}
        style={{ ...btn, backgroundColor: 'transparent', color: idx <= 0 ? '#C8BAA8' : '#1B3828', cursor: idx <= 0 ? 'default' : 'pointer' }}
      >
        ‹ {backLabel}
      </button>
      <span className="font-mono tabular-nums" style={{ fontSize: 11, color: '#9A8A78' }}>
        {idx + 1}/{total}
      </span>
      <button
        onClick={onNext}
        style={{ ...btn, backgroundColor: '#1B3828', color: '#EED98A' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
      >
        {label} ›
      </button>
    </div>
  );
}

// ─── Hover explainer ─────────────────────────────────────────────────────────
// Informational affordance: reveals on HOVER and on FOCUS, never on click, with a
// short close delay so the pointer can travel into the panel. Portalled at fixed
// coordinates so the scrolling card body can never clip it, and flipped/clamped so
// it can never leave the screen.
function HoverInfo({ text, box }: { text: string; box: DesignBox }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; flip: boolean } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const W = 260;
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = toDesign(el.getBoundingClientRect(), box);
    // Clamp horizontally so the card always stays inside the design box.
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - W / 2, box.w - W - 8));
    // Flip above the trigger when there is not enough room below.
    const flip = rect.top + rect.height + 130 > box.h;
    const top = flip ? rect.top - 8 : rect.top + rect.height + 8;
    setPos({ left, top, flip });
  }, [box]);

  const open = () => { if (closeTimer.current) clearTimeout(closeTimer.current); place(); };
  const close = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPos(null), 140);
  };

  useEffect(() => {
    if (!pos) return;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [pos, place]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        role="note"
        aria-label={text}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        className="inline-flex items-center justify-center shrink-0 font-black select-none"
        style={{
          width: 14, height: 14, borderRadius: 999, fontSize: 9, cursor: 'help',
          backgroundColor: 'rgba(27,56,40,0.10)', color: '#1B3828',
          border: '1px solid rgba(27,56,40,0.20)', outline: 'none',
        }}
      >
        i
      </span>
      {pos && (
        <div
          onMouseEnter={open}
          onMouseLeave={close}
          style={{
            position: 'fixed', left: pos.left, top: pos.top, width: W, zIndex: 9998,
            transform: pos.flip ? 'translateY(-100%)' : undefined,
            padding: '9px 11px', borderRadius: 10,
            backgroundColor: '#1B3828', color: '#F6F1E9',
            fontSize: 11, lineHeight: 1.5, fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}

// ─── Scoreboard tutorial page ────────────────────────────────────────────────

const SB_COPY = {
  en: {
    title: 'Scoreboard',
    kicker: 'The trophy in your top bar',
    lead: 'Every delegation, ranked live. Open it any time from the trophy icon, drill into a delegation to see exactly where each point came from, or hit Export CSV for the whole ledger.',
    earnHead: 'Points land on their own',
    earnFoot: 'Speaking time is counted per full 10 seconds on top of the speech itself. You can also award or deduct points by hand from a delegation drill-in; a written reason is required and it stays in the ledger.',
    earnEmpty: 'Every point source is switched off in this committee, so the ranking is quality only.',
    tuneHead: 'Make the numbers yours',
    tuneWhere: 'Settings → Points',
    tune1: 'Change any point value, switch a source off, or add sources of your own.',
    tune2: 'Rename, add or remove the quality factors chairs rate, and set the rating scale.',
    tune3: 'Ranking blend decides how much those quality ratings move the headline number.',
    tune4: 'Hide scores from delegates keeps their speaking recap but removes the leaderboard.',
    blendInfo: 'The headline score is the objective point total blended with the 0–100 quality score from chair ratings. At 0% the ranking is pure points; at 100% it is pure quality.',
    blendNow: (n: number) => n === 0
      ? 'Currently 0% — quality ratings are recorded but do not move the ranking.'
      : `Currently ${n}% — quality ratings carry ${n}% of the headline score.`,
    coHead: 'Commenters write the feedback',
    coBody: 'One chair is the Moderator and holds the gavel (the committee creator by default; any chair can take it from the gavel chip at the top-right of the session). Every other chair on the same chair code is a Commenter, and their centre column becomes the feedback dock below.',
    coBody2: 'They type a private note on whoever holds the floor and rate them on your quality factors. Notes surface under that speech in the scoreboard drill-in and in the CSV export; the ratings feed the quality score.',
    mockCap: 'What a Commenter sees',
    mockLive: 'Now speaking',
    mockNote: 'Strong framing, cited the 2019 protocol directly.',
    mockNext: 'Held the bloc together through the unmod.',
    mockPlaceholder: 'Private note…',
    pts: 'pts',
  },
  es: {
    title: 'Marcador',
    kicker: 'El trofeo de la barra superior',
    lead: 'Todas las delegaciones, clasificadas en vivo. Ábrelo cuando quieras desde el trofeo, entra en una delegación para ver de dónde salió cada punto, o usa Export CSV para llevarte todo el registro.',
    earnHead: 'Los puntos se otorgan solos',
    earnFoot: 'El tiempo de palabra suma por cada 10 segundos completos, además del discurso en sí. También puedes otorgar o descontar puntos a mano desde la ficha de una delegación; el motivo es obligatorio y queda en el registro.',
    earnEmpty: 'Todas las fuentes de puntos están desactivadas en este comité, así que la clasificación es solo cualitativa.',
    tuneHead: 'Ajusta los números a tu comité',
    tuneWhere: 'Configuración → Puntos',
    tune1: 'Cambia cualquier valor, desactiva una fuente o añade las tuyas.',
    tune2: 'Renombra, añade o quita los factores de calidad que califican las presidencias, y fija la escala.',
    tune3: 'La mezcla de clasificación decide cuánto pesan esas calificaciones en el número final.',
    tune4: 'Ocultar puntajes a delegados mantiene su resumen pero quita la tabla de posiciones.',
    blendInfo: 'El puntaje final mezcla el total objetivo de puntos con el puntaje de calidad de 0 a 100 que dan las presidencias. En 0% la clasificación es puro punto; en 100% es pura calidad.',
    blendNow: (n: number) => n === 0
      ? 'Ahora en 0%: las calificaciones se guardan pero no mueven la clasificación.'
      : `Ahora en ${n}%: las calificaciones pesan ${n}% del puntaje final.`,
    coHead: 'Los comentaristas escriben la retroalimentación',
    coBody: 'Una presidencia es el moderador y tiene el mazo (quien creó el comité por defecto; cualquier presidencia puede tomarlo desde la insignia del mazo, arriba a la derecha de la sesión). El resto de presidencias con el mismo código son comentaristas, y su columna central se convierte en el panel de retroalimentación de abajo.',
    coBody2: 'Escriben una nota privada sobre quien tiene la palabra y lo califican en tus factores de calidad. Las notas aparecen bajo ese discurso en el marcador y en el CSV; las calificaciones alimentan el puntaje de calidad.',
    mockCap: 'Lo que ve un comentarista',
    mockLive: 'Hablando ahora',
    mockNote: 'Buen encuadre, citó el protocolo de 2019 directamente.',
    mockNext: 'Mantuvo unido al bloque durante el cáucus.',
    mockPlaceholder: 'Nota privada…',
    pts: 'pts',
  },
  fr: {
    title: 'Tableau des scores',
    kicker: 'Le trophée de la barre du haut',
    lead: 'Toutes les délégations, classées en direct. Ouvrez-le à tout moment depuis le trophée, entrez dans une délégation pour voir d’où vient chaque point, ou faites Export CSV pour récupérer tout le registre.',
    earnHead: 'Les points tombent tout seuls',
    earnFoot: 'Le temps de parole compte par tranche de 10 secondes pleines, en plus du discours lui-même. Vous pouvez aussi attribuer ou retirer des points à la main depuis la fiche d’une délégation ; un motif écrit est obligatoire et reste au registre.',
    earnEmpty: 'Toutes les sources de points sont désactivées dans ce comité : le classement est purement qualitatif.',
    tuneHead: 'Des chiffres à votre main',
    tuneWhere: 'Paramètres → Points',
    tune1: 'Changez n’importe quelle valeur, désactivez une source ou ajoutez les vôtres.',
    tune2: 'Renommez, ajoutez ou retirez les facteurs de qualité notés par la présidence, et réglez l’échelle.',
    tune3: 'Le mélange du classement décide du poids de ces notes dans le chiffre final.',
    tune4: 'Masquer les scores aux délégués garde leur récapitulatif mais retire le classement.',
    blendInfo: 'Le score final mélange le total objectif de points et le score de qualité de 0 à 100 issu des notes de la présidence. À 0 %, le classement est purement chiffré ; à 100 %, purement qualitatif.',
    blendNow: (n: number) => n === 0
      ? 'Actuellement 0 % : les notes de qualité sont enregistrées mais ne bougent pas le classement.'
      : `Actuellement ${n} % : les notes de qualité pèsent ${n} % du score final.`,
    coHead: 'Les commentateurs écrivent les retours',
    coBody: 'Une présidence est le modérateur et tient le maillet (celle qui a créé le comité par défaut ; n’importe quelle présidence peut le prendre depuis la pastille du maillet, en haut à droite de la session). Toutes les autres présidences sur le même code sont commentatrices, et leur colonne centrale devient le dock de retours ci-dessous.',
    coBody2: 'Elles écrivent une note privée sur qui a la parole et la notent sur vos facteurs de qualité. Les notes apparaissent sous ce discours dans le tableau des scores et dans l’export CSV ; les notes alimentent le score de qualité.',
    mockCap: 'Ce que voit un commentateur',
    mockLive: 'Parle en ce moment',
    mockNote: 'Cadrage solide, a cité le protocole de 2019 directement.',
    mockNext: 'A tenu le bloc pendant tout le caucus.',
    mockPlaceholder: 'Note privée…',
    pts: 'pts',
  },
  ar: {
    title: 'لوحة النقاط',
    kicker: 'الكأس في الشريط العلوي',
    lead: 'كل الوفود مرتّبة لحظياً. افتحها متى شئت من أيقونة الكأس، وادخل على أي وفد لترى مصدر كل نقطة، أو اضغط Export CSV لتصدير السجل كاملاً.',
    earnHead: 'النقاط تُحتسب تلقائياً',
    earnFoot: 'يُحتسب وقت الكلام عن كل 10 ثوانٍ كاملة إضافةً إلى الخطاب نفسه. ويمكنك أيضاً منح أو خصم النقاط يدوياً من صفحة الوفد، مع سبب مكتوب إلزامي يبقى في السجل.',
    earnEmpty: 'كل مصادر النقاط معطّلة في هذه اللجنة، لذا يعتمد الترتيب على التقييم النوعي فقط.',
    tuneHead: 'اضبط الأرقام كما تشاء',
    tuneWhere: 'الإعدادات ← النقاط',
    tune1: 'غيّر أي قيمة، أو عطّل مصدراً، أو أضف مصادر خاصة بك.',
    tune2: 'أعد تسمية عوامل الجودة التي تقيّمها الرئاسة أو أضفها أو احذفها، واضبط سلّم التقييم.',
    tune3: 'مزج الترتيب يحدّد مقدار تأثير تلك التقييمات في الرقم النهائي.',
    tune4: 'إخفاء النقاط عن المندوبين يُبقي ملخّصهم ويزيل لوحة الصدارة.',
    blendInfo: 'الرقم النهائي هو مزيج من مجموع النقاط الموضوعي ودرجة الجودة من 0 إلى 100 المستمدة من تقييمات الرئاسة. عند 0% يكون الترتيب بالنقاط فقط، وعند 100% بالجودة فقط.',
    blendNow: (n: number) => n === 0
      ? 'القيمة الحالية 0% — تُسجَّل تقييمات الجودة لكنها لا تؤثر في الترتيب.'
      : `القيمة الحالية ${n}% — تشكّل تقييمات الجودة ${n}% من الرقم النهائي.`,
    coHead: 'المعلّقون يكتبون الملاحظات',
    coBody: 'رئيس واحد هو المشرف ويمسك المطرقة (منشئ اللجنة افتراضياً، ويمكن لأي رئيس أخذها من شارة المطرقة في أعلى يمين الجلسة). أما بقية الرؤساء على رمز الرئاسة نفسه فهم معلّقون، ويتحوّل عمودهم الأوسط إلى لوحة الملاحظات أدناه.',
    coBody2: 'يكتبون ملاحظة خاصة عن صاحب الكلمة ويقيّمونه وفق عوامل الجودة لديك. تظهر الملاحظات تحت ذلك الخطاب في لوحة النقاط وفي ملف CSV، وتغذّي التقييمات درجة الجودة.',
    mockCap: 'ما يراه المعلّق',
    mockLive: 'يتحدث الآن',
    mockNote: 'طرح قوي، واستشهد ببروتوكول 2019 مباشرة.',
    mockNext: 'حافظ على تماسك الكتلة طوال الحوار الحر.',
    mockPlaceholder: 'ملاحظة خاصة…',
    pts: 'نقطة',
  },
};

function ScoreboardTutorialCard({ committee, language, box }: {
  committee: Committee; language: string; box: DesignBox;
}) {
  const c = pick(language, SB_COPY);
  // Read the committee's REAL scoring config so every number on this page is the
  // chair's own, not an invented example.
  const cfg = getScoringConfig(committee);
  const sources = cfg.sources.filter((s) => s.enabled);
  const factors = cfg.factors.filter((f) => f.enabled).slice(0, 4);
  const blend = cfg.scoreBlend;

  // Real delegations for the mock, falling back to nothing rather than fiction.
  const sample = committee.delegates.slice(0, 2);
  const live = sample[0]?.country ?? '';
  const next = sample[1]?.country ?? '';
  const nameOf = (country: string) => (country ? getCountryDisplayName(country, language) : '—');
  const codeOf = (country: string) => getCountryByName(country)?.code ?? '';

  const H: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1B3828',
  };
  const P: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.55, color: '#6A5A4A' };

  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex flex-col"
      style={{
        maxWidth: 760, maxHeight: '100%',
        backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0',
        boxShadow: '0 32px 80px rgba(27,56,40,0.40)',
        fontFamily: "'Poppins','Outfit',sans-serif",
      }}
    >
      {/* Header — mirrors the real ScoreboardPanel header so it is recognisable */}
      <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ backgroundColor: '#1B3828' }}>
        <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: '#EED98A' }} />
        <span className="text-sm font-black tracking-wide" style={{ color: '#EED98A' }}>{c.title}</span>
        <span className="text-[11px] ms-auto truncate" style={{ color: 'rgba(246,241,233,0.62)' }}>{c.kicker}</span>
      </div>

      {/* Body */}
      <div className="tut-scroll flex-1 min-h-0 overflow-y-auto px-5 py-4" style={{ overscrollBehavior: 'contain' }}>
        <p style={{ ...P, marginBottom: 16 }}>{c.lead}</p>

        {/* ── How points are earned ── */}
        <div style={H}>{c.earnHead}</div>
        {sources.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sources.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
                style={{ border: '1px solid #DDD4C0', backgroundColor: '#FFFFFF' }}>
                <span style={{ fontSize: 11.5, color: '#1C1410' }}>{s.name}</span>
                <span className="font-mono font-bold" style={{ fontSize: 11, color: '#1B3828' }}>
                  {s.value > 0 ? '+' : ''}{s.value}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p style={{ ...P, marginTop: 6 }}>{c.earnEmpty}</p>
        )}
        <p style={{ ...P, marginTop: 8 }}>{c.earnFoot}</p>

        {/* ── Customisation ── */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid #DDD4C0' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={H}>{c.tuneHead}</span>
            <span className="rounded-md px-1.5 py-0.5 font-bold" style={{ fontSize: 10, backgroundColor: 'rgba(27,56,40,0.08)', color: '#1B3828' }}>
              {c.tuneWhere}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {[c.tune1, c.tune2, c.tune3, c.tune4].map((line, i) => (
              <li key={i} className="flex gap-2" style={P}>
                <span aria-hidden style={{ color: '#B6871F', fontWeight: 900, lineHeight: 1.55 }}>·</span>
                <span className="flex-1">
                  {line}
                  {i === 2 && (
                    <>
                      {' '}
                      <HoverInfo text={c.blendInfo} box={box} />
                      <span className="block mt-0.5 font-semibold" style={{ fontSize: 11.5, color: '#1B3828' }}>
                        {c.blendNow(blend)}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {factors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {factors.map((f) => (
                <span key={f.id} className="rounded-full px-2 py-0.5" style={{ fontSize: 10.5, border: '1px solid #DDD4C0', backgroundColor: '#EDE7D8', color: '#6A5A4A' }}>
                  {f.name} · 0–{Math.max(1, cfg.factorScaleMax)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Commenter feedback + sneak peek ── */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid #DDD4C0' }}>
          <div style={H}>{c.coHead}</div>
          <p style={{ ...P, marginTop: 6 }}>{c.coBody}</p>
          <p style={{ ...P, marginTop: 6 }}>{c.coBody2}</p>

          <FeedbackDockMock
            caption={c.mockCap}
            liveLabel={c.mockLive}
            placeholder={c.mockPlaceholder}
            note={c.mockNote}
            nextNote={c.mockNext}
            liveName={nameOf(live)} liveCode={codeOf(live)}
            nextName={nameOf(next)} nextCode={codeOf(next)}
            factors={factors.map((f) => f.name)}
            scaleMax={Math.max(1, cfg.factorScaleMax)}
          />
        </div>
      </div>
    </div>
  );
}

// A miniature, non-interactive replica of FeedbackLogPanel: the focused white
// writing bubble (radius 22, amber focus ring, private-note textarea) with its 2×2
// factor grid, above a collapsed capsule (height 54 → 38, radius 9999, #EDE7D8)
// carrying the note the Commenter already wrote and the ✓ scored marker. Same tokens,
// reduced scale — so it stays true if the real panel is restyled around these values.
function FeedbackDockMock({
  caption, liveLabel, placeholder, note, nextNote,
  liveName, liveCode, nextName, nextCode, factors, scaleMax,
}: {
  caption: string; liveLabel: string; placeholder: string; note: string; nextNote: string;
  liveName: string; liveCode: string; nextName: string; nextCode: string;
  factors: string[]; scaleMax: number;
}) {
  // Illustrative ratings, shown as proportions of the committee's own scale.
  const demo = [0.82, 0.68, 0.9, 0.74];
  // Reserved width of the 2×2 factor grid, mirroring FeedbackLogPanel's own GRID_COL
  // (280 there) at this page's reduced scale. Both rows use it so the pills line up.
  const GRID_W = 184;

  const grid = (interactive: boolean) => (
    // `minmax(0,1fr)` (not `1fr`): a grid item defaults to min-width:auto, so a long
    // factor name like "Content & Research" would refuse to shrink and push the whole
    // grid past the mock's padded box instead of truncating inside it.
    <div className="grid gap-x-3 gap-y-1 shrink-0" style={{ width: GRID_W, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
      {factors.slice(0, 4).map((f, i) => {
        const pct = demo[i % demo.length];
        const v = Math.round(pct * scaleMax);
        if (!interactive) {
          return (
            <div key={f} className="flex items-center gap-1 min-w-0">
              <span className="truncate flex-1 min-w-0" style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#B8AE9C' }}>{f}</span>
              <span className="shrink-0 font-bold" style={{ fontSize: 9, color: '#9A8A78' }}>{v}</span>
            </div>
          );
        }
        return (
          <div key={f} className="min-w-0">
            <div className="flex items-baseline justify-between gap-1 min-w-0">
              <span className="truncate min-w-0 font-bold" style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6A5A4A' }}>{f}</span>
              <span className="shrink-0 font-black" style={{ fontSize: 9.5, color: '#1B3828' }}>{v}</span>
            </div>
            {/* Static stand-in for the real range input */}
            <div className="relative" style={{ height: 10 }}>
              <div className="absolute" style={{ insetInlineStart: 0, insetInlineEnd: 0, top: 4, height: 3, borderRadius: 999, backgroundColor: '#DDD4C0' }} />
              <div className="absolute" style={{ insetInlineStart: 0, width: `${pct * 100}%`, top: 4, height: 3, borderRadius: 999, backgroundColor: '#1B3828' }} />
              <div className="absolute" style={{ insetInlineStart: `calc(${pct * 100}% - 4px)`, top: 1, width: 9, height: 9, borderRadius: 999, backgroundColor: '#1B3828' }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <figure className="mt-3 mb-0 mx-0">
      <div className="rounded-xl px-3 py-3" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0' }}>
        {/* Focused, live writing bubble */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex-1 min-w-0"
            style={{
              borderRadius: 16, backgroundColor: '#FFFFFF',
              border: '1px solid rgba(221,212,192,0.85)',
              boxShadow: '0 0 0 2px #B8844A, 0 10px 26px rgba(28,20,16,0.16)',
              padding: '8px 11px',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-black" style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1B3828' }}>GSL</span>
              <FlagImg code={liveCode} size={18} className="shrink-0" />
              <span className="flex-1 min-w-0 truncate font-bold" style={{ fontSize: 12, color: '#1C1410' }}>{liveName}</span>
              <span className="shrink-0 font-bold" style={{ fontSize: 8.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#B8844A' }}>{liveLabel}</span>
            </div>
            <div
              className="mt-1.5 rounded-lg px-2 py-1.5"
              style={{ backgroundColor: '#FAF8F3', border: '1px solid #EDE7D8', minHeight: 30 }}
            >
              <span style={{ fontSize: 10.5, color: '#1C1410' }}>{note}</span>
              <span className="block" style={{ fontSize: 10, color: '#C8BAA8' }}>{placeholder}</span>
            </div>
          </div>
          {factors.length > 0 && grid(true)}
        </div>

        {/* Collapsed capsule for the next speaker */}
        <div className="flex items-center gap-2.5 mt-1.5">
          <div
            className="flex-1 min-w-0 flex items-center gap-2"
            style={{
              height: 38, borderRadius: 9999, backgroundColor: '#EDE7D8',
              border: '1px solid rgba(221,212,192,0.85)',
              boxShadow: '0 3px 12px rgba(28,20,16,0.07)',
              padding: '0 14px', opacity: 0.72,
            }}
          >
            <FlagImg code={nextCode} size={15} className="shrink-0" />
            <span className="shrink-0 font-semibold" style={{ fontSize: 11, color: '#1C1410' }}>{nextName}</span>
            <span className="flex-1 min-w-0 truncate" style={{ fontSize: 10.5, color: '#6A5A4A' }}>— {nextNote}</span>
            <span className="shrink-0 font-black" style={{ fontSize: 11, color: '#1B3828' }}>✓</span>
          </div>
          {factors.length > 0 && <div className="shrink-0" style={{ width: GRID_W, opacity: 0.72 }}>{grid(false)}</div>}
        </div>
      </div>
      <figcaption className="mt-1.5 text-center" style={{ fontSize: 10, color: '#9A8A78' }}>{caption}</figcaption>
    </figure>
  );
}
