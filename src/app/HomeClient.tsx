'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Scale, List, FileText, MessageSquare, Save } from 'lucide-react';
import { getFlagUrl, getCountryByName, getCountryDisplayName } from '@/lib/countries';
import SiteNav from '@/components/SiteNav';
import { useT, useLanguage } from '@/contexts/LanguageContext';

function getCommitteeAcronym(title: string): string {
  const t = title.toUpperCase();
  if (t.includes('SECURITY COUNCIL')) return 'UNSC';
  if (t.includes('GENERAL ASSEMBLY')) return 'UNGA';
  if (t.includes('HUMAN RIGHTS')) return 'UNHRC';
  if (t.includes('ECOSOC')) return 'ECOSOC';
  if (t.includes('ENVIRONMENT') || t.includes('UNEP')) return 'UNEP';
  if (t.includes('WHO') || t.includes('WORLD HEALTH')) return 'WHO';
  if (t.includes('NATO')) return 'NATO';
  if (t.includes('AFRICAN UNION') || /\bAU\b/.test(t)) return 'AU';
  if (t.includes('EUROPEAN UNION') || /\bEU\b/.test(t)) return 'EU';
  if (t.includes('G20') || t.includes('G-20')) return 'G20';
  if (t.includes('ARAB LEAGUE') || t.includes('LAS')) return 'LAS';
  if (t.includes('ASEAN')) return 'ASEAN';
  if (t.includes('IMF')) return 'IMF';
  return 'UNGA';
}

const REJOIN_LOGOS: Record<string, string> = {
  UNSC:   '/logos/un.svg',
  UNGA:   '/logos/un.svg',
  UNHRC:  '/logos/UNHRC.png',
  ECOSOC: '/logos/un.svg',
  UNEP:   '/logos/UNEP.png',
  NATO:   '/logos/nato.png',
  EU:     '/logos/eu.png',
  AU:     '/logos/AU.png',
  WHO:    '/logos/who.png',
  IMF:    '/logos/IMF.png',
  G20:    '/logos/g20.svg',
  G7:     '/logos/g7.png',
  LAS:    '/logos/arab-league.png',
  ASEAN:  '/logos/asean.png',
  WB:     '/logos/worldbank.svg',
  BRICS:  '/logos/brics.png',
};

// ── Individual feature card components ──────────────────────────────────────

