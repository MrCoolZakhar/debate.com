'use client';

import { useState } from 'react';
import { Committee, ResolutionStatus } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';

const STATUS_CONFIG: Record<ResolutionStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-yellow-400' },
  submitted: { label: 'Submitted', color: 'text-blue-400' },
  approved: { label: 'Approved', color: 'text-green-400' },
  rejected: { label: 'Rejected', color: 'text-red-400' },
  passed: { label: 'Passed', color: 'text-emerald-400' },
  failed: { label: 'Failed', color: 'text-red-500' },
};

export default function ResolutionsPanel({ committee }: { committee: Committee }) {
  const { addResolution, updateResolutionStatus } = useCommitteeStore();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [sponsors, setSponsors] = useState('');
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleAdd = () => {
    if (!title.trim()) return;
    addResolution(
      committee.id,
      title.trim(),
      sponsors.split(',').map((s) => s.trim()).filter(Boolean),
      content.trim()
    );
    setTitle('');
    setSponsors('');
    setContent('');
    setShowForm(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-[#1e2540]">
        <div>
          <h3 className="font-bold text-[#1C1410]">Resolutions</h3>
          <p className="text-[#8892aa] text-xs mt-0.5">{committee.resolutions.length} documents</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-500 text-[#1C1410] text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          + New
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-[#1e2540] bg-[#0d1120] space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resolution title..."
            className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-blue-600 placeholder-[#4a5580]"
          />
          <input
            type="text"
            value={sponsors}
            onChange={(e) => setSponsors(e.target.value)}
            placeholder="Sponsors (comma-separated countries)"
            className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-blue-600 placeholder-[#4a5580]"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Resolution text (preambulatory and operative clauses)..."
            rows={4}
            className="w-full bg-[#141929] border border-[#1e2540] rounded-lg px-3 py-2 text-[#1C1410] text-sm focus:outline-none focus:border-blue-600 placeholder-[#4a5580] resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-700 text-[#1C1410] py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Submit
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-[#1e2540] hover:bg-[#2a3050] text-[#8892aa] rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {committee.resolutions.length === 0 ? (
          <div className="text-center py-8 text-[#4a5580] text-sm">No resolutions yet</div>
        ) : (
          committee.resolutions.map((res) => {
            const cfg = STATUS_CONFIG[res.status];
            return (
              <div key={res.id} className="bg-[#141929] border border-[#1e2540] rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#1a1f2e] transition-colors"
                  onClick={() => setExpanded(expanded === res.id ? null : res.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1C1410] truncate">{res.title}</div>
                    <div className="text-xs text-[#8892aa] mt-0.5">{res.sponsors.join(', ')}</div>
                  </div>
                  <span className={`text-xs font-bold ms-3 ${cfg.color}`}>{cfg.label}</span>
                </div>
                {expanded === res.id && (
                  <div className="px-3 pb-3 border-t border-[#1e2540]">
                    {res.content && (
                      <div className="mt-3 text-xs text-[#8892aa] bg-[#0f1526] rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {res.content}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(['draft', 'submitted', 'approved', 'rejected', 'passed', 'failed'] as ResolutionStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateResolutionStatus(committee.id, res.id, s)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            res.status === s
                              ? `${STATUS_CONFIG[s].color} bg-[#1e2540] font-bold`
                              : 'text-[#4a5580] hover:text-[#8892aa] bg-[#1e2540]'
                          }`}
                        >
                          {STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
