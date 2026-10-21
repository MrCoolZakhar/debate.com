'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import Portal from '@/components/Portal';
import { Clapperboard } from 'lucide-react';
import YouTubeClickToLoad, { CHAIR_GUIDE_VIDEO_ID, CHAIR_GUIDE_THUMB } from '@/components/YouTubeClickToLoad';
import type { Committee } from '@/lib/types';
import { docName } from '@/lib/docNames';
import { useT, useLanguage } from '@/contexts/LanguageContext';

interface Props {
  committee: Committee;
  onEnd: () => void;
  onStepId?: (id: string) => void;
}

// ─── The first card's videos ─────────────────────────────────────────────────
// The chair guide is the /sessions video (CHAIR_GUIDE_VIDEO_ID in YouTubeClickToLoad).
// The delegate and faculty advisor guides are PENDING Peter's YouTube ids (21 Oct 2026):
// set an id here and its small slot appears under the chair guide. A thumbnail is optional
// and must be our own copy in public/ (e.g. '/sessions/delegate-thumb.webp'), never a
// YouTube image URL (CLAUDE.md §3); without one the slot is a plain forest poster.
const DELEGATE_VIDEO_ID = null as string | null;
const DELEGATE_VIDEO_THUMB = null as string | null;
const ADVISOR_VIDEO_ID = null as string | null;
const ADVISOR_VIDEO_THUMB = null as string | null;

type StepKind = 'questionnaire' | 'spotlight' | 'action' | 'goodbye';

/** One step's words (owner, 21 Oct 2026: "bullet points in some parts would be better"):
 *  one short title, then one to four short points in plain words. */
interface StepCopy {
  title: string;
  points: React.ReactNode[];
}