function RollCallCard() {
  const { language } = useLanguage();
  const es = language === 'es';
  const fr = language === 'fr';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  const getFlag = (country: string) => {
    const c = getCountryByName(country);
    return c ? <img src={getFlagUrl(c.code)} alt={country} loading="lazy" style={{ width: '28px', height: '20px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(28,20,16,0.10)' }} /> : <span className="w-7 h-5 bg-[#DDD4C0] rounded inline-block" />;
  };
  const delegates = [
    { country: 'China', label: getCountryDisplayName('China', language), status: 'present-voting' },
    { country: 'France', label: getCountryDisplayName('France', language), status: 'present-voting' },
    { country: 'Germany', label: getCountryDisplayName('Germany', language), status: 'present' },
    { country: 'Brazil', label: getCountryDisplayName('Brazil', language), status: 'absent' },
    { country: 'India', label: getCountryDisplayName('India', language), status: 'present' },
    { country: 'Japan', label: getCountryDisplayName('Japan', language), status: 'present-voting' },
    { country: 'United Kingdom', label: getCountryDisplayName('United Kingdom', language), status: 'absent' },
    { country: 'South Africa', label: getCountryDisplayName('South Africa', language), status: 'present' },
  ];
  const bulkBtns = fr ? ['Tous P', 'Tous P+V', 'Effacer'] : es ? ['Todos P', 'Todos P+V', 'Borrar'] : ['All Present', 'All P+V', 'Clear'];
  return (
    <div className="w-full rounded-2xl overflow-hidden flex flex-col" style={{ ...shadow, minHeight: '460px', backgroundColor: '#1B3828', border: '1px solid #3D7A52' }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
        <div>
          <p className="font-black text-sm uppercase tracking-widest" style={{ color: '#EED98A', fontFamily: "'DM Mono', monospace" }}>{fr ? 'APPEL NOMINAL' : es ? 'Lista de Asistencia' : 'Roll Call'}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(238,217,138,0.5)' }}>{fr ? "Conseil de sécurité de l'ONU" : es ? 'Consejo de Seguridad de la ONU' : 'UN Security Council'}</p>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(238,217,138,0.15)', color: '#EED98A', border: '1px solid rgba(238,217,138,0.3)' }}>{fr ? 'PRÉ-SESSION' : es ? 'PRE-SESIÓN' : 'PRE-SESSION'}</span>
      </div>
      {/* Quick set buttons */}
      <div className="flex gap-2 px-4 py-2.5">
        {bulkBtns.map(btn => (
          <button key={btn} className="flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg" style={{ backgroundColor: 'rgba(238,217,138,0.1)', color: '#EED98A', border: '1px solid rgba(238,217,138,0.2)' }}>{btn}</button>
        ))}
      </div>
      {/* Delegate list */}
      <div className="flex-1 px-3 pb-2 flex flex-col gap-1">
        {delegates.map(d => (
          <div key={d.country} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
            {getFlag(d.country)}
            <span className="flex-1 text-xs font-semibold truncate" style={{ color: '#EDE7D8' }}>{d.label}</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{
              backgroundColor: d.status === 'present-voting' ? '#EED98A' : d.status === 'present' ? 'rgba(61,122,82,0.5)' : 'rgba(255,255,255,0.08)',
              color: d.status === 'present-voting' ? '#1B3828' : d.status === 'present' ? '#EDE7D8' : '#9A8A78',
            }}>
              {d.status === 'present-voting' ? 'P+V' : d.status === 'present' ? 'P' : (es ? 'Ausente' : 'Absent')}
            </span>
          </div>
        ))}
      </div>
      {/* Quorum bar */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(61,122,82,0.3)' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wide" style={{ color: 'rgba(238,217,138,0.5)' }}>{es ? 'Quórum' : 'Quorum'}</span>
          <span className="text-[9px] font-mono font-bold" style={{ color: '#EED98A' }}>6 / 8</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full" style={{ width: '75%', backgroundColor: '#3D7A52' }} />
        </div>
      </div>
    </div>
  );
}

function MotionsCard() {
  const { language } = useLanguage();
  const es = language === 'es';
  const fr = language === 'fr';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  const getFlag = (country: string) => {
    const c = getCountryByName(country);
    return c ? <img src={getFlagUrl(c.code)} alt={country} loading="lazy" style={{ width: '32px', height: '22px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(28,20,16,0.10)' }} /> : null;
  };
  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ ...shadow, minHeight: '460px', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #DDD4C0' }}>
        <h2 className="text-lg font-black tracking-wide" style={{ color: '#1B3828', fontFamily: "'Outfit', sans-serif" }}>{fr ? 'VOTER SUR LES MOTIONS' : es ? 'VOTAR EN MOCIONES' : 'VOTE ON MOTIONS'}</h2>
      </div>
      {/* Drag hint */}
      <div className="mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: '#1B3828', color: '#EED98A' }}>
        {fr ? 'Faites glisser les motions pour les réorganiser. La plus perturbatrice est votée en premier par défaut.' : es ? 'Arrastra las mociones para reordenar. La más disruptiva se vota primero por defecto.' : 'Drag motions to reorder. Most disruptive voted on first by default.'}
      </div>
      {/* Motion cards */}
      <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
        {/* Primary motion — large */}
        <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ border: '2px solid #1B3828', backgroundColor: 'transparent' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-black text-base" style={{ color: '#1C1410' }}>{fr ? 'Caucus modéré' : es ? 'Cáucus Moderado' : 'Moderated Caucus'}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: '#1B3828' }}>{fr ? 'Sujet : ' : es ? 'Tema: ' : 'Topic: '}<span style={{ color: '#1C1410' }}>{fr ? 'Non-prolifération nucléaire' : es ? 'No Proliferación de Armas Nucleares' : 'Nuclear Non-Proliferation'}</span></p>
              <p className="text-xs mt-1" style={{ color: '#1C1410' }}><span className="font-semibold" style={{ color: '#1B3828' }}>{fr ? 'Temps Total : ' : es ? 'Tiempo Total: ' : 'Total Time: '}</span><span className="font-black">10m</span></p>
              <p className="text-xs" style={{ color: '#1C1410' }}><span className="font-semibold" style={{ color: '#1B3828' }}>{fr ? 'Temps par orateur : ' : es ? 'Tiempo por orador: ' : 'Speaker Time: '}</span><span className="font-black">90s</span></p>
              <p className="text-xs" style={{ color: '#1C1410' }}><span className="font-semibold" style={{ color: '#1B3828' }}>{fr ? 'Total orateurs : ' : es ? 'Total de oradores: ' : 'Total Speakers: '}</span><span className="font-black">{fr ? '6 orateurs' : es ? '6 oradores' : '6 speakers'}</span></p>
            </div>
            {getFlag('France')}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
            <span className="text-xs font-semibold flex-1" style={{ color: '#1B3828' }}>{fr ? 'Majorité simple' : es ? 'Mayoría Simple' : 'Simple majority'}</span>
            <span className="text-xs font-bold" style={{ color: '#1C1410' }}>{fr ? 'Besoin 8 sur 15' : es ? 'Necesita 8 de 15' : 'Needs 8 of 15'}</span>
          </div>
          <div className="flex gap-2 mt-1">
            <button className="flex-1 py-2 rounded-xl font-black text-xs text-white focus:outline-none" style={{ backgroundColor: '#1B3828', letterSpacing: '0.05em' }}>{fr ? '✓ ACCEPTER' : es ? '✓ ACEPTAR' : '✓ ACCEPT'}</button>
            <button className="flex-1 py-2 rounded-xl font-black text-xs focus:outline-none" style={{ backgroundColor: '#DDD4C0', color: '#6A5A4A', letterSpacing: '0.05em' }}>{fr ? '✗ REJETER' : es ? '✗ RECHAZAR' : '✗ REJECT'}</button>
            <button className="px-3 py-2 rounded-xl font-black text-xs focus:outline-none" style={{ backgroundColor: 'rgba(182,135,31,0.2)', color: '#B6871F', border: '1px solid rgba(182,135,31,0.4)' }}>{fr ? 'MODIFIER' : es ? 'EDITAR' : 'EDIT'}</button>
          </div>
        </div>
        {/* Secondary motion — small */}
        <div className="rounded-2xl p-3 flex items-center gap-3" style={{ border: '1px solid #DDD4C0', backgroundColor: 'transparent' }}>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm" style={{ color: '#1C1410' }}>{fr ? 'Caucus non modéré' : es ? 'Cáucus No Moderado' : 'Unmoderated Caucus'}</p>
            <p className="text-xs" style={{ color: '#1C1410' }}><span className="font-semibold" style={{ color: '#1B3828' }}>{fr ? 'Temps Total : ' : es ? 'Tiempo Total: ' : 'Total Time: '}</span><span className="font-black">15m</span></p>
          </div>
          {getFlag('Germany')}
        </div>
      </div>
    </div>
  );
}

