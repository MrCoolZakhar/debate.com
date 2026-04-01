'use client';

import Link from 'next/link';

const steps = [
  { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and delegates. Pick a preset or build custom.' },
  { step: '02', title: 'Share the Code', desc: 'Delegates join instantly with a 6-character session code from any device.' },
  { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, motions, and voting — all in one place.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Nav */}
      <nav className="bg-white border-b border-[#D4B896] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7B4A1E] to-[#4E7C45] flex items-center justify-center text-sm font-bold text-white">G</div>
            <span className="font-bold text-lg tracking-tight text-[#1A0F08]">Gavelling</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/join" className="text-sm text-[#5C3A1E] hover:text-[#1A0F08] transition-colors px-4 py-2">
              Join Session
            </Link>
            <Link href="/create" className="text-sm bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Start Committee
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#7B4A1E]/10 border border-[#D4B896] text-[#5C3A1E] text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3D6B35] animate-pulse" />
          Free to use · No account needed
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-[#1A0F08] leading-none mb-6">
          Run Your Committee<br />
          <span className="text-[#7B4A1E]">with Confidence</span>
        </h1>
        <p className="text-xl text-[#5C3A1E] max-w-2xl mx-auto mb-12 leading-relaxed">
          Gavelling gives chairs everything they need to run professional, efficient, and engaging sessions — from roll call to final voting.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/create"
            className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors inline-flex items-center gap-2 justify-center"
          >
            Start Your Committee
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/join"
            className="border border-[#D4B896] hover:border-[#7B4A1E] text-[#5C3A1E] hover:text-[#1A0F08] px-8 py-4 rounded-xl font-semibold text-lg transition-colors inline-flex items-center justify-center"
          >
            Join Session
          </Link>
        </div>
      </section>

      {/* THREE BIG BUBBLES */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Left: Regular Debate */}
          <div className="flex-1 bg-[#F0EDE8] border border-[#D4B896] rounded-3xl p-8 flex flex-col opacity-60">
            <div className="text-4xl mb-4">⚖️</div>
            <h3 className="text-2xl font-black text-[#5C3A1E] mb-2">Regular Debate</h3>
            <p className="text-[#5C3A1E] text-sm leading-relaxed flex-1">Coming soon — focused on for/against structures with structured rebuttal rounds.</p>
            <div className="mt-6 px-4 py-2 bg-[#D4B896]/40 rounded-xl text-center text-xs text-[#5C3A1E] font-semibold">Coming Soon</div>
          </div>

          {/* Middle: MUN — LARGE, ACTIVE */}
          <div className="flex-[1.4] bg-gradient-to-br from-[#7B4A1E] to-[#4E7C45] rounded-3xl p-8 flex flex-col shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 rounded-3xl" />
            <div className="relative">
              <div className="text-5xl mb-4">🌐</div>
              <h3 className="text-3xl font-black text-white mb-3">MUN</h3>
              <p className="text-white/80 text-sm leading-relaxed mb-4">Full Model UN committee management. Roll call, speakers list, motions, caucuses, resolutions, and voting procedures.</p>
              <ul className="text-white/70 text-xs space-y-1 mb-8">
                <li>✓ Roll call with quorum tracking</li>
                <li>✓ General Speakers List with timer</li>
                <li>✓ Moderated &amp; unmoderated caucus</li>
                <li>✓ Motion system with voting</li>
                <li>✓ Preset committees (UNSC, HRC, NATO...)</li>
              </ul>
              <Link href="/create"
                className="block w-full text-center bg-white text-[#7B4A1E] hover:bg-[#FAF7F2] px-6 py-3.5 rounded-2xl font-black text-base transition-colors">
                Launch your committee →
              </Link>
            </div>
          </div>

          {/* Right: Crisis */}
          <div className="flex-1 bg-[#F0EDE8] border border-[#D4B896] rounded-3xl p-8 flex flex-col opacity-60">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-2xl font-black text-[#5C3A1E] mb-2">Crisis</h3>
            <p className="text-[#5C3A1E] text-sm leading-relaxed flex-1">Coming soon — crisis arc management with directive tracking and press releases.</p>
            <div className="mt-6 px-4 py-2 bg-[#D4B896]/40 rounded-xl text-center text-xs text-[#5C3A1E] font-semibold">Coming Soon</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white border-y border-[#D4B896] py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A0F08] mb-4">Up and Running in Minutes</h2>
            <p className="text-[#5C3A1E] text-lg">No downloads, no setup. Just open your browser and start chairing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-6xl font-black text-[#D4B896] mb-4">{s.step}</div>
                <h3 className="text-xl font-bold text-[#1A0F08] mb-3">{s.title}</h3>
                <p className="text-[#5C3A1E]">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-16">
            <Link
              href="/create"
              className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors inline-block"
            >
              Create Your First Committee →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7B4A1E] to-[#4E7C45] flex items-center justify-center text-xs font-bold text-white">G</div>
          <span className="font-bold text-[#1A0F08]">Gavelling</span>
        </div>
        <p className="text-sm text-[#5C3A1E]">
          © {new Date().getFullYear()} Gavelling. Built for the MUN community.
        </p>
        <div className="flex gap-6 text-sm text-[#5C3A1E]">
          <Link href="/create" className="hover:text-[#1A0F08] transition-colors">Create</Link>
          <Link href="/join" className="hover:text-[#1A0F08] transition-colors">Join</Link>
        </div>
      </footer>
    </div>
  );
}
