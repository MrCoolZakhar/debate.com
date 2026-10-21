'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import Portal from '@/components/Portal';
import type { Committee } from '@/lib/types';
import { docName } from '@/lib/docNames';
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
  /** Optional short title above the text (one line, plain). */
  title?: React.ReactNode;
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
function pick<T>(language: string, m: { en: T; es: T; fr: T; ar: T; pt: T }): T {
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
        pt: <>Boas-vindas à sua <strong>sala de comitê</strong>. {GR('Oradores')}, {GR('cronômetros')}, {GR('votações')}, {GR('moções')}, {GR('chat')}, {GR('documentos')}, tudo em um só lugar, feito para conduzir a sua <strong>sessão de MUN inteira</strong>, da primeira batida do martelo à última.</>,
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
        pt: <>Esta barra serve para <strong>adicionar delegações</strong> à lista de oradores. Digite o {G('nome de qualquer país')} e pressione {G('Enter')}.</>,
        en: <>This bar is how you <strong>add delegates</strong> to the speakers list. Type any {G('country name')} and press {G('Enter')}.</>,
      }),
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
        pt: <>Adicione <strong>3 países quaisquer</strong> à lista de oradores: use a {G('barra de busca')} abaixo ou clique nas delegações da {G('barra lateral')}. As duas formas funcionam!</>,
        en: <>Add <strong>any 3 countries</strong> to the speakers list: use the {G('input bar')} below or click delegates in the {G('sidebar')}. Both work!</>,
      }),
      actionDone: (c) => c.speakersList.length >= 3,
    },
    {
      id: 'call-first-speaker', kind: 'action',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['call-first-speaker'], spotlightRadius: 14,
      bubbleText: pick(language, {
        ar: <>صاحب المركز الأول في القائمة <strong>واقف على المنصّة</strong> بالفعل، ومؤقّته مضبوط وينتظر. اضغط {G('بدء')} لتمنحه الكلمة وتشغّل المؤقّت.</>,
        fr: <>Le premier de la liste est <strong>déjà à la tribune</strong>, chronomètre réglé, en attente. Appuyez sur {G('DÉMARRER')} pour lui donner la parole et lancer le chronomètre.</>,
        es: <>El primero de la lista <strong>ya está en la tribuna</strong>, con su cronómetro listo y esperando. Pulsa {G('INICIAR')} para darle la palabra y arrancar el reloj.</>,
        pt: <>A primeira da lista <strong>já está pronta para falar</strong>, com o cronômetro ajustado e esperando. Pressione {G('INICIAR')} para dar a palavra e disparar o cronômetro.</>,
        en: <>The top of the list is <strong>already standing on the floor</strong>, clock set and waiting. Press {G('START')} to give them the floor and run the timer.</>,
      }),
      actionDone: (c) => !!c.currentSpeaker,
    },
    {
      id: 'timer', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['timer'], spotlightRadius: 12,
      bubbleText: pick(language, {
        ar: <>يبدأ <strong>مؤقّت الكلام</strong> بالعد التنازلي للمندوب الحالي. يتحوّل إلى {G('الكهرماني')} في آخر 10 ثوانٍ. و{GR('انقر على المؤقّت نفسه')} لتشغيله أو إيقافه مؤقتاً، تماماً كزر البدء.</>,
        fr: <>Le <strong>chronomètre</strong> décompte pour le délégué actuel. Il passe à l&apos;{G('ambre')} dans les 10 dernières secondes. {GR('Cliquez sur le chronomètre lui-même')} pour le lancer ou le mettre en pause, comme avec le bouton.</>,
        es: <>El <strong>cronómetro</strong> cuenta regresivamente para el delegado actual. Se vuelve {G('ámbar')} en los últimos 10 segundos. {GR('Haz clic en el propio cronómetro')} para iniciarlo o pausarlo, igual que con el botón.</>,
        pt: <>O <strong>cronômetro de discurso</strong> faz a contagem regressiva da delegação com a palavra. Ele fica {G('âmbar')} nos últimos 10 segundos. {GR('Clique no próprio cronômetro')} para iniciá-lo ou pausá-lo, exatamente como no botão.</>,
        en: <>The <strong>speaking timer</strong> counts down for the current delegate. It turns {G('amber')} for the last 10 seconds. {GR('Click the clock itself')} to start or pause it, exactly like the button.</>,
      }),
    },
    {
      id: 'add-time', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['add-time-button'], spotlightRadius: 12,
      bubbleText: pick(language, {
        ar: <>تحتاج إلى منح وقت إضافي؟ زر {G('إضافة وقت')} (أيقونة الساعة) يضيف {G('15 / 30 / 60')} ثانية أو أي مقدار تكتبه. ويعمل أيضاً <strong>قبل الضغط على بدء</strong>، فتُجلس أول متحدث بمدّة أطول. أمّا {G('↺')} في الصف نفسه فيعيد المؤقّت إلى مدّة الكلام الكاملة.</>,
        fr: <>Besoin d&apos;accorder plus de temps ? {G('Ajouter du temps')} (l&apos;icône horloge) ajoute {G('15 / 30 / 60')} secondes, ou le montant de votre choix. Cela marche aussi <strong>avant d&apos;appuyer sur Démarrer</strong>, pour installer le premier orateur avec un temps plus long. Le {G('↺')} de la même rangée remet le chronomètre au temps de parole complet.</>,
        es: <>¿Necesitas dar más tiempo? {G('Añadir tiempo')} (el icono de reloj) agrega {G('15 / 30 / 60')} segundos, o los que escribas. También funciona <strong>antes de pulsar Iniciar</strong>, así sientas al primer orador con más tiempo. El {G('↺')} de la misma fila devuelve el cronómetro al tiempo completo.</>,
        pt: <>Precisa conceder mais tempo? {G('Adicionar tempo')} (o ícone de relógio) soma {G('15 / 30 / 60')} segundos, ou o valor que você digitar. Também funciona <strong>antes de pressionar Iniciar</strong>, para a primeira delegação começar com mais tempo. O {G('↺')} na mesma fileira reinicia o cronômetro com o tempo de discurso completo.</>,
        en: <>Need to grant more time? {G('Add time')} (the clock icon) adds {G('15 / 30 / 60')} seconds, or any amount you type. It also works <strong>before you press Start</strong>, so you can seat the first speaker with a longer slot. The {G('↺')} in the same row restarts the clock at the full speaking time.</>,
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
        pt: <>O {GR('Direito de Réplica')} dá a uma delegação citada um cronômetro separado para responder. Ele <strong>nunca mexe na lista de oradores</strong>, então ninguém perde o lugar na fila.</>,
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
        pt: <>{G('Chamada')}: clique aqui para marcar cada delegação como <strong>Ausente</strong>, <strong>Presente</strong> ou <strong>Presente e votante</strong>. Você pode atualizar a presença a qualquer momento da sessão.</>,
        en: <>{G('Roll Call')}: click here to mark each delegate as <strong>Absent</strong>, <strong>Present</strong>, or <strong>Present & Voting</strong>. You can update attendance at any point during the session.</>,
      }),
    },
    {
      id: 'seat-add', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['seat-add'], spotlightRadius: 999,
      bubbleText: pick(language, {
        ar: <>هل ينقص أحدهم من قائمة المقاعد؟ الصندوق الصغير {G('إضافة مقعد')} بجانب مؤشّرات النِّصاب يقبل اسم أي {G('دولة')} أو أي اسم تكتبه. يضيفه {G('Enter')} <strong>حاضراً</strong> فوراً، و{G('Shift + Enter')} يضيفه <strong>مراقباً</strong>.</>,
        fr: <>Quelqu&apos;un manque à la liste ? La petite case {G('Ajouter un siège')}, à côté des indicateurs de quorum, accepte n&apos;importe quel {G('pays')} ou n&apos;importe quel nom que vous tapez. {G('Entrée')} l&apos;installe <strong>présent</strong> tout de suite, {G('Maj + Entrée')} l&apos;installe comme <strong>observateur</strong>.</>,
        es: <>¿Falta alguien en la lista? La cajita {G('Añadir un asiento')}, junto a los indicadores de cuórum, acepta cualquier {G('país')} o cualquier nombre que escribas. {G('Enter')} lo sienta <strong>presente</strong> al instante, y {G('Shift + Enter')} lo sienta como <strong>observador</strong>.</>,
        pt: <>Falta alguém na lista? A caixinha {G('Adicionar assento')}, ao lado dos indicadores de quórum, aceita qualquer {G('país')} ou qualquer nome que você digitar. {G('Enter')} adiciona a delegação como <strong>presente</strong> na hora, e {G('Shift + Enter')} a adiciona como <strong>observadora</strong>.</>,
        en: <>Somebody missing from the roster? The small {G('Add a seat')} box beside the quorum tabs takes any {G('country')} or any name you type. {G('Enter')} seats them <strong>present</strong> straight away; {G('Shift + Enter')} seats them as an <strong>observer</strong>.</>,
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
        pt: <>{G('Moções')}: quando uma delegação levanta a placa, <strong>é você quem registra a moção</strong> aqui e escolhe quem a propôs: <strong>Debate Moderado</strong>, <strong>Debate Não Moderado</strong>, <strong>Tour de Table</strong> ou <strong>Consulta Plenária</strong>. O {GR('adiamento')} e o {GR('encerramento do debate')} também ficam aqui.</>,
        en: <>{G('Motions')}: when a delegate raises their placard, <strong>you key the motion in</strong> here and pick who proposed it: <strong>Moderated Caucus</strong>, <strong>Unmoderated</strong>, <strong>Tour de Table</strong>, or <strong>Consultation of the Whole</strong>. {GR('Suspend')} and {GR('close debate')} live here too.</>,
      }),
    },
    {
      id: 'tab-documents', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-documents'], spotlightRadius: 6,
      bubbleText: pick(language, {
        ar: <>{G('المستندات')}: تصل هنا <strong>{docs.wpPlural}</strong> و<strong>{docs.drPlural}</strong> التي يقدّمها المندوبون. اضغط <strong>تقديم</strong> لتشغيل مراحل {GR('القراءة')} و{GR('العرض')} و{GR('الأسئلة')} على شاشتك؛ تُعتمد {docs.wpSingular} تلقائياً بعدها، أمّا {docs.drSingular} فينتقل إلى {GR('صفحة التصويت')}، حيث تُجري تدقيق الحضور ثم تصوّت من المنصّة أو تدع الوفود تصوّت من <strong>هواتفها</strong>.</>,
        fr: <>{G('Documents')} : les <strong>{docs.wpPlural}</strong> et <strong>{docs.drPlural}</strong> soumis par les délégués arrivent ici. <strong>Introduire</strong> lance les étapes {GR('Lecture')}, {GR('Présentation')} et {GR('Q&R')} sur votre écran ; {docs.wpSingular} est adopté automatiquement ensuite, {docs.drSingular} part vers la {GR('page de vote')}, où vous faites l&apos;appel puis votez depuis la tribune ou laissez les délégations voter sur <strong>leur téléphone</strong>.</>,
        es: <>{G('Documentos')}: aquí llegan <strong>{docs.wpPlural}</strong> y <strong>{docs.drPlural}</strong> que envían los delegados. <strong>Introducir</strong> lanza las etapas de {GR('Lectura')}, {GR('Presentación')} y {GR('Preguntas')} en tu pantalla; {docs.wpSingular} se aprueba automáticamente al terminar, y {docs.drSingular} pasa a la {GR('página de votación')}, donde pasas lista y votas desde la mesa o dejas que las delegaciones voten desde <strong>su teléfono</strong>.</>,
        pt: <>{G('Documentos')}: aqui chegam <strong>{docs.wpPlural}</strong> e <strong>{docs.drPlural}</strong> enviados pelas delegações. <strong>Introduzir</strong> conduz as etapas de {GR('Leitura')}, {GR('Apresentação')} e {GR('Perguntas')} na sua tela; depois, cada {docs.wpSingular} vai direto à aprovação, e cada {docs.drSingular} segue para a {GR('página de votação')}, onde você faz a chamada e vota pela Mesa ou deixa as delegações votarem no <strong>próprio celular</strong>.</>,
        en: <>{G('Documents')}: <strong>{docs.wpPlural}</strong> and <strong>{docs.drPlural}</strong> submitted by delegates land here. <strong>Introduce</strong> runs the {GR('Reading')}, {GR('Presentation')} and {GR('Q&A')} stages on your screen; a {docs.wpSingular} auto-passes afterwards, a {docs.drSingular} goes to the {GR('voting page')}, where you take the roll and then vote from the dais or let delegations vote on <strong>their own phones</strong>.</>,
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
        pt: <>{G('Chat')}: envie mensagens a <strong>todas as delegações</strong> de uma vez ou mensagens privadas individuais. Recomendamos deixá-lo aberto no seu <strong>dispositivo pessoal</strong>, e não na tela principal do comitê.</>,
        en: <>{G('Chat')}: message <strong>all delegates</strong> at once or DM individuals. We recommend keeping this open on your <strong>personal device</strong> rather than the main committee screen.</>,
      }),
    },
    {
      id: 'tab-settings', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-settings'], spotlightRadius: 6,
      bubbleText: pick(language, {
        ar: <>{G('الإعدادات')} خمس تبويبات: {GR('الوصول')} (رمز الجلسة وكلمة مرور الرئاسة، وهيئة الرئاسة، وما يُسمح للمندوبين بفعله)، و{GR('الاقتراحات')} (تفعيل الاقتراحات وترتيبها وإعادة تسميتها، واعتماد المستندات وأسماؤها)، و{GR('التصويت')} (النِّصاب والأغلبيات وحق النقض)، و{GR('النقاط')}، و{GR('الأشخاص')} (كل المتصلين الآن، مع إمكانية إخراج من جلس على مقعد خطأ).</>,
        fr: <>{G('Paramètres')}, cinq onglets : {GR('Accès')} (code de session et mot de passe de présidence, le présidium, ce que les délégués peuvent faire), {GR('Motions')} (activer, réordonner et renommer les motions, approbation et noms des documents), {GR('Vote')} (quorum, majorités, veto), {GR('Points')} et {GR('Personnes')} (tout le monde connecté en ce moment, et le retrait de qui occupe le mauvais siège).</>,
        es: <>{G('Configuración')}, cinco pestañas: {GR('Acceso')} (código de sesión y contraseña de presidencia, la mesa, y qué pueden hacer los delegados), {GR('Mociones')} (activar, reordenar y renombrar mociones, aprobación y nombres de documentos), {GR('Votación')} (cuórum, mayorías, veto), {GR('Puntos')} y {GR('Personas')} (todos los conectados ahora mismo, y sacar a quien esté en el asiento equivocado).</>,
        pt: <>{G('Configurações')} tem cinco abas: {GR('Acesso')} (código da sessão e senha da Mesa, quem está na Mesa, o que as delegações podem fazer), {GR('Moções')} (ativar, reordenar e renomear moções, aprovação e nomes dos documentos), {GR('Votação')} (quórum, maiorias, veto), {GR('Pontos')} e {GR('Pessoas')} (todos que estão conectados agora, e a opção de remover quem estiver no assento errado).</>,
        en: <>{G('Settings')} has five tabs: {GR('Access')} (the session code and the chair password, the dais, what delegates may do), {GR('Motions')} (enable, reorder and rename motions, document approval and names), {GR('Voting')} (quorum, majorities, veto), {GR('Points')}, and {GR('People')} (everyone connected right now, and removing anyone on the wrong seat).</>,
      }),
    },
    {
      // 21 Oct 2026 (owner): the old full-page scoreboard explainer was too long. Now a
      // step like every other: the trophy lit, one short title, one plain line.
      id: 'scoreboard', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['tab-scoreboard'], spotlightRadius: 12,
      title: pick(language, {
        ar: 'لوحة النقاط',
        fr: 'Tableau des scores',
        es: 'Marcador',
        pt: 'Placar',
        en: 'Scoreboard',
      }),
      bubbleText: pick(language, {
        ar: <>كل الوفود مرتّبة لحظياً، والنقاط تُحتسب تلقائياً. غيّر ما يمنح النقاط من {GR('الإعدادات ← النقاط')}.</>,
        fr: <>Toutes les délégations, classées en direct, et les points s&apos;ajoutent tout seuls. Choisissez ce qui rapporte des points dans {GR('Paramètres → Points')}.</>,
        es: <>Todas las delegaciones, clasificadas en vivo, y los puntos se suman solos. Elige qué da puntos en {GR('Configuración → Puntos')}.</>,
        pt: <>Todas as delegações, classificadas ao vivo, e os pontos entram sozinhos. Escolha o que vale pontos em {GR('Configurações → Pontos')}.</>,
        en: <>Every delegation, ranked live, and the points add up on their own. Choose what earns points in {GR('Settings → Points')}.</>,
      }),
    },
    {
      id: 'join-code', kind: 'spotlight',
      otterImage: '/Otter.Tutorial.webp',
      spotlightTargets: ['join-code'], spotlightRadius: 8,
      bubbleText: pick(language, {
        ar: <>هذا <strong>رمز جلستك</strong>. {GR('انقر عليه')} لعرضه مع {G('رمز QR')} على الشاشة كاملةً أمام القاعة، أو لنسخه. يُدخله المندوبون في {G('gavelling.com')} للانضمام في الوقت الفعلي. أمّا الرؤساء الذين ينضمون إلى المنصة فيحتاجون كلمة مرور الرئاسة المكوّنة من 4 أرقام، الموجودة في {GR('الإعدادات ← الوصول')}.</>,
        fr: <>Votre <strong>code de session</strong>. {GR('Cliquez dessus')} pour l&apos;afficher en plein écran avec un {G('QR code')} devant toute la salle, ou pour le copier. Les délégués l&apos;entrent sur {G('gavelling.com')} pour rejoindre en temps réel. Les présidents qui rejoignent le présidium ont besoin du mot de passe de présidence à 4 chiffres, dans {GR('Paramètres → Accès')}.</>,
        es: <>Tu <strong>código de sesión</strong>. {GR('Haz clic')} para mostrarlo a pantalla completa con un {G('código QR')} para toda la sala, o para copiarlo. Los delegados lo ingresan en {G('gavelling.com')} para unirse en tiempo real. Las presidencias que se unen a la mesa necesitan la contraseña de presidencia de 4 dígitos, en {GR('Configuración → Acceso')}.</>,
        pt: <>O seu <strong>código da sessão</strong>. {GR('Clique nele')} para mostrar o código e um {G('QR code')} em tela cheia para a sala toda, ou para copiá-lo. As delegações o digitam em {G('gavelling.com')} para entrar em tempo real. Os membros da Mesa precisam da senha da Mesa de 4 dígitos, que fica em {GR('Configurações → Acesso')}.</>,
        en: <>Your <strong>session code</strong>. {GR('Click it')} to put the code and a {G('QR code')} on the screen for the whole room, or to copy it. Delegates enter it at {G('gavelling.com')} to join in real time. Chairs joining the dais need the 4-digit chair password instead, found in {GR('Settings → Access')}.</>,
      }),
    },
    {
      id: 'goodbye', kind: 'goodbye',
      otterImage: '/Otter.Tutorial.Outro.webp',
      bubbleText: pick(language, {
        ar: <>استمتع بالاستكشاف! وزوّدنا دائماً بـ {G('ملاحظاتك')}، فهكذا يتحسّن Gavelling. راسلنا على إنستغرام {GR('@wearegavelling')} في أي وقت 🎉</>,
        fr: <>Amusez-vous à explorer ! Et donnez-nous toujours votre {G('avis')}, c&apos;est comme ça que Gavelling s&apos;améliore. Écrivez-nous sur IG {GR('@wearegavelling')} à tout moment 🎉</>,
        es: <>¡Diviértete explorando! Y siempre {G('danos tu opinión')}, así mejora Gavelling. Escríbenos en IG {GR('@wearegavelling')} cuando quieras 🎉</>,
        pt: <>Divirta-se explorando! E sempre {G('mande sua opinião')}, é assim que o Gavelling melhora. Fale com a gente no Instagram {GR('@wearegavelling')} quando quiser 🎉</>,
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
        {/* 21 Oct 2026 (owner): a smaller card with Gavin hanging over its top edge. The
            otter is drawn OUTSIDE the card box (this wrapper does not clip), so the card
            keeps no space for him inside and nothing is unclipped for him. */}
        <div role="dialog" aria-modal="true" aria-labelledby="tut-q-title"
          className="relative w-full" style={{ maxWidth: 380, paddingTop: INTRO_OTTER.above }}>
          <img src="/Otter.Tutorial.Intro.webp" alt="" aria-hidden draggable={false}
            className="absolute select-none pointer-events-none"
            style={{
              top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1,
              width: INTRO_OTTER.size, height: INTRO_OTTER.size, objectFit: 'contain',
              filter: 'drop-shadow(0 8px 14px rgba(18,42,29,0.28))',
            }} />
          <div className="rounded-3xl text-center flex flex-col items-center"
            style={{
              backgroundColor: '#FFFFFF',
              padding: `${INTRO_OTTER.size - INTRO_OTTER.above + 14}px 24px 22px`,
              boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 24px 60px rgba(18,42,29,0.38)',
            }}>
            <h2 id="tut-q-title" className="text-[22px] font-extrabold text-[#1C1410] tracking-tight leading-tight [text-wrap:balance]">
              {t('tutorial_have_you_used')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6A5A4A] [text-wrap:pretty]">{t('tutorial_gavin_prepared')}</p>
            <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row-reverse">
              <button type="button" onClick={advance}
                className={`${PRIMARY_BTN} flex-[1.3] py-3 text-[15px]`}
                style={PRIMARY_BTN_STYLE}>
                {t('tutorial_show_me')}
              </button>
              <button type="button" onClick={onEnd}
                className={`${SECONDARY_BTN} flex-1 py-3 text-[15px]`}>
                {t('tutorial_skip')}
              </button>
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
        title={step.title}
        text={step.bubbleText}
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

/** The questionnaire's Gavin (Otter.Tutorial.Intro, full body, ~10% clear at the top):
 *  drawn `size` square, the card's top edge `above` px down, so only his feet overlap it. */
const INTRO_OTTER = { size: 148, above: 117 };

/** The callout's Gavin (Otter.Tutorial, ~28% clear at the top): his head and shoulders
 *  stand above the card's top edge, the rest overlaps the card's header row. */
const CALLOUT_OTTER = { size: 84, clearTop: 24, above: 30 };
const CALLOUT_W = 372;

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
  stepId, otterImage, title, text, targets, avoid, box, idx, total, isAction, isLast, language,
  onBack, onNext, onEnd,
}: {
  stepId: string; otterImage: string; title?: React.ReactNode; text: React.ReactNode;
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
      aria-label={typeof title === 'string' ? title : undefined}
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
          borderRadius: 18, backgroundColor: '#FFFFFF', padding: '10px 14px 14px',
          boxShadow: '0 1px 2px rgba(27,56,40,0.10), 0 14px 36px rgba(18,42,29,0.26)',
        }}
      >
        {/* Header row: kept clear for Gavin's body at the inline start. */}
        <div className="flex items-center gap-2" style={{ minHeight: 30, paddingInlineStart: CALLOUT_OTTER.size - 4 }}>
          <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: '#6A5A4A' }}>
            {idx + 1}/{total}
          </span>
          <button
            type="button"
            onClick={onEnd}
            className="ms-auto rounded-lg px-2 py-1 cursor-pointer transition-[background-color,transform] duration-150 hover:bg-[rgba(27,56,40,0.06)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F]"
            style={{ fontSize: 12.5, fontWeight: 600, color: '#6A5A4A' }}
          >
            {t('tutorial_end')}
          </button>
        </div>

        <div className="tut-scroll mt-2" style={{ maxHeight: 220, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {title && (
            <div className="[text-wrap:balance]" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: '#1C1410', marginBottom: 4 }}>
              {title}
            </div>
          )}
          <div className="[text-wrap:pretty]" style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: '#1C1410' }}>
            {text}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={onBack} disabled={idx <= 0}
            className={`${SECONDARY_BTN} px-3.5 py-2 text-[13.5px]`}>
            {backLabel}
          </button>
          <button type="button" onClick={onNext}
            className={`${PRIMARY_BTN} px-4 py-2 text-[13.5px]`}
            style={PRIMARY_BTN_STYLE}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
