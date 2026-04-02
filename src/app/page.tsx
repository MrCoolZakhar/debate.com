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
            <img src="/gavelling-logo.png" alt="Gavelling" className="h-9 w-auto" />
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
          <img src="/gavelling-logo.png" alt="Gavelling" className="h-8 w-auto" />
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