interface TutorialStep {
  id: string;
  kind: StepKind;
  otterImage: string;
  /** Spotlight and action steps: a title and short points. */
  copy?: StepCopy;
  /** The goodbye slide's one paragraph. */
  bubbleText?: React.ReactNode;
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
function pick<T>(language: string, m: { en: T; es: T; fr: T; ar: T; pt: T }): T {
  return (m as unknown as Record<string, T>)[language] ?? m.en;
}

/** A step's copy: the title, then its points. */
const c = (title: string, ...points: React.ReactNode[]): StepCopy => ({ title, points });

// ─── Rich text helpers ────────────────────────────────────────────────────────
const G  = (t: string) => <span style={{ color: '#B6871F', fontWeight: 700 }}>{t}</span>; // gold
const GR = (t: string) => <span style={{ color: '#2A5A3C', fontWeight: 700 }}>{t}</span>; // green
/** A control's name inside a point: bold ink, nothing else. */
const K  = (t: string) => <strong style={{ fontWeight: 700, color: '#1B3828' }}>{t}</strong>;

/** Chair-renameable document labels, already resolved + locale-defaulted via
 *  `docName()`. Passed in so the tutorial never hardcodes "Working Paper" /
 *  "Draft Resolution": a committee that renamed them must read consistently. */
interface DocLabels {
  wpPlural: string;
  drPlural: string;
  wpSingular: string;
  drSingular: string;
}

function getSteps(language: string, docs: DocLabels): TutorialStep[] {
  const { wpPlural: wp, drPlural: dr, wpSingular: wpS, drSingular: drS } = docs;
  return [
    {
      id: 'questionnaire', kind: 'questionnaire',
      otterImage: '/Otter.Tutorial.Intro.webp',
    },
    {
      id: 'welcome', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: [],
      copy: pick(language, {
        en: c('Your committee room',
          'Speakers, timers, motions, voting, chat and documents, all on one screen.',
          'Built to run the whole session, from the first gavel to the last.',
          <>Click anywhere or press {K('Next')} to keep going.</>),
        es: c('Tu sala de comité',
          'Oradores, cronómetros, mociones, votaciones, chat y documentos, todo en una pantalla.',
          'Hecha para dirigir toda la sesión, del primer mazazo al último.',
          <>Haz clic en cualquier sitio o pulsa {K('Siguiente')} para seguir.</>),
        fr: c('Votre salle de comité',
          'Orateurs, chronomètres, motions, votes, chat et documents, sur un seul écran.',
          'Conçue pour mener toute la séance, du premier coup de maillet au dernier.',
          <>Cliquez n&apos;importe où ou appuyez sur {K('Suivant')} pour continuer.</>),
        ar: c('قاعة لجنتك',
          'المتحدثون والمؤقّتات والاقتراحات والتصويت والمحادثة والمستندات، كلها على شاشة واحدة.',
          'مصمَّمة لإدارة الجلسة كاملةً، من أول ضربة مطرقة إلى آخرها.',
          <>انقر في أي مكان أو اضغط {K('التالي')} للمتابعة.</>),
        pt: c('Sua sala de comitê',
          'Oradores, cronômetros, moções, votações, chat e documentos, tudo em uma tela.',
          'Feita para conduzir a sessão inteira, da primeira batida do martelo à última.',
          <>Clique em qualquer lugar ou pressione {K('Próximo')} para continuar.</>),
      }),
    },
    {
      id: 'speakers-bottom-bar', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['speakers-bottom-bar'], spotlightRadius: 12,
      copy: pick(language, {
        en: c('Add speakers',
          'This bar adds delegations to the speakers list.',
          <>Type a country name and press {K('Enter')}.</>),
        es: c('Añadir oradores',
          'Esta barra añade delegaciones a la lista de oradores.',
          <>Escribe el nombre de un país y pulsa {K('Enter')}.</>),
        fr: c('Ajouter des orateurs',
          'Cette barre ajoute des délégations à la liste des orateurs.',
          <>Tapez le nom d&apos;un pays et appuyez sur {K('Entrée')}.</>),
        ar: c('إضافة متحدثين',
          'يضيف هذا الشريط الوفود إلى قائمة المتحدثين.',
          <>اكتب اسم دولة ثم اضغط {K('Enter')}.</>),
        pt: c('Adicionar oradores',
          'Esta barra adiciona delegações à lista de oradores.',
          <>Digite o nome de um país e pressione {K('Enter')}.</>),
      }),
    },
    {
      id: 'speakers-action', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['speakers-bottom-bar', 'speakers-sidebar', 'speakers-autocomplete'],
      spotlightRadius: 12,
      copy: pick(language, {
        en: c('Try it: add 3 countries',
          <>Type a country in the bar below and press {K('Enter')}.</>,
          'Or click a delegation in the sidebar.',
          'The tour moves on once 3 are on the list.'),
        es: c('Pruébalo: añade 3 países',
          <>Escribe un país en la barra de abajo y pulsa {K('Enter')}.</>,
          'O haz clic en una delegación de la barra lateral.',
          'El recorrido sigue cuando haya 3 en la lista.'),
        fr: c('Essayez : ajoutez 3 pays',
          <>Tapez un pays dans la barre ci-dessous et appuyez sur {K('Entrée')}.</>,
          'Ou cliquez sur une délégation dans le panneau latéral.',
          'La visite continue dès que 3 sont sur la liste.'),
        ar: c('جرّبها: أضف 3 دول',
          <>اكتب اسم دولة في الشريط أدناه واضغط {K('Enter')}.</>,
          'أو انقر على وفد في اللوحة الجانبية.',
          'تتابع الجولة بمجرد وجود 3 في القائمة.'),
        pt: c('Experimente: adicione 3 países',
          <>Digite um país na barra abaixo e pressione {K('Enter')}.</>,
          'Ou clique em uma delegação na barra lateral.',
          'O tour continua quando houver 3 na lista.'),
      }),
      actionDone: (cm) => cm.speakersList.length >= 3,
    },
    {
      id: 'call-first-speaker', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['call-first-speaker'], spotlightRadius: 14,
      copy: pick(language, {
        en: c('Give the floor',
          'The first delegation on the list is already waiting, clock set.',
          <>Press {K('Start')} to give them the floor and run the timer.</>),
        es: c('Dar la palabra',
          'La primera delegación de la lista ya está esperando, con el reloj listo.',
          <>Pulsa {K('Iniciar')} para darle la palabra y arrancar el cronómetro.</>),
        fr: c('Donner la parole',
          'La première délégation de la liste attend déjà, chronomètre réglé.',
          <>Appuyez sur {K('Démarrer')} pour lui donner la parole et lancer le chronomètre.</>),
        ar: c('إعطاء الكلمة',
          'الوفد الأول في القائمة ينتظر بالفعل، ومؤقّته جاهز.',
          <>اضغط {K('بدء')} لتمنحه الكلمة وتشغّل المؤقّت.</>),
        pt: c('Dar a palavra',
          'A primeira delegação da lista já está esperando, com o cronômetro ajustado.',
          <>Pressione {K('Iniciar')} para dar a palavra e disparar o cronômetro.</>),
      }),
      actionDone: (cm) => !!cm.currentSpeaker,
    },
    {
      id: 'timer', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['timer'], spotlightRadius: 12,
      copy: pick(language, {
        en: c('The speaking timer',
          'Counts down for the delegation speaking.',
          <>Turns {G('amber')} in the last 10 seconds.</>,
          <>{GR('Click the clock itself')} to start or pause it.</>),
        es: c('El cronómetro',
          'Cuenta hacia atrás para la delegación que habla.',
          <>Se vuelve {G('ámbar')} en los últimos 10 segundos.</>,
          <>{GR('Haz clic en el propio reloj')} para iniciarlo o pausarlo.</>),
        fr: c('Le chronomètre',
          'Décompte le temps de la délégation qui parle.',
          <>Passe à l&apos;{G('ambre')} dans les 10 dernières secondes.</>,
          <>{GR('Cliquez sur le chronomètre lui-même')} pour le lancer ou le mettre en pause.</>),
        ar: c('مؤقّت الكلام',
          'يعدّ تنازلياً للوفد المتحدث.',
          <>يتحوّل إلى {G('الكهرماني')} في آخر 10 ثوانٍ.</>,
          <>{GR('انقر على المؤقّت نفسه')} لتشغيله أو إيقافه مؤقتاً.</>),
        pt: c('O cronômetro',
          'Faz a contagem regressiva da delegação com a palavra.',
          <>Fica {G('âmbar')} nos últimos 10 segundos.</>,
          <>{GR('Clique no próprio cronômetro')} para iniciá-lo ou pausá-lo.</>),
      }),
    },
    {
      id: 'add-time', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['add-time-button'], spotlightRadius: 12,
      copy: pick(language, {
        en: c('More time',
          <>{K('Add time')} (the clock icon) gives 15, 30 or 60 seconds, or any amount you type.</>,
          <>It works before {K('Start')} too, for a longer first slot.</>,
          <>{K('↺')} restarts the clock at the full speaking time.</>),
        es: c('Más tiempo',
          <>{K('Añadir tiempo')} (el icono de reloj) da 15, 30 o 60 segundos, o lo que escribas.</>,
          <>También funciona antes de {K('Iniciar')}, para un primer turno más largo.</>,
          <>{K('↺')} reinicia el reloj con el tiempo completo.</>),
        fr: c('Plus de temps',
          <>{K('Ajouter du temps')} (l&apos;icône horloge) donne 15, 30 ou 60 secondes, ou la durée que vous tapez.</>,
          <>Cela marche aussi avant {K('Démarrer')}, pour un premier tour plus long.</>,
          <>{K('↺')} remet le chronomètre au temps de parole complet.</>),
        ar: c('وقت إضافي',
          <>زر {K('إضافة وقت')} (أيقونة الساعة) يمنح 15 أو 30 أو 60 ثانية، أو أي مقدار تكتبه.</>,
          <>يعمل أيضاً قبل الضغط على {K('بدء')}، لمدّة أولى أطول.</>,
          <>يعيد {K('↺')} المؤقّت إلى مدّة الكلام الكاملة.</>),
        pt: c('Mais tempo',
          <>{K('Adicionar tempo')} (o ícone de relógio) dá 15, 30 ou 60 segundos, ou o valor que você digitar.</>,
          <>Também funciona antes de {K('Iniciar')}, para um primeiro turno mais longo.</>,
          <>{K('↺')} reinicia o cronômetro com o tempo de discurso completo.</>),
      }),
    },
    {
      id: 'rtr', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['rtr-button'], spotlightRadius: 12,
      copy: pick(language, {
        en: c('Right to Reply',
          'Gives a delegation its own timer to answer.',
          'The speakers list stays exactly as it is, so nobody loses their place.'),
        es: c('Derecho a Réplica',
          'Da a una delegación su propio cronómetro para responder.',
          'La lista de oradores no cambia, así que nadie pierde su lugar.'),
        fr: c('Droit de Réponse',
          'Donne à une délégation son propre chronomètre pour répondre.',
          'La liste des orateurs ne bouge pas, personne ne perd sa place.'),
        ar: c('حق الرد',
          'يمنح الوفد مؤقّتاً خاصاً به للردّ.',
          'تبقى قائمة المتحدثين كما هي، فلا يفقد أحد مكانه.'),
        pt: c('Direito de Réplica',
          'Dá a uma delegação um cronômetro próprio para responder.',
          'A lista de oradores fica igual, então ninguém perde o lugar.'),
      }),
    },
    {
      id: 'tab-rollcall', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-rollcall'], spotlightRadius: 6,
      copy: pick(language, {
        en: c('Roll Call',
          <>Mark each delegation {K('Absent')}, {K('Present')} or {K('Present and voting')} with one tap.</>,
          'Update attendance at any point in the session.'),
        es: c('Lista de Asistencia',
          <>Marca cada delegación como {K('Ausente')}, {K('Presente')} o {K('Presente y votante')} con un toque.</>,
          'Actualiza la asistencia en cualquier momento de la sesión.'),
        fr: c('Appel',
          <>Marquez chaque délégation {K('Absente')}, {K('Présente')} ou {K('Présente et votante')} d&apos;un seul geste.</>,
          'Mettez la présence à jour à tout moment de la séance.'),
        ar: c('تدقيق الحضور',
          <>حدّد كل وفد {K('غائباً')} أو {K('حاضراً')} أو {K('حاضراً ومصوّتاً')} بنقرة واحدة.</>,
          'حدّث الحضور في أي وقت أثناء الجلسة.'),
        pt: c('Chamada',
          <>Marque cada delegação como {K('Ausente')}, {K('Presente')} ou {K('Presente e votante')} com um toque.</>,
          'Atualize a presença a qualquer momento da sessão.'),
      }),
    },
    {
      id: 'seat-add', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['seat-add'], spotlightRadius: 999,
      copy: pick(language, {
        en: c('Add a seat',
          'Somebody missing? Type any country or name in this box.',
          <>{K('Enter')} adds them as present.</>,
          <>{K('Shift + Enter')} adds them as an observer.</>),
        es: c('Añadir un asiento',
          '¿Falta alguien? Escribe cualquier país o nombre en esta caja.',
          <>{K('Enter')} lo añade como presente.</>,
          <>{K('Shift + Enter')} lo añade como observador.</>),
        fr: c('Ajouter un siège',
          'Quelqu’un manque ? Tapez n’importe quel pays ou nom dans cette case.',
          <>{K('Entrée')} l&apos;ajoute présent.</>,
          <>{K('Maj + Entrée')} l&apos;ajoute comme observateur.</>),
        ar: c('إضافة مقعد',
          'ينقص أحدهم؟ اكتب اسم أي دولة أو أي اسم في هذا الصندوق.',
          <>يضيفه {K('Enter')} حاضراً.</>,
          <>ويضيفه {K('Shift + Enter')} مراقباً.</>),
        pt: c('Adicionar assento',
          'Falta alguém? Digite qualquer país ou nome nesta caixa.',
          <>{K('Enter')} adiciona como presente.</>,
          <>{K('Shift + Enter')} adiciona como observador.</>),
      }),
    },
    {
      id: 'tab-motions', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-motions'], spotlightRadius: 6,
      copy: pick(language, {
        en: c('Motions',
          'When a delegate raises their placard, you enter the motion here and pick who proposed it.',
          'Moderated and unmoderated caucuses, Tour de Table, Consultation of the Whole.',
          <>{K('Suspend')} and {K('close debate')} are here too.</>),
        es: c('Mociones',
          'Cuando un delegado levanta su placa, registras la moción aquí y eliges quién la propuso.',
          'Cáucus moderado y no moderado, Round Robin, Consulta de Gabinete.',
          <>{K('Suspender')} y {K('cerrar el debate')} también están aquí.</>),
        fr: c('Motions',
          'Quand un délégué lève sa pancarte, vous saisissez la motion ici et choisissez qui la propose.',
          'Caucus modéré et non modéré, Tour de table, Consultation de l’assemblée.',
          <>{K('Suspendre')} et {K('clore le débat')} se font ici aussi.</>),
        ar: c('الاقتراحات',
          'عندما يرفع مندوب لافتته، تُدخل الاقتراح هنا وتختار من اقترحه.',
          'حوار منهجي وحرّ، وجولة متحدثين، ومشاورات الهيئة.',
          <>{K('تعليق')} النقاش و{K('إنهاؤه')} من هنا أيضاً.</>),
        pt: c('Moções',
          'Quando uma delegação levanta a placa, você registra a moção aqui e escolhe quem a propôs.',
          'Debate Moderado e Não Moderado, Tour de Table, Consulta Plenária.',
          <>{K('Suspender')} e {K('encerrar o debate')} também ficam aqui.</>),
      }),
    },
    {
      id: 'tab-documents', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-documents'], spotlightRadius: 6,
      copy: pick(language, {
        en: c('Documents',
          <>{K(wp)} and {K(dr)} that delegates submit arrive here.</>,
          <>{K('Introduce')} runs the Reading, Presentation and Q&amp;A stages on your screen.</>,
          <>A {wpS} passes after that. A {drS} goes to the voting page.</>,
          'Vote from the dais, or let delegations vote on their own phones.'),
        es: c('Documentos',
          <>Aquí llegan {K(wp)} y {K(dr)} que envían los delegados.</>,
          <>{K('Introducir')} lanza las etapas de Lectura, Presentación y Preguntas en tu pantalla.</>,
          <>Después, cada {wpS} se aprueba y cada {drS} pasa a la página de votación.</>,
          'Vota desde la mesa o deja que las delegaciones voten desde su teléfono.'),
        fr: c('Documents',
          <>Les {K(wp)} et {K(dr)} soumis par les délégués arrivent ici.</>,
          <>{K('Introduire')} lance les étapes Lecture, Présentation et Q&amp;R sur votre écran.</>,
          <>Ensuite, chaque {wpS} est adopté et chaque {drS} part vers la page de vote.</>,
          'Votez depuis la tribune, ou laissez les délégations voter sur leur téléphone.'),
        ar: c('المستندات',
          <>تصل هنا {K(wp)} و{K(dr)} التي يقدّمها المندوبون.</>,
          <>زر {K('تقديم')} يشغّل مراحل القراءة والعرض والأسئلة على شاشتك.</>,
          <>بعدها تُعتمد {wpS}، وينتقل {drS} إلى صفحة التصويت.</>,
          'صوّت من المنصّة، أو دع الوفود تصوّت من هواتفها.'),
        pt: c('Documentos',
          <>Aqui chegam {K(wp)} e {K(dr)} enviados pelas delegações.</>,
          <>{K('Introduzir')} conduz as etapas de Leitura, Apresentação e Perguntas na sua tela.</>,
          <>Depois, cada {wpS} é aprovado e cada {drS} segue para a página de votação.</>,
          'Vote pela Mesa ou deixe as delegações votarem no próprio celular.'),
      }),
    },
    {
      id: 'tab-chat', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-chat'], spotlightRadius: 6,
      copy: pick(language, {
        en: c('Chat',
          'Message every delegate at once, or one delegation privately.',
          'Keep it open on your own device, not the room’s main screen.'),
        es: c('Chat',
          'Escribe a todos los delegados a la vez o a una delegación en privado.',
          'Tenlo abierto en tu propio dispositivo, no en la pantalla principal de la sala.'),
        fr: c('Chat',
          'Écrivez à tous les délégués à la fois, ou à une délégation en privé.',
          'Gardez-le ouvert sur votre propre appareil, pas sur l’écran principal de la salle.'),
        ar: c('المحادثة',
          'راسل جميع المندوبين دفعة واحدة، أو وفداً واحداً على انفراد.',
          'أبقها مفتوحة على جهازك الشخصي، لا على شاشة القاعة الرئيسية.'),
        pt: c('Chat',
          'Envie mensagem a todas as delegações de uma vez, ou a uma delegação em particular.',
          'Deixe-o aberto no seu próprio dispositivo, não na tela principal da sala.'),
      }),
    },
    {
      id: 'tab-settings', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-settings'], spotlightRadius: 6,
      copy: pick(language, {
        en: c('Settings',
          <>{K('Access')}: the session code, the chair password and what delegates may do.</>,
          <>{K('Motions')}: turn motions on or off, reorder and rename them.</>,
          <>{K('Voting')}: quorum, majorities and veto.</>,
          <>{K('Points')} and {K('People')}: what scores, and who is connected right now.</>),
        es: c('Configuración',
          <>{K('Acceso')}: el código de sesión, la contraseña de presidencia y qué pueden hacer los delegados.</>,
          <>{K('Mociones')}: activa, ordena y renombra las mociones.</>,
          <>{K('Votación')}: cuórum, mayorías y veto.</>,
          <>{K('Puntos')} y {K('Personas')}: qué puntúa y quién está conectado ahora.</>),
        fr: c('Paramètres',
          <>{K('Accès')} : le code de session, le mot de passe de présidence et ce que les délégués peuvent faire.</>,
          <>{K('Motions')} : activez, réordonnez et renommez les motions.</>,
          <>{K('Vote')} : quorum, majorités et veto.</>,
          <>{K('Points')} et {K('Personnes')} : ce qui rapporte des points, et qui est connecté en ce moment.</>),
        ar: c('الإعدادات',
          <>{K('الوصول')}: رمز الجلسة وكلمة مرور الرئاسة وما يُسمح للمندوبين بفعله.</>,
          <>{K('الاقتراحات')}: فعّلها أو أوقفها، ورتّبها وأعد تسميتها.</>,
          <>{K('التصويت')}: النِّصاب والأغلبيات وحق النقض.</>,
          <>{K('النقاط')} و{K('الأشخاص')}: ما يمنح النقاط، ومن المتصل الآن.</>),
        pt: c('Configurações',
          <>{K('Acesso')}: o código da sessão, a senha da Mesa e o que as delegações podem fazer.</>,
          <>{K('Moções')}: ative, reordene e renomeie as moções.</>,
          <>{K('Votação')}: quórum, maiorias e veto.</>,
          <>{K('Pontos')} e {K('Pessoas')}: o que vale pontos e quem está conectado agora.</>),
      }),
    },
    {
      // 21 Oct 2026 (owner): the old full-page scoreboard explainer was too long. Now a
      // step like every other: the trophy lit, a short title and two points.
      id: 'scoreboard', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-scoreboard'], spotlightRadius: 12,
      copy: pick(language, {
        en: c('Scoreboard',
          'Every delegation, ranked live.',
          <>Points add up on their own. Choose what scores in {GR('Settings → Points')}.</>),
        es: c('Marcador',
          'Todas las delegaciones, clasificadas en vivo.',
          <>Los puntos se suman solos. Elige qué puntúa en {GR('Configuración → Puntos')}.</>),
        fr: c('Tableau des scores',
          'Toutes les délégations, classées en direct.',
          <>Les points s&apos;ajoutent tout seuls. Choisissez ce qui compte dans {GR('Paramètres → Points')}.</>),
        ar: c('لوحة النقاط',
          'كل الوفود مرتّبة لحظياً.',
          <>تُحتسب النقاط تلقائياً. اختر ما يمنح النقاط من {GR('الإعدادات ← النقاط')}.</>),
        pt: c('Placar',
          'Todas as delegações, classificadas ao vivo.',
          <>Os pontos entram sozinhos. Escolha o que vale pontos em {GR('Configurações → Pontos')}.</>),
      }),
    },
    {
      id: 'join-code', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['join-code'], spotlightRadius: 8,
      copy: pick(language, {
        en: c('Your session code',
          <>{GR('Click it')} to show the code and a QR code to the whole room, or to copy it.</>,
          <>Delegates enter it at {G('gavelling.com')} to join.</>,
          <>Chairs joining the dais need the 4-digit chair password, in {GR('Settings → Access')}.</>),
        es: c('Tu código de sesión',
          <>{GR('Haz clic')} para mostrar el código y un código QR a toda la sala, o para copiarlo.</>,
          <>Los delegados lo escriben en {G('gavelling.com')} para unirse.</>,
          <>Las presidencias que se unen a la mesa necesitan la contraseña de 4 dígitos, en {GR('Configuración → Acceso')}.</>),
        fr: c('Votre code de session',
          <>{GR('Cliquez dessus')} pour afficher le code et un QR code à toute la salle, ou pour le copier.</>,
          <>Les délégués le saisissent sur {G('gavelling.com')} pour rejoindre.</>,
          <>Les présidents qui rejoignent le présidium ont besoin du mot de passe à 4 chiffres, dans {GR('Paramètres → Accès')}.</>),
        ar: c('رمز جلستك',
          <>{GR('انقر عليه')} لعرض الرمز ورمز QR أمام القاعة كلها، أو لنسخه.</>,
          <>يُدخله المندوبون في {G('gavelling.com')} للانضمام.</>,
          <>يحتاج الرؤساء المنضمون إلى المنصة كلمة مرور الرئاسة من 4 أرقام، في {GR('الإعدادات ← الوصول')}.</>),
        pt: c('Seu código da sessão',
          <>{GR('Clique nele')} para mostrar o código e um QR code para a sala toda, ou para copiá-lo.</>,
          <>As delegações o digitam em {G('gavelling.com')} para entrar.</>,
          <>Os membros da Mesa precisam da senha de 4 dígitos, em {GR('Configurações → Acesso')}.</>),
      }),
    },
    {
      id: 'goodbye', kind: 'goodbye',
      otterImage: '/Otter.Tutorial.Outro.webp',
      bubbleText: pick(language, {
        ar: <>استمتع بالاستكشاف! وزوّدنا دائماً بـ {G('ملاحظاتك')}، فهكذا يتحسّن Gavelling. راسلنا على إنستغرام {GR('@wearegavelling')} في أي وقت.</>,
        fr: <>Amusez-vous à explorer ! Et donnez-nous toujours votre {G('avis')}, c&apos;est comme ça que Gavelling s&apos;améliore. Écrivez-nous sur IG {GR('@wearegavelling')} à tout moment.</>,
        es: <>¡Diviértete explorando! Y siempre {G('danos tu opinión')}, así mejora Gavelling. Escríbenos en IG {GR('@wearegavelling')} cuando quieras.</>,
        pt: <>Divirta-se explorando! E sempre {G('mande sua opinião')}, é assim que o Gavelling melhora. Fale com a gente no Instagram {GR('@wearegavelling')} quando quiser.</>,
        en: <>Have fun exploring! And always {G('give us feedback')}, it&apos;s how Gavelling gets better. Text us on IG {GR('@wearegavelling')} any time.</>,
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
//
// `avoid` is measured alongside: the chair's whole top bar, which the step's callout
// must never sit on (it would cover the tab or icon being explained, or its neighbours).
const AVOID_TARGETS = ['topbar'];

function useSpotlight(targets: string[] = []) {
  const key = targets.join(',');
  const [state, setState] = useState<{ box: DesignBox; rects: (Rect | null)[]; avoid: Rect[] }>({ box: IDENTITY, rects: [], avoid: [] });
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
      const measure = (tName: string): Rect | null => {
        const el = document.querySelector(`[data-tutorial="${tName}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        // A zero-area element is present but not laid out (collapsed panel,
        // display:contents parent) — treat it as absent so we do not punch a
        // degenerate hole.
        if (r.width <= 0 || r.height <= 0) return null;
        return toDesign(r, box);
      };
      const rects = list.map(measure);
      const avoid = AVOID_TARGETS.map(measure).filter((r): r is Rect => !!r);
      // Re-render only when something actually moved: this runs every frame.
      const sigOf = (r: Rect | null) => (r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : 'x');
      const sig = `${box.w}|${box.h}|${box.scale}|${box.left}|${box.top}|` +
        rects.map(sigOf).join(';') + '|' + avoid.map(sigOf).join(';');
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setState({ box, rects, avoid });
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
  const { box, rects: spotlightRects, avoid: avoidRects } = useSpotlight(step.spotlightTargets);
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
      // Enter / Space on a focused button is that button's own press (Back, Skip tutorial,
      // a video's play button), never "next step" on top of it.
      if ((e.key === 'Enter' || e.key === ' ') && el?.closest('button')) return;
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
  // 21 Oct 2026 (owner): "way too small, Gavin is too small, way too little text. Like the
  // YouTube video on the Sessions page, let people watch it directly from there." A wide
  // card: Gavin standing on its top edge over the words and the two buttons, the chair
  // guide video big beside them (click to load, nothing from YouTube before the press), and
  // under it a small slot each for the delegate and faculty advisor videos, drawn only once
  // their ids are set (DELEGATE_VIDEO_ID / ADVISOR_VIDEO_ID). Fits 1280x800 without
  // scrolling with both slots; a narrow window stacks the two columns and the card scrolls.
  if (step.kind === 'questionnaire') {
    const narrow = box.w > 0 && box.w < INTRO_CARD.minWideW;
    const extraVideos = [
      { id: DELEGATE_VIDEO_ID, thumb: DELEGATE_VIDEO_THUMB, label: t('tutorial_video_delegates') },
      { id: ADVISOR_VIDEO_ID, thumb: ADVISOR_VIDEO_THUMB, label: t('tutorial_video_advisors') },
    ].filter((v): v is { id: string; thumb: string | null; label: string } => !!v.id);
    // Gavin stands over the middle of the words column (the inline-start column), or the
    // middle of the card when the columns stack.
    const otterStart = narrow ? undefined : INTRO_CARD.pad + INTRO_CARD.textW / 2 - INTRO_OTTER.size / 2;
    return (
      <Portal><div className="fixed inset-0 z-[9990] flex items-center justify-center p-6"
        style={{ background: 'rgba(27,56,40,0.88)', backdropFilter: 'blur(4px)' }}>
        <div role="dialog" aria-modal="true" aria-labelledby="tut-q-title"
          className="relative w-full flex flex-col"
          style={{ maxWidth: narrow ? 560 : INTRO_CARD.maxW, maxHeight: '100%', paddingTop: INTRO_OTTER.above }}>
          {/* Drawn OUTSIDE the card box (this wrapper does not clip), so the card keeps no
              space for him inside and nothing is unclipped for him. */}
          <img src="/Otter.Tutorial.Intro.webp" alt="" aria-hidden draggable={false}
            className="absolute select-none pointer-events-none"
            style={{
              top: 0, zIndex: 1,
              ...(otterStart === undefined
                ? { left: '50%', transform: 'translateX(-50%)' }
                : { insetInlineStart: otterStart }),
              width: INTRO_OTTER.size, height: INTRO_OTTER.size, objectFit: 'contain',
              filter: 'drop-shadow(0 10px 18px rgba(18,42,29,0.30))',
            }} />
          <div className="tut-scroll min-h-0 overflow-y-auto overscroll-contain"
            style={{
              display: 'grid',
              gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : `${INTRO_CARD.textW}px minmax(0, 1fr)`,
              gap: narrow ? 22 : 30,
              borderRadius: 30,
              backgroundColor: '#FFFFFF',
              padding: INTRO_CARD.pad,
              boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 28px 70px rgba(18,42,29,0.40)',
            }}>
            {/* Words and buttons. The top padding is where Gavin's feet overlap the card. */}
            <div className={`flex flex-col ${narrow ? 'items-center text-center' : ''}`}
              style={{ paddingTop: INTRO_OTTER.size - INTRO_OTTER.above - INTRO_CARD.pad + 18 }}>
              <h2 id="tut-q-title" className="text-[30px] font-extrabold text-[#1C1410] tracking-tight leading-[1.12] [text-wrap:balance]">
                {t('tutorial_have_you_used')}
              </h2>
              <p className="mt-3 text-[16px] leading-[1.6] text-[#5A5046] [text-wrap:pretty]">{t('tutorial_gavin_prepared')}</p>
              <div className="mt-6 flex w-full flex-col gap-2.5" style={{ marginTop: narrow ? 22 : 'auto' }}>
                <button type="button" onClick={advance}
                  className={`${PRIMARY_BTN} w-full py-3.5 text-[16px]`}
                  style={PRIMARY_BTN_STYLE}>
                  {t('tutorial_show_me')}
                </button>
                <button type="button" onClick={onEnd}
                  className={`${SECONDARY_BTN} w-full py-3.5 text-[16px]`}>
                  {t('tutorial_skip')}
                </button>
              </div>
            </div>

            {/* The videos: the chair guide big, the delegate and advisor guides under it. */}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#1B3828]">
                <Clapperboard size={15} strokeWidth={1.75} aria-hidden /> {t('sl_video_kicker')}
              </p>
              <p className="mt-1 mb-3 text-[18px] font-bold leading-snug text-[#1C1410] [text-wrap:balance]">{t('sl_video_title')}</p>
              <YouTubeClickToLoad
                videoId={CHAIR_GUIDE_VIDEO_ID}
                title={t('sl_video_title')}
                playLabel={t('sl_video_play')}
                thumbSrc={CHAIR_GUIDE_THUMB}
                sizes="560px"
                radius={16}
              />
              {extraVideos.length > 0 && (
                <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${extraVideos.length}, minmax(0, 1fr))` }}>
                  {extraVideos.map((v) => (
                    <div key={v.id} className="min-w-0">
                      <p className="mb-1.5 text-[13.5px] font-semibold text-[#1C1410]">{v.label}</p>
                      <YouTubeClickToLoad
                        videoId={v.id}
                        title={v.label}
                        playLabel={v.label}
                        thumbSrc={v.thumb}
                        sizes="280px"
                        radius={12}
                        discPx={44}
                        caption={v.thumb ? undefined : v.label}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                padding: '14px 20px', borderRadius: 16, fontSize: 15, fontWeight: 500,
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

      {/* The step's callout: Gavin, the words, End / Back / Next in ONE card, placed
          beside the lit target and never on it or on the top bar (placeCallout). */}
      <TutorialCallout
        stepId={step.id}
        otterImage={step.otterImage}
        copy={step.copy}
        targets={spotlightRects.filter((x): x is Rect => !!x)}
        avoid={avoidRects}
        box={box}
        idx={stepIdx}
        total={STEPS.length}
        isAction={isAction}
        isLast={isLast}
        language={language}
        onBack={goBack}
        onNext={isLast ? onEnd : advance}
        onEnd={onEnd}
      />
    </Portal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Back / counter / Next, top-centre: the goodbye slide only (nothing is lit there).
// Every other step carries its own Back / Next inside its callout (TutorialCallout).
function TutorialNav({
  idx, total, onBack, onNext, isAction, isLast, language,
}: {
  idx: number; total: number; onBack: () => void; onNext: () => void;
  isAction: boolean; isLast: boolean; language: string;
}) {
  const label = isLast
    ? pick(language, { en: 'Finish', es: 'Terminar', fr: 'Terminer', ar: 'إنهاء', pt: 'Concluir' })
    : isAction
      ? pick(language, { en: 'Skip', es: 'Omitir', fr: 'Passer', ar: 'تخطٍّ', pt: 'Pular' })
      : pick(language, { en: 'Next', es: 'Siguiente', fr: 'Suivant', ar: 'التالي', pt: 'Próximo' });
  const backLabel = pick(language, { en: 'Back', es: 'Atrás', fr: 'Retour', ar: 'رجوع', pt: 'Voltar' });

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


// ─── Buttons ─────────────────────────────────────────────────────────────────
// The Airbnb rounded rectangle with the forest gradient for the one main action, a
// quiet tinted secondary beside it; both sentence case, both press down a touch.
const PRIMARY_BTN =
  'inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap cursor-pointer select-none ' +
  'transition-[transform,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97] ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 motion-reduce:transition-none';
const PRIMARY_BTN_STYLE: React.CSSProperties = {
  backgroundImage: 'linear-gradient(135deg, #2E6446 0%, #1F4230 42%, #1B3828 62%, #122A1D 100%)',
  color: '#FFFFFF',
  boxShadow: '0 1px 2px rgba(27,56,40,0.18), 0 6px 16px rgba(27,56,40,0.24)',
};
const SECONDARY_BTN =
  'inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap cursor-pointer select-none ' +
  'bg-[rgba(27,56,40,0.06)] text-[#1B3828] hover:bg-[rgba(27,56,40,0.11)] ' +
  'transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] ' +
  'disabled:cursor-default disabled:opacity-40 disabled:active:scale-100 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 motion-reduce:transition-none';

/** The first card's Gavin (Otter.Tutorial.Intro, full body, ~10% clear at the top): drawn
 *  `size` square, the card's top edge `above` px down, so only his feet overlap it.
 *  21 Oct 2026 (owner: "Gavin is too small"): 148 → 190. */
const INTRO_OTTER = { size: 190, above: 150 };
/** The first card: words column `textW` wide beside the videos, at most `maxW` wide; below
 *  `minWideW` design px of screen the two columns stack. Sized so 1280x800 (FitToScreen's
 *  820px tall layout) holds the card, Gavin and both small video slots without a scroll. */
const INTRO_CARD = { maxW: 920, textW: 320, pad: 28, minWideW: 860 };

/** The callout's Gavin (Otter.Tutorial, ~28% clear at the top): his head and shoulders
 *  stand above the card's top edge, the rest overlaps the card's header row.
 *  21 Oct 2026 (owner: "Gavin a little bigger"): 84 → 112, the card 372 → 424 wide. */
const CALLOUT_OTTER = { size: 112, clearTop: 32, above: 40 };
const CALLOUT_W = 424;

// ─── Callout placement ───────────────────────────────────────────────────────
// Pure. Everything in fit-root design units. The callout goes beside the lit targets
// (below, above, then the inline-end and inline-start sides, then the screen's
// corners), first place that is fully on screen and touches neither a target nor the
// top bar. A target inside the top bar counts as the whole bar, so the callout drops
// below the bar instead of covering a neighbouring tab or icon. When nothing is free
// (a tiny window) the place covering the least wins.

const GAP = 14;
const EDGE = 12;

function unionOf(rs: Rect[]): Rect | null {
  if (rs.length === 0) return null;
  const l = Math.min(...rs.map((r) => r.left));
  const t = Math.min(...rs.map((r) => r.top));
  const rr = Math.max(...rs.map((r) => r.left + r.width));
  const b = Math.max(...rs.map((r) => r.top + r.height));
  return { left: l, top: t, width: rr - l, height: b - t };
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

function placeCallout(
  size: { w: number; h: number }, targets: Rect[], avoid: Rect[], vw: number, vh: number, rtl: boolean,
): { left: number; top: number } {
  const { w: W, h: H } = size;
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - W - EDGE));
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - H - EDGE));
  const belowBar = Math.max(EDGE, ...avoid.map((r) => r.top + r.height + GAP));
  const t = unionOf(targets);
  if (!t) return { left: clampX((vw - W) / 2), top: clampY(Math.max(belowBar, (vh - H) / 2)) };

  let a = t;
  for (const o of avoid) if (overlapArea(t, o) > 0) a = unionOf([a, o]) ?? a;
  const cx = t.left + t.width / 2 - W / 2;
  const cy = t.top + t.height / 2 - H / 2;
  const endSide = { left: a.left + a.width + GAP, top: clampY(cy) };
  const startSide = { left: a.left - GAP - W, top: clampY(cy) };
  const candidates = [
    { left: clampX(cx), top: a.top + a.height + GAP },
    { left: clampX(cx), top: a.top - GAP - H },
    rtl ? startSide : endSide,
    rtl ? endSide : startSide,
    { left: vw - W - EDGE, top: vh - H - EDGE },
    { left: EDGE, top: vh - H - EDGE },
    { left: vw - W - EDGE, top: belowBar },
    { left: EDGE, top: belowBar },
  ];
  const obstacles = [...targets, ...avoid];
  const onScreen = (c: { left: number; top: number }) =>
    c.left >= EDGE - 0.5 && c.top >= EDGE - 0.5 && c.left + W <= vw - EDGE + 0.5 && c.top + H <= vh - EDGE + 0.5;
  const cost = (c: { left: number; top: number }) =>
    obstacles.reduce((sum, o) => sum + overlapArea({ left: c.left, top: c.top, width: W, height: H }, o), 0);

  for (const c of candidates) if (onScreen(c) && cost(c) === 0) return c;
  let best = { left: clampX(candidates[0].left), top: clampY(candidates[0].top) };
  let bestCost = Infinity;
  for (const c of candidates) {
    const k = { left: clampX(c.left), top: clampY(c.top) };
    const kc = cost(k);
    if (kc < bestCost) { best = k; bestCost = kc; }
  }
  return best;
}

// ─── The callout ─────────────────────────────────────────────────────────────
// One white card: Gavin standing on its top edge, the step counter and End tutorial,
// the step's words, then Back and Next. Measured once per size change (ResizeObserver,
// layout px = design units inside fit-root) and placed by `placeCallout`; hidden until
// its first measurement so it never flashes in the wrong place.
function TutorialCallout({
  stepId, otterImage, copy, targets, avoid, box, idx, total, isAction, isLast, language,
  onBack, onNext, onEnd,
}: {
  stepId: string; otterImage: string; copy?: StepCopy;
  targets: Rect[]; avoid: Rect[]; box: DesignBox;
  idx: number; total: number; isAction: boolean; isLast: boolean; language: string;
  onBack: () => void; onNext: () => void; onEnd: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stepId]);

  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const pos = size && box.w > 0 ? placeCallout(size, targets, avoid, box.w, box.h, rtl) : null;

  const nextLabel = isLast
    ? pick(language, { en: 'Finish', es: 'Terminar', fr: 'Terminer', ar: 'إنهاء', pt: 'Concluir' })
    : isAction
      ? pick(language, { en: 'Skip', es: 'Omitir', fr: 'Passer', ar: 'تخطٍّ', pt: 'Pular' })
      : pick(language, { en: 'Next', es: 'Siguiente', fr: 'Suivant', ar: 'التالي', pt: 'Próximo' });
  const backLabel = pick(language, { en: 'Back', es: 'Atrás', fr: 'Retour', ar: 'رجوع', pt: 'Voltar' });

  return (
    <div
      ref={ref}
      role="dialog"
      aria-live="polite"
      aria-label={copy?.title}
      style={{
        position: 'fixed', zIndex: 9995, left: 0, top: 0,
        transform: `translate(${Math.round(pos?.left ?? 0)}px, ${Math.round(pos?.top ?? 0)}px)`,
        width: Math.min(CALLOUT_W, Math.max(240, (box.w || CALLOUT_W + 24) - 24)),
        paddingTop: CALLOUT_OTTER.above,
        visibility: pos ? 'visible' : 'hidden',
        // Slides from step to step on the compositor (transform only).
        transition: pos ? 'transform 240ms cubic-bezier(0.2,0,0,1)' : undefined,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        key={otterImage}
        src={otterImage} alt="" aria-hidden draggable={false}
        className="absolute select-none pointer-events-none"
        style={{
          top: -CALLOUT_OTTER.clearTop, insetInlineStart: 6, zIndex: 1,
          width: CALLOUT_OTTER.size, height: CALLOUT_OTTER.size, objectFit: 'contain',
          filter: 'drop-shadow(0 6px 10px rgba(18,42,29,0.22))',
        }}
      />
      <div
        style={{
          borderRadius: 22, backgroundColor: '#FFFFFF', padding: '12px 18px 16px',
          boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 16px 40px rgba(18,42,29,0.28)',
        }}
      >
        {/* Header row: kept clear for Gavin's body at the inline start. */}
        <div className="flex items-center gap-2" style={{ minHeight: 40, paddingInlineStart: CALLOUT_OTTER.size - 6 }}>
          <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: '#5A5046' }}>
            {idx + 1}/{total}
          </span>
          <button
            type="button"
            onClick={onEnd}
            className="ms-auto rounded-lg px-2.5 py-1.5 cursor-pointer transition-[background-color,transform] duration-150 hover:bg-[rgba(27,56,40,0.06)] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            style={{ fontSize: 13, fontWeight: 600, color: '#5A5046' }}
          >
            {t('tutorial_end')}
          </button>
        </div>

        {/* One short title, then the points. */}
        <div className="tut-scroll mt-3" style={{ maxHeight: 300, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {copy && (
            <>
              <div className="[text-wrap:balance]" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.25, color: '#1C1410', letterSpacing: '-0.01em' }}>
                {copy.title}
              </div>
              <ul className="mt-2.5 flex flex-col" style={{ gap: 8 }}>
                {copy.points.map((p, i) => (
                  <li key={i} className="flex items-start [text-wrap:pretty]" style={{ gap: 10, fontSize: 15, fontWeight: 500, lineHeight: 1.5, color: '#1C1410' }}>
                    <span aria-hidden className="shrink-0 rounded-full" style={{ width: 6, height: 6, marginTop: '0.62em', backgroundColor: '#B6871F' }} />
                    <span className="min-w-0">{p}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onBack} disabled={idx <= 0}
            className={`${SECONDARY_BTN} px-4 py-2.5 text-[14px]`}>
            {backLabel}
          </button>
          <button type="button" onClick={onNext}
            className={`${PRIMARY_BTN} px-5 py-2.5 text-[14px]`}
            style={PRIMARY_BTN_STYLE}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
