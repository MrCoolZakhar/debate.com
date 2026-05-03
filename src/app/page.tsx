'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Scale, List, FileText, MessageSquare, Save } from 'lucide-react';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
const steps = [
  { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and delegates. Pick a preset or builds custom.' },
  { step: '02', title: 'Share the Code', desc: 'Delegates, co-chairs, and faculty advisors join instantly with a session code from any device.' },
  { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, motions, and voting — all in one place.' },
];


// ── Individual feature card components ──────────────────────────────────────

function RollCallCard() {
  const base = 'w-full bg-[#FAF8F3] rounded-2xl border border-[#DDD4C0] overflow-hidden';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  const getFlag = (country: string) => {
    const c = getCountryByName(country);
    return c ? <img src={getFlagUrl(c.code)} alt={country} className="w-5 h-5 object-contain" /> : <span className="w-5 h-5 bg-[#DDD4C0] rounded-sm inline-block" />;
  };
  return (
    <div className={base} style={{ ...shadow, minHeight: '460px' }}>
      <div className="bg-[#1B3828] px-5 py-3 flex items-center justify-between">
        <p className="text-[#EED98A] font-black text-sm uppercase tracking-wide">Roll Call</p>
        <span className="bg-[#3D7A52] text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest">Pre-Session</span>
      </div>
      <div className="px-5 py-4">
        <div className="flex gap-2 mb-4">
          {['All Present', 'All P+V', 'Clear'].map(btn => (
            <button key={btn} className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg bg-[#1B3828] text-[#EED98A] border border-[#1B3828]">{btn}</button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            { country: 'France', status: 'P+V' },
            { country: 'Germany', status: 'P' },
            { country: 'Brazil', status: 'P+V' },
            { country: 'India', status: 'P' },
            { country: 'Japan', status: 'Absent' },
            { country: 'China', status: 'P+V' },
          ].map(d => (
            <div key={d.country} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#EDE7D8]">
              {getFlag(d.country)}
              <span className="flex-1 text-sm font-semibold text-[#1C1410] uppercase">{d.country}</span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${d.status === 'Absent' ? 'bg-[#DDD4C0] text-[#9A8A78]' : d.status === 'P+V' ? 'bg-[#EED98A] text-[#1B3828]' : 'bg-[#EAF1EC] text-[#1B3828]'}`}>{d.status}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-[#DDD4C0] flex items-center justify-between">
          <span className="text-xs font-mono text-[#9A8A78] uppercase tracking-wide">Quorum</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 bg-[#DDD4C0] rounded-full overflow-hidden">
              <div className="h-full w-[83%] bg-[#1B3828] rounded-full" />
            </div>
            <span className="text-xs font-mono text-[#1B3828] font-bold">5/6</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MotionsCard() {
  const base = 'w-full bg-[#FAF8F3] rounded-2xl border border-[#DDD4C0] overflow-hidden';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  return (
    <div className={base} style={{ ...shadow, minHeight: '460px' }}>
      <div className="bg-[#1B3828] px-5 py-3 flex items-center justify-between">
        <p className="text-[#EED98A] font-black text-sm uppercase tracking-wide">Pending Motions</p>
        <span className="bg-[#B6871F] text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest">3 Motions</span>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3">
        {[
          { type: 'Unmoderated Caucus', time: '15 min', proposer: 'France' },
          { type: 'Consultation of the Whole', time: '20 min', proposer: 'Germany' },
          { type: 'Moderated Caucus', time: '10 min / 90s', proposer: 'Brazil' },
        ].map(m => (
          <div key={m.type} className="rounded-xl border border-[#DDD4C0] overflow-hidden">
            <div className="px-4 py-2.5 flex items-center justify-between bg-[#EDE7D8]">
              <div>
                <p className="text-xs font-black text-[#1C1410] uppercase tracking-wide">{m.type}</p>
                <p className="text-[10px] text-[#9A8A78] font-mono mt-0.5">{m.time} · Proposed by {m.proposer}</p>
              </div>
              <div className="flex gap-1.5">
                <button className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-[#1B3828] text-[#EED98A]">Accept</button>
                <button className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-[#DDD4C0] text-[#6A5A4A]">Reject</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpeakersCard() {
  const [timerSecs, setTimerSecs] = useState(67);
  useEffect(() => {
    const t = setInterval(() => setTimerSecs(s => s > 0 ? s - 1 : 90), 1000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.floor(timerSecs / 60);
  const secs = timerSecs % 60;
  const base = 'w-full bg-[#FAF8F3] rounded-2xl border border-[#DDD4C0] overflow-hidden';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  return (
    <div className={base} style={{ ...shadow, minHeight: '460px' }}>
      <div className="bg-[#1B3828] px-5 py-3 flex items-center justify-between">
        <p className="text-[#EED98A] font-black text-sm uppercase tracking-wide">General Speakers List</p>
        <span className="flex items-center gap-1 bg-[#3D7A52] text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />Live
        </span>
      </div>
      <div className="px-5 py-4">
        <p className="text-[#9A8A78] text-[10px] font-mono tracking-widest uppercase mb-2">Currently Speaking</p>
        <div className="bg-[#1B3828] rounded-xl px-4 py-3 flex items-center gap-3 mb-2">
          <img src={(() => { const c = getCountryByName('France'); return c ? getFlagUrl(c.code) : ''; })()} alt="France" className="w-8 h-8 object-contain rounded-sm" />
          <div className="flex-1">
            <p className="text-[#EED98A] font-black text-sm uppercase">France</p>
            <p className="text-[#EED98A]/50 text-[10px] font-mono">Speaker 2 of 6</p>
          </div>
          <p className="text-[#EED98A] font-mono text-2xl font-bold tabular-nums">{mins}:{secs.toString().padStart(2, '0')}</p>
        </div>
        <div className="h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${(timerSecs / 90) * 100}%`, backgroundColor: timerSecs <= 10 ? '#8B2020' : timerSecs <= 30 ? '#B6871F' : '#3D7A52' }}
          />
        </div>
        <p className="text-[#9A8A78] text-[10px] font-mono tracking-widest uppercase mb-2">Up Next</p>
        {[
          { country: 'Germany', pos: 3 },
          { country: 'Brazil', pos: 4 },
          { country: 'India', pos: 5 },
        ].map(d => (
          <div key={d.country} className="flex items-center gap-3 bg-[#EDE7D8] rounded-xl px-3 py-2 mb-1.5">
            <span className="text-[#9A8A78] font-mono text-xs w-4 text-center font-bold">{d.pos}</span>
            <img src={(() => { const c = getCountryByName(d.country); return c ? getFlagUrl(c.code) : ''; })()} alt={d.country} className="w-5 h-5 object-contain" />
            <span className="text-sm font-semibold text-[#1C1410] flex-1 uppercase">{d.country}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsCard() {
  const [docTimer, setDocTimer] = useState(180);
  useEffect(() => {
    const t = setInterval(() => setDocTimer(s => s > 0 ? s - 1 : 180), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(docTimer / 60);
  const s = docTimer % 60;
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  return (
    <div
      className="w-full bg-[#FAF8F3] rounded-2xl border border-[#DDD4C0] overflow-hidden flex flex-row"
      style={{ ...shadow, minHeight: '460px' }}
    >
      <div className="w-2/5 border-r border-[#DDD4C0] flex flex-col">
        <div className="bg-[#1B3828] px-4 py-3">
          <p className="text-[#EED98A] font-black text-xs uppercase tracking-wide">Reading Time</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center">
          <p className="text-[#9A8A78] text-[10px] font-mono tracking-widest uppercase mb-1">S/RES/2767 (2024)</p>
          <p className="text-[#1C1410] font-black text-xs uppercase mb-4">Situation in Somalia</p>
          <p className="text-[#1B3828] font-mono text-3xl font-bold tabular-nums mb-1">{m}:{s.toString().padStart(2, '0')}</p>
          <p className="text-[#9A8A78] text-[10px] font-mono mb-4">Reading Time</p>
          <div className="w-full h-1.5 bg-[#DDD4C0] rounded-full overflow-hidden">
            <div className="h-full bg-[#1B3828] rounded-full transition-all duration-1000" style={{ width: `${(docTimer / 180) * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="w-3/5 bg-[#EDE7D8] flex flex-col">
        <div className="px-3 py-2 bg-[#DDD4C0] flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#6A5A4A] uppercase tracking-wide">Document</span>
          <span className="text-[10px] font-bold text-[#1B3828] uppercase">Show Doc</span>
        </div>
        <iframe
          src="https://www.un.org/unispal/wp-content/uploads/2024/09/n2425089.pdf"
          className="flex-1 w-full border-none"
          title="UNSC Resolution"
        />
      </div>
    </div>
  );
}

function ChatCard() {
  const messages = [
    { sender: 'Chair', text: 'Welcome to the Security Council session on Nuclear Non-Proliferation.', time: '09:02', isChair: true },
    { sender: 'France', text: 'France is prepared to engage constructively on this matter.', time: '09:04', isChair: false },
    { sender: 'Chair', text: "You're doing great! Keep it up!", time: '09:06', isChair: true },
    { sender: 'Germany', text: 'Germany seconds the motion for a moderated caucus.', time: '09:07', isChair: false },
  ];
  const base = 'w-full bg-[#FAF8F3] rounded-2xl border border-[#DDD4C0] overflow-hidden';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  return (
    <div className={base} style={{ ...shadow, minHeight: '460px' }}>
      <div className="bg-[#1B3828] px-5 py-3 flex items-center justify-between">
        <p className="text-[#EED98A] font-black text-sm uppercase tracking-wide">Committee Chat</p>
        <span className="flex items-center gap-1 bg-[#3D7A52] text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />Live
        </span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2.5" style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.isChair ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black ${msg.isChair ? 'bg-[#1B3828] text-[#EED98A]' : 'bg-[#EDE7D8] text-[#1C1410]'}`}>
              {msg.isChair ? '🪑' : msg.sender[0]}
            </div>
            <div className={`flex flex-col max-w-[75%] ${msg.isChair ? 'items-end' : 'items-start'}`}>
              <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${msg.isChair ? 'bg-[#1B3828] text-[#EED98A]' : 'bg-[#EDE7D8] text-[#1C1410]'}`}>
                {msg.text}
              </div>
              <span className="text-[9px] text-[#9A8A78] font-mono mt-0.5">{msg.sender} · {msg.time}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-[#DDD4C0] flex gap-2">
        <div className="flex-1 bg-[#EDE7D8] rounded-xl px-3 py-2 text-xs text-[#9A8A78] font-mono">Type a message...</div>
        <button className="px-3 py-2 bg-[#1B3828] rounded-xl text-[#EED98A] text-xs font-bold uppercase">Send</button>
      </div>
    </div>
  );
}

function ArchiveCard() {
  const base = 'w-full bg-[#FAF8F3] rounded-2xl border border-[#DDD4C0] overflow-hidden';
  const shadow = { boxShadow: '0 24px 64px rgba(27,56,40,0.14)' };
  return (
    <div className={base} style={{ ...shadow, minHeight: '460px' }}>
      <div className="bg-[#1B3828] px-5 py-3 flex items-center justify-between">
        <p className="text-[#EED98A] font-black text-sm uppercase tracking-wide">Session Archive</p>
        <span className="bg-[#3D7A52] text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase tracking-widest">Coming Soon</span>
      </div>
      <div className="px-5 py-6 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#EDE7D8] border border-[#DDD4C0] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
        </div>
        <h3 className="font-black text-[#1C1410] uppercase text-sm tracking-wide mb-2">Your Committee Dashboard</h3>
        <p className="text-[#6A5A4A] text-xs leading-relaxed mb-6 max-w-xs">Track sessions, statistics, and delegate progress all in one place.</p>
        <div className="flex flex-col gap-2.5 w-full">
          {['Saved Sessions', 'Session Statistics', 'My Progress'].map((label) => (
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
  setActiveFeature,
}: {
  activeFeature: string;
  setActiveFeature: (id: string) => void;
}) {
  const featureIds = ['roll-call', 'motions', 'speakers', 'documents', 'chat', 'archive'];
  const sectionRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const activeIndexRef = useRef(0);

  // Keep activeIndexRef in sync
  useEffect(() => {
    activeIndexRef.current = featureIds.indexOf(activeFeature);
  }, [activeFeature]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const inView = rect.top <= 100 && rect.bottom >= window.innerHeight * 0.4;
      if (!inView) return;

      const currentIndex = activeIndexRef.current;
      const scrollingDown = e.deltaY > 0;
      const scrollingUp = e.deltaY < 0;

      // Release at boundaries so page can scroll
      if (scrollingDown && currentIndex >= featureIds.length - 1) return;
      if (scrollingUp && currentIndex <= 0) return;

      // Hijack scroll
      e.preventDefault();
      e.stopPropagation();

      // Throttle — 700ms between transitions
      const now = Date.now();
      if (now - lastScrollTime.current < 700) return;
      lastScrollTime.current = now;

      if (scrollingDown) {
        const next = Math.min(currentIndex + 1, featureIds.length - 1);
        setActiveFeature(featureIds[next]);
      } else if (scrollingUp) {
        const prev = Math.max(currentIndex - 1, 0);
        setActiveFeature(featureIds[prev]);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []); // Empty deps — uses ref for current index, avoids stale closure

  return (
    <div ref={sectionRef} className="relative" style={{ height: '520px' }}>
      {featureIds.map((id) => (
        <div
          key={id}
          className="absolute inset-0"
          style={{
            opacity: id === activeFeature ? 1 : 0,
            transform: id === activeFeature
              ? 'translateY(0px) scale(1)'
              : 'translateY(24px) scale(0.97)',
            transition: 'opacity 0.45s cubic-bezier(0.4,0,0.2,1), transform 0.45s cubic-bezier(0.4,0,0.2,1)',
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

export default function LandingPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [activeFeature, setActiveFeature] = useState('roll-call');

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
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-1 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.05s; }
        .hero-2 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.18s; }
        .hero-3 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.30s; }
        .hero-4 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.42s; }
        .hero-5 { animation: fadeUp 0.55s cubic-bezier(0.4,0,0.2,1) both 0.54s; }
        @keyframes gavelFadeIn {
          0%   { opacity: 0; transform: translateX(120px) translateY(-52%); }
          100% { opacity: 1; transform: translateX(0) translateY(-52%); }
        }
        @keyframes textReveal {
          0%   { opacity: 0; transform: translateY(28px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .text-reveal-1 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 1.5s; }
        .text-reveal-2 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 1.7s; }
        .text-reveal-3 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 1.9s; }
        .text-reveal-4 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 2.1s; }
        .text-reveal-5 { animation: textReveal 0.6s cubic-bezier(0.4,0,0.2,1) both 2.3s; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .scroll-reveal {
          opacity: 0;
        }
        .scroll-reveal.visible {
          animation: fadeInUp 0.7s cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .scroll-reveal.visible:nth-child(2) { animation-delay: 0.1s; }
        .scroll-reveal.visible:nth-child(3) { animation-delay: 0.2s; }
      `}</style>

      <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">
        <div className="relative z-10 flex flex-col min-h-screen">
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

          {/* Nav */}
          <nav className="relative z-20 flex items-center justify-between px-8 md:px-14 py-5">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
              <img
                src="/GAVELLING__1_.png"
                alt="Gavelling"
                className="w-10 h-10 object-contain"
                style={{ mixBlendMode: 'multiply' }}
              />
              <div className="flex flex-col leading-none items-end">
                <span className="font-black text-[#1B3828] text-xl tracking-tight uppercase leading-none">Gavelling</span>
                <span className="text-[#B6871F] text-[9px] tracking-[0.14em] uppercase leading-none mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>Sessions</span>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <a href="#conferences" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide uppercase">Conferences</a>
              <a href="#courses" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide uppercase">Courses</a>
              <a href="#sessions" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide uppercase">Sessions</a>
              <a href="#about" className="text-[#1C1410] font-medium text-sm hover:text-[#1B3828] transition-colors tracking-wide uppercase">About Us</a>
            </div>
          </nav>

          {/* Hero */}
          <section className="relative z-10 h-[calc(100vh-72px)] flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
              <video
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.55 }}
              >
                <source src="/hero_no_audio.webm" type="video/webm" />
                <source src="/hero_no_audio.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0" style={{
                background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(237,231,216,0.6) 70%, rgba(237,231,216,0.95) 100%)',
              }} />
              <div className="absolute bottom-0 left-0 right-0 h-48" style={{
                background: 'linear-gradient(to bottom, transparent, #EDE7D8)',
              }} />
              <div className="absolute top-0 left-0 bottom-0 w-[55%]" style={{
                background: 'linear-gradient(to right, rgba(237,231,216,0.85) 0%, rgba(237,231,216,0.5) 60%, transparent 100%)',
              }} />
              <div className="absolute top-0 left-0 right-0 h-40" style={{
                background: 'linear-gradient(to bottom, rgba(237,231,216,0.98) 0%, rgba(237,231,216,0.7) 50%, transparent 100%)',
              }} />
            </div>

            <div className="relative z-10 flex items-center px-8 md:px-14">
              <div className="flex flex-col justify-center items-center text-center w-full max-w-2xl mx-auto">
                <h1 className="font-black tracking-tight text-white leading-[1.05] mb-5 text-center whitespace-nowrap" style={{ fontSize: 'clamp(90px, 13.5vw, 165px)' }}>
                  MUN done{' '}
                  <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#B8844A' }}>
                    right.
                  </span>
                </h1>
                <p className="text-reveal-3 text-lg max-w-lg mb-6 leading-relaxed font-medium text-center text-[#1B3828]" style={{
                  opacity: 0,
                  backgroundColor: 'rgba(246,241,233,0.55)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  borderRadius: '12px',
                  padding: '10px 20px',
                }}>
                  The most user-friendly way to run your MUN committee.
                </p>
                <button
                  onClick={() => router.push('/create')}
                  className="text-reveal-4 bg-[#1B3828] hover:bg-[#2A5A3C] active:scale-[0.98] text-[#EED98A] px-10 py-5 rounded-2xl font-black text-xl transition-all shadow-lg shadow-[#1B3828]/20 mb-5 w-fit mx-auto"
                  style={{ opacity: 0 }}
                >
                  START YOUR COMMITTEE →
                </button>
                <div className="text-reveal-5 flex flex-col gap-2 w-fit items-center" style={{
                  opacity: 0,
                  background: 'rgba(237,231,216,0.45)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  borderRadius: '14px',
                  padding: '12px 20px',
                }}>
                  <p className="text-xs text-[#1B3828] tracking-[0.16em] uppercase font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>Join a Session</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="SESSION CODE"
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
                      JOIN →
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
                  <h2 className="scroll-reveal text-5xl font-black text-white mb-4 uppercase tracking-wider">Up and Running in Minutes</h2>
                  <p className="scroll-reveal text-[#EED98A]/70 text-lg mb-4">No downloads, no setup. Just open your browser and start chairing.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#B6871F]/30 w-full max-w-6xl mx-auto mt-16">
                  {steps.map((s) => (
                    <div key={s.step} className="scroll-reveal text-center px-16 py-8 group relative overflow-hidden cursor-default flex flex-col items-center">
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
          <section id="features" className="relative z-10 bg-[#EDE7D8] px-8 md:px-20 scroll-reveal">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12">

              {/* LEFT — sticky text + pills */}
              <div className="w-72 flex-shrink-0 sticky top-16 self-start py-12">

                <div className="inline-flex items-center gap-2 bg-[#EAF1EC] border border-[#C8D8C0] text-[#1B3828] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 w-fit tracking-widest uppercase" style={{ fontFamily: "'DM Mono', monospace" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3D7A52]" />
                  Built for Chairs
                </div>

                <h2 className="font-black uppercase tracking-wide leading-tight mb-5" style={{ fontSize: 'clamp(20px, 2.4vw, 34px)' }}>
                  <span className="text-[#1B3828]">Everything chairs need</span><br />
                  <span className="text-[#B8844A]">to run committees.</span>
                </h2>

                <p className="text-[#6A5A4A] text-sm mb-6 leading-relaxed">
                  One dashboard. Every tool. From opening session to final voting.
                </p>

                {/* Pills — flex-col so each pill is independent height */}
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: 'roll-call', icon: <Mic size={15} className="text-[#EED98A]" />, label: 'Roll Call' },
                    { id: 'motions', icon: <Scale size={15} className="text-[#EED98A]" />, label: 'Motions & Voting' },
                    { id: 'speakers', icon: <List size={15} className="text-[#EED98A]" />, label: 'Speakers List' },
                    { id: 'documents', icon: <FileText size={15} className="text-[#EED98A]" />, label: 'Document Upload' },
                    { id: 'chat', icon: <MessageSquare size={15} className="text-[#EED98A]" />, label: 'Live Chat' },
                    { id: 'archive', icon: <Save size={15} className="text-[#EED98A]" />, label: 'Archives' },
                  ].map((f) => (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 rounded-xl px-4 cursor-pointer transition-all duration-300 border ${
                        activeFeature === f.id
                          ? 'bg-[#2A5A3C] border-[#3D7A52] py-2.5 shadow-lg shadow-[#1B3828]/20'
                          : 'bg-[#1B3828] border-[#1B3828] py-2 hover:bg-[#2A5A3C]'
                      }`}
                      onClick={() => {
                        setActiveFeature(f.id);
                        document.getElementById(`feature-${f.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <span className="flex items-center justify-center w-4 h-4 flex-shrink-0">{f.icon}</span>
                      <span className="text-xs font-bold text-[#EED98A] uppercase tracking-wide">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — wheel hijack carousel */}
              <div className="flex-1 py-12 flex justify-center items-start pl-8">
                <div className="w-full" style={{ maxWidth: '520px' }}>
                  <FeatureCarousel activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
                </div>
              </div>

            </div>
          </section>

          {/* Footer */}
          <footer
            className="relative z-10 border-t border-[#EDE7D8] px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='0.18'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '300px 300px',
              backgroundColor: '#F6F1E9',
            }}
          >
            <div className="flex items-center gap-2">
              <img
                src="/GAVELLING__1_.png"
                alt="Gavelling"
                className="w-8 h-8 object-contain"
                style={{ mixBlendMode: 'multiply' }}
              />
              <div className="flex flex-col leading-none items-end">
                <span className="font-black text-[#1B3828] text-base tracking-tight uppercase leading-none">Gavelling</span>
                <span className="text-[#B6871F] text-[8px] tracking-[0.14em] uppercase leading-none mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>Sessions</span>
              </div>
            </div>
            <p className="text-xs font-semibold text-[#1B3828]">© {new Date().getFullYear()} Gavelling. Built for the MUN community.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
