'use client';

import Link from 'next/link';

const features = [
  {
    icon: '🎙️',
    title: 'Speakers List Management',
    description: 'Real-time General Speakers List with customizable speaking times, automatic timer, and yield management.',
  },
  {
    icon: '⚖️',
    title: 'Motion System',
    description: 'Collect, vote on, and manage motions for moderated/unmoderated caucus, closure of debate, and adjournment.',
  },
  {
    icon: '⏱️',
    title: 'Caucus Timers',
    description: 'Integrated countdown timers for both moderated and unmoderated caucuses with automatic session tracking.',
  },
  {
    icon: '📋',
    title: 'Roll Call & Attendance',
    description: 'Manage delegate presence with present, absent, and present-voting status. Track quorum automatically.',
  },
  {
    icon: '📄',
    title: 'Resolution Panel',
    description: 'Submit, review, approve, and debate draft resolutions with a structured dais approval workflow.',
  },
  {
    icon: '🗳️',
    title: 'Voting Procedure',
    description: 'Structured voting procedure for draft resolutions with real-time tally and automatic pass/fail determination.',
  },
  {
    icon: '💬',
    title: 'Committee Chat',
    description: 'Secure real-time messaging between delegates and the dais for notes, queries, and announcements.',
  },
  {
    icon: '🌐',
    title: 'Multi-Role Access',
    description: 'Separate views for Chairs, Assistant Directors, and Delegates with role-appropriate controls.',
  },
];

const steps = [
  { step: '01', title: 'Create a Committee', desc: 'Chair enters committee name, topic, and adds all delegate countries.' },
  { step: '02', title: 'Share the Code', desc: 'Delegates join with a 6-character session code from any device.' },
  { step: '03', title: 'Run the Session', desc: 'Manage roll call, speakers list, motions, and voting — all in one place.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <nav className="border-b border-[#1e2540] bg-[#0a0e1a]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold">
              M
            </div>
            <span className="font-bold text-lg tracking-tight text-white">MUN Command</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#8892aa]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/join" className="text-sm text-[#8892aa] hover:text-white transition-colors px-4 py-2">
              Join Session
            </Link>
            <Link href="/create" className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              Start Committee
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-6 pt-28 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-950/50 border border-blue-800/40 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Now with real-time session sync
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-none mb-6">
          The Command Center<br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            for Every Committee
          </span>
        </h1>
        <p className="text-xl text-[#8892aa] max-w-2xl mx-auto mb-12 leading-relaxed">
          MUN Command gives chairs and directors everything they need to run
          professional, efficient, and engaging Model UN sessions — from roll call to final voting.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/create"
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors inline-flex items-center gap-2 justify-center"
          >
            Start Your Committee
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/join"
            className="border border-[#2a3050] hover:border-[#3a4060] text-[#c0c8d8] hover:text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors inline-flex items-center justify-center"
          >
            Join as Delegate
          </Link>
        </div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black text-white mb-4">Everything a Committee Needs</h2>
          <p className="text-[#8892aa] text-lg max-w-xl mx-auto">
            Built by MUN delegates for MUN delegates. Every feature designed around how real committees run.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-6 hover:border-blue-700/40 hover:bg-[#121829] transition-all"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-white mb-2 text-sm">{f.title}</h3>
              <p className="text-xs text-[#8892aa] leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#0d1120] border-y border-[#1e2540] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">Up and Running in Minutes</h2>
            <p className="text-[#8892aa] text-lg">No downloads, no setup. Just open your browser and start chairing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-6xl font-black text-[#1a2040] mb-4">{s.step}</div>
                <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                <p className="text-[#8892aa]">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-16">
            <Link
              href="/create"
              className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-bold text-lg transition-colors inline-block"
            >
              Create Your First Committee →
            </Link>
          </div>
        </div>
      </section>

      <footer className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold">
            M
          </div>
          <span className="font-bold text-white">MUN Command</span>
        </div>
        <p className="text-sm text-[#4a5580]">
          © {new Date().getFullYear()} MUN Command. Built for the MUN community.
        </p>
        <div className="flex gap-6 text-sm text-[#4a5580]">
          <Link href="/create" className="hover:text-white transition-colors">Create</Link>
          <Link href="/join" className="hover:text-white transition-colors">Join</Link>
        </div>
      </footer>
    </div>
  );
}