function SpeakersCard() {
  const { language } = useLanguage();
  const es = language === 'es';
  const fr = language === 'fr';
  const [timerSecs, setTimerSecs] = useState(83);
  useEffect(() => {
    const t = setInterval(() => setTimerSecs(s => s > 0 ? s - 1 : 90), 1000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.floor(timerSecs / 60);
  const secs = timerSecs % 60;
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  const queueDelegates = [
    { country: 'Denmark', label: getCountryDisplayName('Denmark', language), pos: 2 },
    { country: 'Ecuador', label: getCountryDisplayName('Ecuador', language), pos: 3 },
    { country: 'France', label: getCountryDisplayName('France', language), pos: 4 },
    { country: 'Greece', label: getCountryDisplayName('Greece', language), pos: 5 },
    { country: 'Japan', label: getCountryDisplayName('Japan', language), pos: 6 },
  ];
  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ ...shadow, minHeight: '460px', backgroundColor: '#FAF8F3', border: '1px solid #DDD4C0' }}>
      {/* Top queue row — centered */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-center gap-4 flex-wrap">
        {queueDelegates.map(d => {
          const c = getCountryByName(d.country);
          return (
            <div key={d.country} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div style={{ width: '52px', height: '38px', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid rgba(28,20,16,0.10)' }}>
                {c ? <img src={getFlagUrl(c.code)} alt={d.country} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#DDD4C0' }} />}
              </div>
              <span className="text-[9px] font-semibold text-center" style={{ color: '#6A5A4A' }}>{d.label}</span>
              {d.pos === 2 && <span className="text-[8px] font-bold" style={{ color: '#B8844A' }}>{fr ? 'Suivant' : es ? 'A continuación' : 'Up next'}</span>}
            </div>
          );
        })}
        <span className="text-xs font-mono self-center flex-shrink-0" style={{ color: '#9A8A78' }}>{fr ? '+8 de plus' : es ? '+8 más' : '+8 more'}</span>
      </div>
      {/* Current speaker */}
      <div className="flex flex-col items-center px-6 py-4">
        <div style={{ width: '100px', height: '72px', borderRadius: '14px', overflow: 'hidden', border: '1.5px solid rgba(28,20,16,0.10)', marginBottom: '12px' }}>
          {(() => { const c = getCountryByName('China'); return c ? <img src={getFlagUrl(c.code)} alt="China" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null; })()}
        </div>
        <p className="font-black text-2xl mb-1" style={{ color: '#1C1410' }}>China</p>
        <p className="font-black text-5xl font-mono tabular-nums mb-2" style={{ color: timerSecs <= 10 ? '#B8844A' : '#1C1410' }}>
          {mins}:{secs.toString().padStart(2, '0')}
        </p>
        <div className="w-full h-1.5 rounded-full overflow-hidden mb-4" style={{ backgroundColor: '#DDD4C0' }}>
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(timerSecs / 90) * 100}%`, backgroundColor: timerSecs <= 10 ? '#B8844A' : '#B6871F' }} />
        </div>
        {/* Buttons */}
        <div className="flex gap-2">
          <button className="px-6 py-2.5 rounded-xl font-black text-sm text-white focus:outline-none" style={{ backgroundColor: '#2A5A3C' }}>{fr ? '▶ DÉMARRER' : es ? '▶ INICIO' : '▶ START'}</button>
          <button className="px-6 py-2.5 rounded-xl font-black text-sm focus:outline-none" style={{ backgroundColor: 'transparent', border: '1px solid #DDD4C0', color: '#1C1410' }}>{fr ? 'SUIVANT →' : es ? 'SIGUIENTE →' : 'NEXT →'}</button>
          <button className="px-3 py-2.5 rounded-xl font-black text-xs focus:outline-none" style={{ backgroundColor: 'transparent', border: '1px solid #DDD4C0', color: '#6A5A4A' }}>{fr ? '+TEMPS' : es ? '+TIEMPO' : 'ADD TIME'}</button>
        </div>
      </div>
    </div>
  );
}

function DocumentsCard() {
  const { language } = useLanguage();
  const es = language === 'es';
  const fr = language === 'fr';
  const [docTimer, setDocTimer] = useState(180);
  useEffect(() => {
    const t = setInterval(() => setDocTimer(s => s > 0 ? s - 1 : 180), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(docTimer / 60);
  const s = docTimer % 60;
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  const pdfUrl = '/UNSC_RESOLUTION.pdf';
  return (
    <div className="w-full rounded-2xl overflow-hidden flex flex-row" style={{ ...shadow, minHeight: '460px', border: '1px solid #DDD4C0' }}>
      <div className="flex flex-col" style={{ width: '42%', borderRight: '1px solid #DDD4C0', backgroundColor: '#FAF8F3' }}>
        <div className="px-4 py-3" style={{ backgroundColor: '#1B3828' }}>
          <p className="font-black text-xs uppercase tracking-widest" style={{ color: '#EED98A', fontFamily: "'DM Mono', monospace" }}>{fr ? 'TEMPS DE LECTURE' : es ? 'TIEMPO DE LECTURA' : 'READING TIME'}</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center">
          <p className="text-[10px] font-mono tracking-widest uppercase mb-1" style={{ color: '#9A8A78' }}>S/RES/2819 (2026)</p>
          <p className="font-black text-xs uppercase mb-4" style={{ color: '#1C1410' }}>{fr ? 'Résolution sur les Sanctions en Libye' : es ? 'Resolución de Sanciones a Libia' : 'Libya Sanctions Resolution'}</p>
          <p className="font-mono text-3xl font-bold tabular-nums mb-1" style={{ color: '#1C1410' }}>{m}:{s.toString().padStart(2, '0')}</p>
          <p className="text-[10px] font-mono mb-4" style={{ color: '#9A8A78' }}>{fr ? 'Temps de Lecture' : es ? 'Tiempo de Lectura' : 'Reading Time'}</p>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#DDD4C0' }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(docTimer / 180) * 100}%`, backgroundColor: '#1B3828' }} />
          </div>
          <div className="flex gap-2 mt-6 w-full">
            <button className="flex-1 py-2 rounded-xl font-black text-xs text-white" style={{ backgroundColor: '#2A5A3C' }}>{fr ? '▶ DÉMARRER' : es ? '▶ INICIO' : '▶ START'}</button>
            <button className="flex-1 py-2 rounded-xl font-black text-xs" style={{ backgroundColor: 'transparent', border: '1px solid #DDD4C0', color: '#6A5A4A' }}>{fr ? 'PASSER →' : es ? 'SALTAR →' : 'SKIP →'}</button>
          </div>
        </div>
      </div>
      <div className="flex flex-col" style={{ flex: 1, backgroundColor: '#EDE7D8' }}>
        <div className="px-3 py-2 flex items-center justify-between" style={{ backgroundColor: '#DDD4C0', borderBottom: '1px solid #C8BAA8' }}>
          <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: '#6A5A4A' }}>{fr ? 'Document' : es ? 'Documento' : 'Document'}</span>
          <span className="text-[10px] font-bold uppercase" style={{ color: '#1B3828' }}>{fr ? 'Masquer' : es ? 'Ocultar Doc' : 'Hide Doc'}</span>
        </div>
        <iframe
          src={pdfUrl}
          className="flex-1 w-full border-none"
          title="UNSC Resolution 2819 (2026)"
          style={{ minHeight: '380px' }}
        />
      </div>
    </div>
  );
}

