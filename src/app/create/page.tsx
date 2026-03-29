'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';

const DEFAULT_COUNTRIES = [
  'United States', 'China', 'Russia', 'United Kingdom', 'France',
  'Germany', 'Brazil', 'India', 'Japan', 'Canada', 'Australia',
  'South Africa', 'Nigeria', 'Mexico', 'Argentina', 'Saudi Arabia',
  'Iran', 'Turkey', 'South Korea', 'Indonesia',
];

export default function CreatePage() {
  const router = useRouter();
  const createCommittee = useCommitteeStore((s) => s.createCommittee);

  const [committeeName, setCommitteeName] = useState('');
  const [topic, setTopic] = useState('');
  const [chairName, setChairName] = useState('');
  const [delegates, setDelegates] = useState<string[]>([...DEFAULT_COUNTRIES]);
  const [newDelegate, setNewDelegate] = useState('');
  const [step, setStep] = useState(1);

  const addDelegate = () => {
    const trimmed = newDelegate.trim();
    if (trimmed && !delegates.includes(trimmed)) {
      setDelegates([...delegates, trimmed]);
    }
    setNewDelegate('');
  };

  const removeDelegate = (country: string) => {
    setDelegates(delegates.filter((d) => d !== country));
  };

  const handleCreate = () => {
    if (!committeeName.trim() || !topic.trim() || !chairName.trim() || delegates.length === 0) return;
    const code = createCommittee(committeeName.trim(), topic.trim(), chairName.trim(), delegates);
    router.push(`/chair/${code}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col">
      {/* Nav */}
      <nav className="border-b border-[#1e2540] px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold">M</div>
          <span className="font-bold text-white">MUN Command</span>
        </Link>
        <Link href="/join" className="text-sm text-[#8892aa] hover:text-white transition-colors">
          Join as Delegate →
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <div className="flex gap-2 mb-6">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    step >= s ? 'bg-blue-600 text-white' : 'bg-[#1e2540] text-[#4a5580]'
                  }`}>{s}</div>
                  {s < 2 && <div className={`w-16 h-0.5 transition-colors ${step > s ? 'bg-blue-600' : 'bg-[#1e2540]'}`} />}
                </div>
              ))}
            </div>
            <h1 className="text-3xl font-black text-white">
              {step === 1 ? 'Committee Setup' : 'Add Delegates'}
            </h1>
            <p className="text-[#8892aa] mt-1">
              {step === 1 ? 'Configure your committee details' : `${delegates.length} delegates added`}
            </p>
          </div>

          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Committee Name</label>
                <input
                  type="text"
                  value={committeeName}
                  onChange={(e) => setCommitteeName(e.target.value)}
                  placeholder="e.g. Security Council, ECOSOC, DISEC"
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-lg px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Topic / Agenda Item</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The situation in the Middle East"
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-lg px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#c0c8d8] mb-2">Chair / Director Name</label>
                <input
                  type="text"
                  value={chairName}
                  onChange={(e) => setChairName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-[#0f1526] border border-[#1e2540] rounded-lg px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors"
                />
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!committeeName.trim() || !topic.trim() || !chairName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Next: Add Delegates →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newDelegate}
                  onChange={(e) => setNewDelegate(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDelegate()}
                  placeholder="Add country or delegate..."
                  className="flex-1 bg-[#0f1526] border border-[#1e2540] rounded-lg px-4 py-3 text-white placeholder-[#4a5580] focus:outline-none focus:border-blue-600 transition-colors"
                />
                <button
                  onClick={addDelegate}
                  className="bg-[#1e2540] hover:bg-[#2a3050] text-white px-5 py-3 rounded-lg font-medium transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="bg-[#0f1526] border border-[#1e2540] rounded-xl p-4 max-h-72 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1.5">
                  {delegates.map((country) => (
                    <div
                      key={country}
                      className="flex items-center justify-between bg-[#141929] rounded-lg px-3 py-2 group"
                    >
                      <span className="text-sm text-[#c0c8d8]">{country}</span>
                      <button
                        onClick={() => removeDelegate(country)}
                        className="text-[#4a5580] hover:text-red-400 transition-colors ml-2 text-xs opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-[#1e2540] hover:border-[#2a3050] text-[#8892aa] hover:text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={delegates.length === 0}
                  className="flex-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
                >
                  Launch Committee 🚀
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
