'use client';

import { useState } from 'react';
import { Committee, CommitteeDocument, DocumentType, DocumentStatus } from '@/lib/types';
import { useCommitteeStore } from '@/lib/store';
import { getCountryByName, getFlagEmoji } from '@/lib/countries';

type DocTab = 'working-paper' | 'draft-resolution';

const STATUS_META: Record<DocumentStatus, { label: string; color: string }> = {
  submitted:   { label: 'Submitted',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'on-floor':  { label: 'On Floor',     color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  introduced:  { label: 'Introduced',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  passed:      { label: 'Passed',       color: 'bg-green-100 text-green-700 border-green-200' },
  failed:      { label: 'Failed',       color: 'bg-red-100 text-red-600 border-red-200' },
};

const STATUS_NEXT: Partial<Record<DocumentStatus, DocumentStatus>> = {
  submitted:  'on-floor',
  'on-floor': 'introduced',
  introduced: 'passed',
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function CountryChip({
  country,
  onRemove,
}: {
  country: string;
  onRemove: () => void;
}) {
  const found = getCountryByName(country);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F0EDE8] border border-[#D4B896] rounded-full text-xs text-[#1A0F08]">
      {found ? getFlagEmoji(found.code) : '🌐'}
      {country}
      <button onClick={onRemove} className="text-[#9A7A58] hover:text-red-500 ml-0.5 leading-none">✕</button>
    </span>
  );
}

function MultiCountrySelect({
  label,
  candidates,
  selected,
  onChange,
}: {
  label: string;
  candidates: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const available = candidates.filter(
    (c) => !selected.includes(c) && c.toLowerCase().includes(query.toLowerCase())
  );

  const add = (country: string) => {
    onChange([...selected, country]);
    setQuery('');
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-[#5C3A1E] mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {selected.map((c) => (
          <CountryChip
            key={c}
            country={c}
            onRemove={() => onChange(selected.filter((s) => s !== c))}
          />
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search to add…"
          className="w-full bg-white border border-[#D4B896] rounded-lg px-3 py-2 text-[#1A0F08] placeholder-[#B8A090] text-sm focus:outline-none focus:border-[#7B4A1E] transition-colors"
        />
        {query && available.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#D4B896] rounded-xl overflow-hidden z-20 shadow-lg max-h-36 overflow-y-auto">
            {available.slice(0, 6).map((c, i) => {
              const found = getCountryByName(c);
              return (
                <button
                  key={c}
                  onMouseDown={(e) => { e.preventDefault(); add(c); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/10 text-[#1A0F08]' : 'text-[#1A0F08] hover:bg-[#F5F0E8]'}`}
                >
                  <span>{found ? getFlagEmoji(found.code) : '🌐'}</span>
                  <span className="text-sm">{c}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function autoDocCode(type: DocumentType, existingDocs: CommitteeDocument[]): string {
  const prefix = type === 'working-paper' ? 'WP' : 'DR';
  const sep = type === 'working-paper' ? '.' : '/';
  const sameType = existingDocs.filter((d) => d.type === type);
  const num = sameType.length + 1;
  return `${prefix} 1${sep}${num}`;
}

interface SubmitFormProps {
  committee: Committee;
  type: DocumentType;
  onDone: () => void;
}

function SubmitForm({ committee, type, onDone }: SubmitFormProps) {
  const { addDocument } = useCommitteeStore();
  const presentCountries = committee.delegates
    .filter((d) => d.status !== 'absent')
    .map((d) => d.country);
  const allCountries = committee.delegates.map((d) => d.country);

  const [title, setTitle] = useState('');
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [signatories, setSignatories] = useState<string[]>([]);
  const [content, setContent] = useState('');

  const docCode = autoDocCode(type, committee.documents ?? []);
  const canSubmit = title.trim() && sponsors.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    addDocument(committee.id, {
      type,
      docCode,
      title: title.trim(),
      sponsors,
      signatories,
      content: content.trim(),
      status: 'submitted',
    });
    onDone();
  };

  return (
    <div className="space-y-4 px-7 pb-7">
      <div className="flex items-center gap-3">
        <button onClick={onDone} className="text-sm text-[#5C3A1E] hover:text-[#1A0F08] transition-colors">← Back</button>
        <h2 className="text-xl font-black text-[#1A0F08]">
          Submit {type === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}
        </h2>
      </div>

      <div className="bg-[#F5F0E8] border border-[#D4B896] rounded-xl px-4 py-2.5">
        <span className="text-xs text-[#9A7A58] font-mono">DOCUMENT CODE</span>
        <span className="ml-3 text-sm font-bold text-[#1A0F08] font-mono">{docCode}</span>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#5C3A1E] mb-1.5">Title <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Strengthening international cooperation on…"
          className="w-full bg-white border border-[#D4B896] rounded-xl px-4 py-3 text-[#1A0F08] placeholder-[#B8A090] focus:outline-none focus:border-[#7B4A1E] transition-colors"
        />
      </div>

      <MultiCountrySelect
        label="Sponsors *"
        candidates={presentCountries}
        selected={sponsors}
        onChange={setSponsors}
      />

      <MultiCountrySelect
        label="Signatories"
        candidates={allCountries.filter((c) => !sponsors.includes(c))}
        selected={signatories}
        onChange={setSignatories}
      />

      <div>
        <label className="block text-sm font-semibold text-[#5C3A1E] mb-1.5">Content <span className="text-[#9A7A58] font-normal">(optional)</span></label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the full text of the document…"
          rows={5}
          className="w-full bg-white border border-[#D4B896] rounded-xl px-4 py-3 text-[#1A0F08] placeholder-[#B8A090] focus:outline-none focus:border-[#7B4A1E] transition-colors text-sm resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#E8DDD0] disabled:text-[#9A7A58] text-white py-3.5 rounded-xl font-bold transition-colors"
      >
        Submit Document
      </button>
    </div>
  );
}

interface DocCardProps {
  doc: CommitteeDocument;
  committeeId: string;
}

function DocCard({ doc, committeeId }: DocCardProps) {
  const { updateDocumentStatus, removeDocument } = useCommitteeStore();
  const [expanded, setExpanded] = useState(false);

  const nextStatus = STATUS_NEXT[doc.status];

  return (
    <div className="bg-[#F5F0E8] border border-[#D4B896] rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono font-bold text-[#7B4A1E]">{doc.docCode}</span>
            <StatusBadge status={doc.status} />
          </div>
          <p className="text-sm font-bold text-[#1A0F08] leading-snug">{doc.title}</p>
        </div>
        <button
          onClick={() => removeDocument(committeeId, doc.id)}
          className="text-[#9A7A58] hover:text-red-500 transition-colors text-sm shrink-0"
          title="Delete"
        >
          🗑
        </button>
      </div>

      <div className="text-xs text-[#5C3A1E]">
        <span className="font-semibold">Sponsors: </span>
        {doc.sponsors.join(', ') || '—'}
      </div>

      {doc.signatories.length > 0 && (
        <div className="text-xs text-[#5C3A1E]">
          <span className="font-semibold">Signatories: </span>
          {doc.signatories.join(', ')}
        </div>
      )}

      {doc.content && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#7B4A1E] hover:text-[#5C3A1E] transition-colors"
          >
            {expanded ? '▲ Hide content' : '▼ Show content'}
          </button>
          {expanded && (
            <pre className="mt-2 text-xs text-[#1A0F08] bg-white border border-[#D4B896] rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
              {doc.content}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {nextStatus && doc.status !== 'passed' && doc.status !== 'failed' && (
          <button
            onClick={() => updateDocumentStatus(committeeId, doc.id, nextStatus)}
            className="flex-1 bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-2 rounded-lg font-bold text-xs transition-colors"
          >
            Advance → {STATUS_META[nextStatus].label}
          </button>
        )}
        {doc.status === 'introduced' && (
          <button
            onClick={() => updateDocumentStatus(committeeId, doc.id, 'failed')}
            className="flex-1 bg-[#F0EDE8] hover:bg-red-50 border border-[#D4B896] hover:border-red-200 text-[#5C3A1E] hover:text-red-500 py-2 rounded-lg font-bold text-xs transition-colors"
          >
            ✗ Fail
          </button>
        )}
      </div>

      <div className="text-xs text-[#9A7A58]">
        Submitted {new Date(doc.submittedAt).toLocaleDateString()}
      </div>
    </div>
  );
}

export default function DocumentsModal({
  committee,
  onClose,
}: {
  committee: Committee;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DocTab>('working-paper');
  const [showForm, setShowForm] = useState(false);

  const docs = (committee.documents ?? []).filter((d) => d.type === tab);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-[#D4B896] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0 border-b border-[#D4B896]">
          <h2 className="text-2xl font-black text-[#1A0F08]">Documents</h2>
          <button onClick={onClose} className="text-[#9A7A58] hover:text-[#1A0F08] transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        {!showForm && (
          <div className="flex gap-2 px-7 pt-4 shrink-0">
            {(['working-paper', 'draft-resolution'] as const).map((t) => {
              const label = t === 'working-paper' ? 'Working Papers' : 'Draft Resolutions';
              const count = (committee.documents ?? []).filter((d) => d.type === t && (d.status === 'submitted' || d.status === 'on-floor')).length;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors relative ${
                    tab === t
                      ? 'bg-[#7B4A1E] text-white'
                      : 'bg-[#F0EDE8] border border-[#D4B896] text-[#5C3A1E] hover:border-[#7B4A1E]'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${
                      tab === t ? 'bg-white/30 text-white' : 'bg-[#7B4A1E] text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 pt-4">
          {showForm ? (
            <SubmitForm
              committee={committee}
              type={tab}
              onDone={() => setShowForm(false)}
            />
          ) : (
            <div className="px-7 pb-7 space-y-3">
              {docs.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">{tab === 'working-paper' ? '📄' : '📜'}</div>
                  <p className="text-[#5C3A1E] font-semibold">No {tab === 'working-paper' ? 'working papers' : 'draft resolutions'} yet.</p>
                  <p className="text-sm text-[#9A7A58] mt-1">Submit the first one below.</p>
                </div>
              ) : (
                docs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} committeeId={committee.id} />
                ))
              )}

              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-[#F5F0E8] hover:bg-[#EDE8E0] border border-[#D4B896] hover:border-[#7B4A1E] text-[#1A0F08] py-3.5 rounded-2xl font-bold transition-all mt-2"
              >
                + Submit New {tab === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