function ChatCard() {
  const { language } = useLanguage();
  const es = language === 'es';
  const fr = language === 'fr';
  const messages = fr ? [
    { sender: 'Pdt.', text: 'Bienvenue à la session du Conseil sur la Non-Prolifération Nucléaire.', time: '09:02', isChair: true },
    { sender: 'France', text: 'La France est prête à s\'engager de manière constructive sur ce sujet.', time: '09:04', isChair: false },
    { sender: 'Pdt.', text: 'Vous faites du excellent travail ! Continuez ainsi !', time: '09:06', isChair: true },
    { sender: 'Allemagne', text: 'L\'Allemagne soutient la motion pour un caucus modéré.', time: '09:07', isChair: false },
  ] : es ? [
    { sender: 'Pdte.', text: 'Bienvenidos a la sesión del Consejo sobre No Proliferación Nuclear.', time: '09:02', isChair: true },
    { sender: 'Francia', text: 'Francia está dispuesta a participar constructivamente en este asunto.', time: '09:04', isChair: false },
    { sender: 'Pdte.', text: '¡Lo están haciendo muy bien! ¡Sigan así!', time: '09:06', isChair: true },
    { sender: 'Alemania', text: 'Alemania apoya la moción de un cáucus moderado.', time: '09:07', isChair: false },
  ] : [
    { sender: 'Chair', text: 'Welcome to the Security Council session on Nuclear Non-Proliferation.', time: '09:02', isChair: true },
    { sender: 'France', text: 'France is prepared to engage constructively on this matter.', time: '09:04', isChair: false },
    { sender: 'Chair', text: "You're doing great! Keep it up!", time: '09:06', isChair: true },
    { sender: 'Germany', text: 'Germany seconds the motion for a moderated caucus.', time: '09:07', isChair: false },
  ];
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  const convs = fr ? ['Tous', 'France', 'Allemagne'] : es ? ['Todos', 'Francia', 'Alemania'] : ['Everyone', 'France', 'Germany'];
  const convPreviews = fr
    ? ['Pdt. : Bienvenue...', 'France : Prête...', 'Allemagne : Soutient...']
    : es
    ? ['Pdte.: Bienvenidos...', 'Francia: Dispuesta...', 'Alemania: Apoya...']
    : ['Chair: Welcome...', 'France: Prepared...', 'Germany: Seconds...'];
  return (
    <div className="w-full rounded-2xl overflow-hidden flex flex-row" style={{ ...shadow, minHeight: '460px', border: '1px solid #DDD4C0' }}>
      {/* Left panel — forest green */}
      <div className="flex flex-col flex-shrink-0" style={{ width: '140px', backgroundColor: '#1B3828', borderRight: '1px solid #3D7A52' }}>
        <div className="px-3 py-3" style={{ borderBottom: '1px solid rgba(61,122,82,0.4)' }}>
          <p className="font-black text-xs uppercase tracking-widest" style={{ color: '#EED98A', fontFamily: "'Outfit', sans-serif" }}>{fr ? 'MESSAGES' : es ? 'MENSAJES' : 'MESSAGES'}</p>
        </div>
        <div className="flex-1">
          {convs.map((c, i) => (
            <div key={c} className="px-3 py-2.5" style={{ backgroundColor: i === 0 ? 'rgba(238,217,138,0.12)' : 'transparent', borderLeft: i === 0 ? '3px solid #EED98A' : '3px solid transparent', borderBottom: '1px solid rgba(61,122,82,0.2)' }}>
              <p className="text-xs font-bold truncate" style={{ color: i === 0 ? '#EED98A' : '#A8C5B0' }}>{c}</p>
              <p className="text-[9px] truncate mt-0.5" style={{ color: 'rgba(168,197,176,0.6)' }}>{convPreviews[i]}</p>
            </div>
          ))}
        </div>
        <div className="px-2 py-2.5" style={{ borderTop: '1px solid rgba(61,122,82,0.4)' }}>
          <button className="w-full text-xs py-1.5 rounded-lg font-semibold" style={{ color: '#EED98A', border: '1px solid rgba(238,217,138,0.3)' }}>{fr ? '+ Nouveau message' : es ? '+ Nuevo mensaje' : '+ New message'}</button>
        </div>
      </div>
      {/* Right panel — ivory */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: '#FAF8F3' }}>
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #DDD4C0', backgroundColor: 'rgba(250,248,243,0.8)' }}>
          <p className="font-black text-sm" style={{ color: '#1B3828' }}>{fr ? 'Tous' : es ? 'Todos' : 'Everyone'}</p>
          <p className="text-[10px]" style={{ color: '#9A8A78' }}>{fr ? '4 messages' : es ? '4 mensajes' : '4 messages'}</p>
        </div>
        <div className="flex-1 px-3 py-3 flex flex-col gap-2.5 overflow-hidden">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.isChair ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[80%] gap-0.5 ${msg.isChair ? 'items-end' : 'items-start'}`}>
                <div className="px-3 py-2 rounded-2xl text-xs leading-snug" style={{
                  backgroundColor: msg.isChair ? '#1B3828' : '#EDE7D8',
                  color: msg.isChair ? '#EDE7D8' : '#1C1410',
                  borderBottomRightRadius: msg.isChair ? '4px' : '16px',
                  borderBottomLeftRadius: msg.isChair ? '16px' : '4px',
                  border: msg.isChair ? 'none' : '1px solid #DDD4C0',
                }}>
                  {msg.text}
                </div>
                <span className="text-[9px] font-mono" style={{ color: '#9A8A78' }}>{msg.isChair ? (fr ? 'Vous' : es ? 'Tú' : 'You') : msg.sender} · {msg.time}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 pb-3 pt-2 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid #DDD4C0' }}>
          <div className="flex-1 rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', color: '#9A8A78' }}>{fr ? 'Message au comité…' : es ? 'Mensaje al comité…' : 'Message the committee…'}</div>
          <button className="px-3 py-2 rounded-xl text-xs font-black" style={{ backgroundColor: '#1B3828', color: '#EDE7D8' }}>→</button>
        </div>
      </div>
    </div>
  );
}

function ArchiveCard() {
  const { language } = useLanguage();
  const es = language === 'es';
  const fr = language === 'fr';
  const base = 'w-full bg-[#FAF8F3] rounded-2xl border border-[#DDD4C0] overflow-hidden';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  const menuItems = fr ? ['Sessions Sauvegardées', 'Statistiques', 'Ma Progression'] : es ? ['Sesiones Guardadas', 'Estadísticas', 'Mi Progreso'] : ['Saved Sessions', 'Session Statistics', 'My Progress'];
  return (
    <div className={base} style={{ ...shadow, minHeight: '460px' }}>
      <div className="bg-[#1B3828] px-5 py-3 flex items-center justify-between">
        <p className="text-[#EED98A] font-black text-sm uppercase tracking-wide">{fr ? 'Archive de Session' : es ? 'Archivo de Sesión' : 'Session Archive'}</p>
        <span className="bg-[#3D7A52] text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest">{fr ? 'Bientôt' : es ? 'Próximamente' : 'Coming Soon'}</span>
      </div>
      <div className="px-5 py-6 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#EDE7D8] border border-[#DDD4C0] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
        </div>
        <h3 className="font-black text-[#1C1410] uppercase text-sm tracking-wide mb-2">{fr ? 'Votre Tableau de Bord' : es ? 'Tu Panel de Comité' : 'Your Committee Dashboard'}</h3>
        <p className="text-[#6A5A4A] text-xs leading-relaxed mb-6 max-w-xs">{fr ? 'Suivez les sessions, statistiques et la progression des délégués en un seul endroit.' : es ? 'Seguimiento de sesiones, estadísticas y progreso de delegados en un solo lugar.' : 'Track sessions, statistics, and delegate progress all in one place.'}</p>
        <div className="flex flex-col gap-2.5 w-full">
          {menuItems.map((label) => (
            <div key={label} className="flex items-center gap-3 bg-[#1B3828] rounded-xl px-4 py-3.5">
              <div className="w-2 h-2 rounded-full bg-[#EED98A] flex-shrink-0" />
              <span className="text-sm font-bold text-[#EED98A] uppercase tracking-wide flex-1 text-left">{label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EED98A" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ id }: { id: string }) {
  if (id === 'roll-call') return <RollCallCard />;
  if (id === 'motions') return <MotionsCard />;
  if (id === 'speakers') return <SpeakersCard />;
  if (id === 'documents') return <DocumentsCard />;
  if (id === 'chat') return <ChatCard />;
  if (id === 'archive') return <ArchiveCard />;
  return null;
}

function FeatureCarousel({
  activeFeature,
}: {
  activeFeature: string;
  setActiveFeature: (id: string) => void;
}) {
  const featureIds = ['roll-call', 'motions', 'speakers', 'documents', 'chat', 'archive'];
  return (
    <div className="relative" style={{ height: '520px' }}>
      {featureIds.map((id) => (
        <div
          key={id}
          className="absolute inset-0"
          style={{
            opacity: id === activeFeature ? 1 : 0,
            transform: id === activeFeature ? 'translateY(0px) scale(1)' : 'translateY(20px) scale(0.97)',
            transition: 'opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: id === activeFeature ? 'auto' : 'none',
          }}
        >
          <FeatureCard id={id} />
        </div>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function HomeClient() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [activeFeature, setActiveFeature] = useState('roll-call');
  const t = useT();
  const { language } = useLanguage();
  const steps = [
    { step: '01', title: t('step1_title'), desc: t('step1_desc') },
    { step: '02', title: t('step2_title'), desc: t('step2_desc') },
    { step: '03', title: t('step3_title'), desc: t('step3_desc') },
  ];
  const [rejoinData, setRejoinData] = useState<{
    code: string; chairName: string; committeeTitle: string; savedAt: number; chairSuffix?: string | null;
  } | null>(null);

  useEffect(() => {
    try {
      // Also check old key name for backward compat
      const raw = localStorage.getItem('gavelling-rejoin') ?? localStorage.getItem('gavelling_active_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        const dismissedCode = localStorage.getItem('gavelling-rejoin-dismissed');
        if (parsed.code === dismissedCode) {
          localStorage.removeItem('gavelling-rejoin');
          return;
        }
        const eightHours = 18 * 60 * 60 * 1000;
        if (Date.now() - parsed.savedAt < eightHours) {
          // Migrate old key to new key if needed
          localStorage.setItem('gavelling-rejoin', raw);
          localStorage.removeItem('gavelling_active_session');
          setRejoinData(parsed);
        } else {
          localStorage.removeItem('gavelling-rejoin');
          localStorage.removeItem('gavelling_active_session');
        }
      }
    } catch { /* ignore */ }
  }, []);

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 4) {
      const isChairCode = code.includes('-') && code.split('-').pop()?.length === 4;
      if (isChairCode) {
        router.push(`/join?code=${encodeURIComponent(code)}&mode=chair`);
      } else {
        router.push(`/join?code=${encodeURIComponent(code)}`);
      }
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Gavelling',
            url: 'https://gavelling.com',
            description: 'Modern MUN committee software. Manage roll call, speakers lists, motions, and voting — all in one place.',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com', email: 'wearegavelling@gmail.com' },
          }),
        }}
      />
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes textReveal {
          0%   { opacity: 0; transform: translateY(28px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .text-reveal-3 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 1.9s; }
        .text-reveal-4 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 2.1s; }
        .text-reveal-5 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 2.3s; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .scroll-reveal { opacity: 0; }
        .scroll-reveal.visible { animation: fadeInUp 0.7s cubic-bezier(0.4, 0, 0.2, 1) both; }
        .scroll-reveal.visible:nth-child(2) { animation-delay: 0.1s; }
        .scroll-reveal.visible:nth-child(3) { animation-delay: 0.2s; }
      `}</style>

      <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">
        <div className="relative z-10 flex flex-col">

          {/* Grain overlay */}
          <div
            className="pointer-events-none fixed inset-0 z-[1]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '300px 300px',
              mixBlendMode: 'multiply',
              opacity: 0.18,
            }}
          />

          <SiteNav />

          {/* Hero */}
          <section className="relative z-10 flex flex-col items-center justify-center overflow-hidden" style={{ height: 'calc(100vh - 72px)' }}>
            <div className="absolute inset-0 z-0">
              <video autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.55 }}>
                <source src="/hero_no_audio.webm" type="video/webm" />
                <source src="/hero_no_audio.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(237,231,216,0.6) 70%, rgba(237,231,216,0.95) 100%)' }} />
              <div className="absolute bottom-0 left-0 right-0 h-48" style={{ background: 'linear-gradient(to bottom, transparent, #EDE7D8)' }} />
              <div className="absolute top-0 left-0 bottom-0 w-[55%]" style={{ background: 'linear-gradient(to right, rgba(237,231,216,0.85) 0%, rgba(237,231,216,0.5) 60%, transparent 100%)' }} />
              <div className="absolute top-0 left-0 right-0 h-40" style={{ background: 'linear-gradient(to bottom, rgba(237,231,216,0.98) 0%, rgba(237,231,216,0.7) 50%, transparent 100%)' }} />
            </div>

            <div className="relative z-10 flex items-center px-8 md:px-14">
              <div className="flex flex-col justify-center items-center text-center w-full max-w-2xl mx-auto">
                <h1 className="font-black tracking-tight text-white leading-[1.05] mb-5 text-center md:whitespace-nowrap" style={{ fontSize: 'clamp(48px, 13.5vw, 165px)' }}>
                  {language === 'fr' ? (
                    <>
                      MUN comme il{' '}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#B8844A' }}>
                        se doit.
                      </span>
                    </>
                  ) : language === 'en' ? (
                    <>
                      MUN done{' '}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#B8844A' }}>
                        right.
                      </span>
                    </>
                  ) : (
                    <>
                      MUN como se{' '}
                      <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#B8844A' }}>
                        debe.
                      </span>
                    </>
                  )}
                </h1>
                <p className="text-reveal-3 text-lg max-w-lg mb-6 leading-relaxed font-medium text-center text-[#1B3828]" style={{
                  opacity: 0,
                  backgroundColor: 'rgba(246,241,233,0.55)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  borderRadius: '12px',
                  padding: '10px 20px',
                }}>
                  {t('hero_subtitle')}
                </p>
                <button
                  onClick={() => router.push('/create')}
                  className="text-reveal-4 bg-[#1B3828] hover:bg-[#2A5A3C] active:scale-[0.98] text-[#EED98A] px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#1B3828]/20 mb-5 w-fit mx-auto"
                  style={{ opacity: 0 }}
                >
                  {t('hero_start_committee')}
                </button>
                <div className="text-reveal-5 flex flex-col gap-2 w-fit items-center" style={{
                  opacity: 0,
                  background: 'rgba(237,231,216,0.45)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  borderRadius: '14px',
                  padding: '12px 20px',
                }}>
                  <p className="text-xs text-[#1B3828] tracking-[0.16em] uppercase font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{t('hero_join_session')}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('hero_session_code')}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 20))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                      maxLength={20}
                      className="bg-[#FAF8F3]/90 border border-[#DDD4C0] focus:border-[#1B3828] rounded-xl px-4 py-3 text-[#1C1410] placeholder-[#9A8A78] focus:outline-none text-sm tracking-widest uppercase text-center transition-colors w-44 backdrop-blur-sm"
                      style={{ fontFamily: "'DM Mono', monospace" }}
                    />
                    <button
                      onClick={handleJoin}
                      disabled={joinCode.trim().length < 4}
                      className="bg-[#1B3828] hover:bg-[#2A5A3C] disabled:opacity-40 text-[#EED98A] px-5 py-3 rounded-xl font-bold text-sm transition-colors"
                    >
                      {t('hero_join')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="relative z-10 bg-[#1B3828] pt-24 pb-20 px-6" style={{ marginTop: '-2px', paddingBottom: '120px' }}>
            <div>
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-14">
                  <h2 className="scroll-reveal text-5xl font-black text-white mb-4 uppercase tracking-wider">{t('how_title')}</h2>
                  <p className="scroll-reveal text-[#EED98A]/70 text-lg mb-4">{t('how_subtitle')}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#B6871F]/30 w-full max-w-6xl mx-auto mt-16">
                  {steps.map((s) => (
                    <div key={s.step} className="scroll-reveal text-center px-6 md:px-16 py-8 group relative overflow-hidden cursor-default flex flex-col items-center">
                      <div className="relative w-full flex justify-center mb-2 h-8">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-[#B6871F] opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-[0_0_20px_6px_rgba(182,135,31,0.5)]" />
                        <div
                          className="absolute top-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500"
                          style={{
                            width: '180px',
                            height: '120px',
                            background: 'linear-gradient(to bottom, rgba(182,135,31,0.25) 0%, transparent 100%)',
                            clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
                            borderRadius: '0 0 50% 50%',
                            filter: 'blur(8px)',
                          }}
                        />
                      </div>
                      <div className="text-7xl font-black text-[#2A5A3C]/40 mb-6 transition-all duration-300 group-hover:text-[#B6871F]/60 group-hover:scale-110 leading-none">{s.step}</div>
                      <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-wider">{s.title}</h3>
                      <p className="text-[#EED98A] text-base leading-relaxed opacity-0 group-hover:opacity-100 transition-all duration-400 transform translate-y-3 group-hover:translate-y-0 max-w-xs mx-auto">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── FEATURE SHOWCASE SECTION ── */}
          <section id="features" className="relative z-10 bg-[#EDE7D8] px-8 md:px-16 scroll-reveal">
            <div className="w-full flex flex-col md:flex-row gap-12 items-center min-h-[calc(100vh-72px)]">

              {/* LEFT — text + pills centered */}
              <div className="w-full md:w-80 flex-shrink-0 flex flex-col justify-center items-start py-8">

                <h2 className="font-black uppercase tracking-wide leading-tight mb-4" style={{ fontSize: (language === 'es' || language === 'fr') ? 'clamp(22px, 2.6vw, 40px)' : 'clamp(28px, 3.2vw, 48px)' }}>
                  <span className="text-[#1B3828]">{t('features_title_1')}</span><br />
                  <span className="text-[#B8844A]">{t('features_title_2')}</span>
                </h2>

                <p className="text-[#6A5A4A] text-sm mb-5 leading-relaxed">
                  {t('features_subtitle')}
                </p>

                {/* Pills */}
                <div className="flex flex-col gap-1.5 w-full">
                  {[
                    { id: 'roll-call', icon: <Mic size={15} className="text-[#EED98A]" />, label: t('feature_rollcall') },
                    { id: 'motions', icon: <Scale size={15} className="text-[#EED98A]" />, label: t('feature_motions') },
                    { id: 'speakers', icon: <List size={15} className="text-[#EED98A]" />, label: t('feature_speakers') },
                    { id: 'documents', icon: <FileText size={15} className="text-[#EED98A]" />, label: t('feature_documents') },
                    { id: 'chat', icon: <MessageSquare size={15} className="text-[#EED98A]" />, label: t('feature_chat') },
                    { id: 'archive', icon: <Save size={15} className="text-[#EED98A]" />, label: t('feature_archives') },
                  ].map((f) => (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 rounded-xl px-4 cursor-pointer transition-all duration-300 border ${
                        activeFeature === f.id
                          ? 'bg-[#2A5A3C] border-[#3D7A52] py-2.5 shadow-lg shadow-[#1B3828]/20'
                          : 'bg-[#1B3828] border-[#1B3828] py-2 hover:bg-[#2A5A3C]'
                      }`}
                      onClick={() => setActiveFeature(f.id)}
                    >
                      <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">{f.icon}</span>
                      <span className="text-xs font-bold text-[#EED98A] uppercase tracking-wide">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — click-only carousel, wider */}
              <div className="flex-1 flex justify-center items-center py-8">
                <div className="w-full" style={{ maxWidth: '680px' }}>
                  <FeatureCarousel activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
                </div>
              </div>

            </div>
          </section>

          {/* Footer */}
          <footer
            className="relative z-10 border-t border-[#DDD4C0] px-6 py-8"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '300px 300px',
              backgroundColor: '#F6F1E9',
            }}
          >
            <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
              <img
                src="/GavellingLogo.png"
                alt="Gavelling"
                className="h-7 w-auto"
                style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="flex items-center justify-center gap-4">
                <a href="https://www.instagram.com/wearegavelling/" target="_blank" rel="noopener noreferrer"
                  aria-label="Instagram"
                  style={{ color: '#9A8A78', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </a>
                <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
                  </svg>
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 md:items-end">
                <p className="text-xs font-semibold text-[#1B3828]">{t('home_footer_copy').replace('{year}', String(new Date().getFullYear()))}</p>
                <a href="/privacy" className="text-xs transition-colors" style={{ color: '#9A8A78' }} onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}>Privacy Policy</a>
              </div>
            </div>
          </footer>

        </div>
      </div>

      {rejoinData && (() => {
        const acronym = getCommitteeAcronym(rejoinData.committeeTitle);
        const logoUrl = REJOIN_LOGOS[acronym];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div
              className="rounded-2xl shadow-xl p-6 flex flex-col gap-4"
              style={{ backgroundColor: '#EDE7D8', border: '1px solid #DDD4C0', width: '320px' }}
            >
              {/* SESSION IN PROGRESS */}
              <p
                className="font-black uppercase tracking-widest text-center"
                style={{ color: '#B8844A', fontSize: '17px', letterSpacing: '0.12em' }}
              >
                Session in progress
              </p>

              {/* Logo + title row */}
              <div className="flex items-start gap-3">
                {logoUrl && (
                  <div
                    className="rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                    style={{ width: '56px', height: '56px', backgroundColor: 'rgba(27,56,40,0.08)', border: '1px solid rgba(27,56,40,0.12)' }}
                  >
                    <img
                      src={logoUrl}
                      alt={acronym}
                      width={36}
                      height={36}
                      style={{ objectFit: 'contain', width: '36px', height: '36px' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-black leading-snug" style={{ color: '#1B3828' }}>
                    {rejoinData.committeeTitle}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#6A5A4A' }}>
                    Signed in as <span className="font-semibold">{rejoinData.chairName}</span>
                  </p>
                </div>
              </div>

              {/* Code badge + password row */}
              <div className="flex flex-col gap-1.5">
                <div
                  className="w-full flex items-center justify-center rounded-xl py-2"
                  style={{ backgroundColor: '#F5F0E8', border: '1.5px solid #C8BFB0' }}
                >
                  <p
                    className="font-black tracking-widest"
                    style={{ color: '#1C1410', fontFamily: "'DM Mono', monospace", fontSize: '15px', letterSpacing: '0.18em' }}
                  >
                    {rejoinData.code.toUpperCase()}
                  </p>
                </div>
                {rejoinData.chairSuffix && (
                  <p className="text-xs text-center" style={{ color: '#6A5A4A' }}>
                    Password: <span className="font-black" style={{ fontFamily: "'DM Mono', monospace", color: '#1B3828' }}>{rejoinData.chairSuffix}</span>
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => { window.location.href = `/chair/${rejoinData.code}`; }}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm transition-colors"
                  style={{ backgroundColor: '#1B3828', color: '#EED98A' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A5A3C'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1B3828'; }}
                >
                  Rejoin →
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('gavelling-rejoin-dismissed', rejoinData.code);
                    localStorage.removeItem('gavelling-rejoin');
                    setRejoinData(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm border transition-colors"
                  style={{ borderColor: '#DDD4C0', color: '#1B3828', backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#DDD4C0'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
