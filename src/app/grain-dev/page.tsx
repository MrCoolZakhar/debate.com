'use client';

import { useState } from 'react';
import Link from 'next/link';

const BLEND_MODES = ['screen', 'overlay', 'multiply', 'soft-light', 'hard-light', 'luminosity'] as const;
type BlendMode = typeof BLEND_MODES[number];

export default function GrainDevPage() {
  const [isDark, setIsDark] = useState(true);
  const [opacity, setOpacity] = useState(0.07);
  const [blendMode, setBlendMode] = useState<BlendMode>('screen');
  const [tileSize, setTileSize] = useState(300);
  const [showSideBySide, setShowSideBySide] = useState(false);

  const bg = isDark ? '#F6F1E9' : '#F5EFE7';
  const textPrimary = isDark ? '#FFFFFF' : '#EDE7D8';
  const textMuted = isDark ? '#6A5A4A' : '#1B3828';
  const textFaint = isDark ? '#9A8A78' : '#C99A30';
  const border = isDark ? '#DDD4C0' : '#3D2E22';
  const cardBg = isDark ? '#EDE7D8' : '#EDE3D6';
  const navBg = isDark ? '#FAF8F3' : '#EAE0D2';

  function GrainLayer({ op, blend }: { op: number; blend: BlendMode }) {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'url(/background-grain.png)',
          backgroundRepeat: 'repeat',
          backgroundSize: `${tileSize}px ${tileSize}px`,
          mixBlendMode: blend as React.CSSProperties['mixBlendMode'],
          opacity: op,
          zIndex: 1,
        }}
      />
    );
  }

  function LandingHero({ darkMode }: { darkMode: boolean }) {
    const bgColor = darkMode ? '#F6F1E9' : '#F5EFE7';
    const txt = darkMode ? '#FFFFFF' : '#EDE7D8';
    const muted = darkMode ? '#6A5A4A' : '#1B3828';
    const faint = darkMode ? '#9A8A78' : '#C99A30';
    const bd = darkMode ? '#DDD4C0' : '#3D2E22';
    const card = darkMode ? '#EDE7D8' : '#EDE3D6';
    const nav = darkMode ? '#FAF8F3' : '#EAE0D2';

    return (
      <div className="relative overflow-hidden flex flex-col" style={{ backgroundColor: bgColor, minHeight: showSideBySide ? '100vh' : undefined }}>
        <GrainLayer op={opacity} blend={blendMode} />

        {/* Nav */}
        <nav className="relative z-10 px-8 h-16 flex items-center shrink-0" style={{ borderBottom: `1px solid ${bd}`, backgroundColor: nav }}>
          <img
            src="/GavellingLogo.png"
            alt="Gavelling"
            className="w-[16vw] h-auto max-h-9 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="ml-4 text-xs font-mono px-2 py-1 rounded" style={{ color: faint, border: `1px solid ${bd}` }}>
            {darkMode ? '🌑 DARK' : '☀️ LIGHT'}
          </span>
        </nav>

        {/* Hero */}
        <section className="relative z-10 flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-8"
            style={{ backgroundColor: `${muted}18`, border: `1px solid ${bd}`, color: muted }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#2A5A3C] animate-pulse shrink-0" />
            Free to use · No account needed
          </div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.05] mb-5" style={{ color: txt }}>
            Run Your Committee<br />
            <span style={{ color: '#B6871F' }}>with Confidence</span>
          </h1>

          <p className="text-lg max-w-md mb-12 leading-relaxed" style={{ color: muted }}>
            Gavelling gives chairs everything they need — from roll call to final voting.
          </p>

          <div className="px-10 py-5 rounded-2xl font-black text-xl text-[#1C1410] mb-6 shadow-lg"
            style={{ backgroundColor: '#1B3828', boxShadow: '0 8px 24px rgba(123,74,30,0.25)' }}>
            Start Your Committee →
          </div>

          <div className="w-full max-w-xs">
            <p className="text-xs mb-2 font-mono tracking-wider" style={{ color: faint }}>JOIN A SESSION</p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-xl px-4 py-3 text-sm font-mono text-center" style={{ backgroundColor: darkMode ? '#FAF8F3' : '#E8DDD0', border: `1px solid ${bd}`, color: faint }}>
                Session code
              </div>
              <div className="px-4 py-3 rounded-xl font-bold text-sm" style={{ backgroundColor: darkMode ? '#DDD4C0' : '#3D2E22', border: `1px solid ${bd}`, color: muted }}>
                Join →
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative z-10 py-14 px-6" style={{ borderTop: `1px solid ${bd}` }}>
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-8 text-center">
            {[
              { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and delegates.' },
              { step: '02', title: 'Share the Code', desc: 'Delegates join instantly with a session code.' },
              { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, and voting.' },
            ].map((s) => (
              <div key={s.step}>
                <div className="text-4xl font-black mb-3" style={{ color: bd }}>{s.step}</div>
                <h3 className="text-sm font-bold mb-1" style={{ color: txt }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: faint }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Dev controls bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-4 py-2 text-xs"
        style={{ backgroundColor: '#111', borderBottom: '1px solid #333', color: '#aaa' }}>

        <Link href="/" className="text-[#1B3828] hover:text-[#6A5A4A] font-bold mr-2">← back</Link>
        <span className="font-mono text-yellow-400 font-bold">GRAIN DEV</span>

        {/* Dark / Light toggle */}
        {!showSideBySide && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span>Dark</span>
            <button
              onClick={() => setIsDark((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isDark ? 'bg-[#1B3828]' : 'bg-[#6A5A4A]'}`}
            >
              <span className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white transition-transform shadow ${isDark ? 'translate-x-0' : 'translate-x-5'}`} />
            </button>
            <span>Light</span>
          </label>
        )}

        {/* Side by side toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={showSideBySide} onChange={(e) => setShowSideBySide(e.target.checked)} className="accent-[#1B3828]" />
          <span>Side by side</span>
        </label>

        <div className="w-px h-4 bg-[#333] mx-1" />

        {/* Opacity */}
        <label className="flex items-center gap-2">
          <span>Opacity</span>
          <input
            type="range" min="0" max="0.5" step="0.005"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-24 accent-[#1B3828]"
          />
          <span className="font-mono w-10">{opacity.toFixed(3)}</span>
        </label>

        {/* Tile size */}
        <label className="flex items-center gap-2">
          <span>Tile</span>
          <input
            type="range" min="50" max="800" step="50"
            value={tileSize}
            onChange={(e) => setTileSize(parseInt(e.target.value))}
            className="w-20 accent-[#1B3828]"
          />
          <span className="font-mono w-8">{tileSize}</span>
        </label>

        {/* Blend mode */}
        <label className="flex items-center gap-2">
          <span>Blend</span>
          <select
            value={blendMode}
            onChange={(e) => setBlendMode(e.target.value as BlendMode)}
            className="bg-[#222] border border-[#444] rounded px-1.5 py-0.5 text-[#1C1410] text-xs"
          >
            {BLEND_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        {/* Copy values */}
        <button
          onClick={() => {
            const css = `opacity: ${opacity};\nmix-blend-mode: ${blendMode};\nbackground-size: ${tileSize}px ${tileSize}px;`;
            navigator.clipboard.writeText(css);
          }}
          className="ml-auto px-2 py-1 rounded text-[#1B3828] hover:text-[#6A5A4A] border border-[#333] transition-colors"
        >
          Copy CSS
        </button>
      </div>

      {/* Preview area */}
      <div className="pt-9">
        {showSideBySide ? (
          <div className="flex">
            <div className="flex-1 border-r border-[#333]">
              <LandingHero darkMode={true} />
            </div>
            <div className="flex-1">
              <LandingHero darkMode={false} />
            </div>
          </div>
        ) : (
          <LandingHero darkMode={isDark} />
        )}
      </div>

      {/* Grain visibility note */}
      <div className="fixed bottom-4 right-4 text-[10px] font-mono text-[#555] text-right leading-snug">
        grain: opacity {opacity.toFixed(3)} · {blendMode} · {tileSize}px tile
      </div>
    </div>
  );
}
