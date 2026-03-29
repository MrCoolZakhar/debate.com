'use client';

import { Committee, DelegateStatus } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

export default function RollCallPanel({ committee }: { committee: Committee }) {
  const { setDelegateStatus, completeRollCall } = useCommitteeStore();

  const present = committee.delegates.filter((d) => d.status !== 'absent').length;
  const total = committee.delegates.length;
  const quorum = Math.floor(total / 2) + 1;

  const statusOptions: { value: DelegateStatus; label: string; color: string }[] = [
    { value: 'present', label: 'Present', color: 'text-green-400' },
    { value: 'present-voting', label: 'P&V', color: 'text-blue-400' },
    { value: 'absent', label: 'Absent', color: 'text-red-400' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#1e2540]">
        <h2 className="font-bold text-white text-lg">Roll Call</h2>
        <p className="text-[#8892aa] text-sm mt-1">
          {present}/{total} present · Quorum: {quorum}
        </p>
        <div className="mt-3 h-2 bg-[#1a1f2e] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${present >= quorum ? 'bg-green-500' : 'bg-yellow-500'}`}
            style={{ width: `${(present / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {committee.delegates.map((delegate) => (
          <div
            key={delegate.id}
            className="flex items-center justify-between bg-[#141929] rounded-lg px-3 py-2.5"
          >
            <span className="text-sm text-[#c0c8d8] font-medium">{delegate.country}</span>
            <div className="flex gap-1">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDelegateStatus(committee.id, delegate.id, opt.value)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    delegate.status === opt.value
                      ? `${opt.color} bg-[#1e2540] font-bold`
                      : 'text-[#4a5580] hover:text-[#8892aa]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-[#1e2540]">
        <button
          onClick={() => completeRollCall(committee.id)}
          disabled={present < quorum}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-white py-3 rounded-lg font-semibold transition-colors"
        >
          {present < quorum ? `Need ${quorum - present} more for quorum` : 'Complete Roll Call →'}
        </button>
      </div>
    </div>
  );
}
