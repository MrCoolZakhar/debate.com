'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Committee, CommitteeDocument, DocumentType, DocumentStatus } from '@/lib/types';
import { getCountryByName, getFlagEmoji } from '@/lib/countries';
import {
  addDocument as addDocumentInDB,
  updateDocumentStatus as updateDocumentStatusInDB,
  removeDocument as removeDocumentInDB,
} from '@/lib/committeeService';

type DocTab = 'working-paper' | 'draft-resolution';

const STATUS_META: Record<DocumentStatus, { label: string; color: string }> = {
  submitted:   { label: 'Submitted',  color: 'bg-blue-950/40 text-blue-400 border-blue-800/40' },
  'on-floor':  { label: 'On Floor',   color: 'bg-yellow-950/40 text-yellow-400 border-yellow-800/40' },
  introduced:  { label: 'Introduced', color: 'bg-purple-950/40 text-purple-400 border-purple-800/40' },
  passed:      { label: 'Passed',     color: 'bg-green-950/40 text-green-400 border-green-800/40' },
  failed:      { label: 'Failed',     color: 'bg-red-950/40 text-red-400 border-red-800/40' },
};

const STATUS_NEXT: Partial<Record<DocumentStatus, DocumentStatus>> = {
  submitted: 'on-floor',
  'on-floor': 'introduced',
  introduced: 'passed',
};

function StatusBadge({ status }: { status: DocumentStatus }) {
  const meta = STATUS_META[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>{meta.label}</span>;
}

function CountryChip({ country, onRemove }: { country: string; onRemove: () => void }) {
  const found = getCountryByName(country);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#2E1E0F] border border-[#2E1E0F] rounded-full text-xs text-white">
      {found ? getFlagEmoji(found.code) : '🌐'}{country}
      <button onClick={onRemove} className="text-[#7A5A38] hover:text-red-500 ml-0.5 leading-none">✕</button>
    </span>
  );
}

function SponsorSelect({ candidates, selected, onChange }: { candidates: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState('');
  const available = candidates.filter((c) => !selected.includes(c) && c.toLowerCase().includes(query.toLowerCase()));
  const add = (country: string) => { onChange([...selected, country]); setQuery(''); };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); if (available.length > 0) add(available[0]); } };
  return (
    <div>
      <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Sponsors <span className="text-red-500">*</span></label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {selected.map((c) => <CountryChip key={c} country={c} onRemove={() => onChange(selected.filter((s) => s !== c))} />)}
      </div>
      <div className="relative">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Type to filter delegates, Enter to add…"
          className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white placeholder-[#7A5A38] text-sm focus:outline-none focus:border-[#7B4A1E] transition-colors" />
        {query && available.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#150F09] border border-[#2E1E0F] rounded-xl overflow-hidden z-20 shadow-lg max-h-36 overflow-y-auto">
            {available.slice(0, 6).map((c, i) => {
              const found = getCountryByName(c);
              return (
                <button key={c} onMouseDown={(e) => { e.preventDefault(); add(c); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${i === 0 ? 'bg-[#7B4A1E]/20 text-white' : 'text-[#E8D5B7] hover:bg-[#2E1E0F]'}`}>
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
  return `${prefix} 1${sep}${sameType.length + 1}`;
}

// ── Submit Form ───────────────────────────────────────────────────────────────
function SubmitForm({ committee, type, onDone, onDocumentAdded }: {
  committee: Committee;
  type: DocumentType;
  onDone: () => void;
  onDocumentAdded: (doc: CommitteeDocument) => void;
}) {
  const presentCountries = committee.delegates.filter((d) => d.status !== 'absent').map((d) => d.country);
  const [title, setTitle] = useState('');
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docCode = autoDocCode(type, committee.documents ?? []);
  const canSubmit = title.trim() && sponsors.length > 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setFileUrl(reader.result as string); setFileName(file.name); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const newDoc: Omit<CommitteeDocument, 'id' | 'submittedAt'> = {
      type, docCode, title: title.trim(), sponsors, content: content.trim(), status: 'submitted',
      ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
    };
    // Optimistic: create temp doc for immediate display
    const tempDoc: CommitteeDocument = { ...newDoc, id: `temp-${Date.now()}`, submittedAt: new Date().toISOString() };
    onDocumentAdded(tempDoc);
    addDocumentInDB(committee.id, newDoc);
    onDone();
  };

  return (
    <div className="space-y-4 px-7 pb-7">
      <div className="flex items-center gap-3">
        <button onClick={onDone} className="text-sm text-[#C4A882] hover:text-white transition-colors">← Back</button>
        <h2 className="text-xl font-black text-white">Submit {type === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}</h2>
      </div>
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl px-4 py-2.5">
        <span className="text-xs text-[#7A5A38] font-mono">DOCUMENT CODE</span>
        <span className="ml-3 text-sm font-bold text-white font-mono">{docCode}</span>
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Title <span className="text-red-500">*</span></label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Strengthening international cooperation on…"
          className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors" />
      </div>
      <SponsorSelect candidates={presentCountries} selected={sponsors} onChange={setSponsors} />
      <div>
        <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Content <span className="text-[#7A5A38] font-normal">(optional)</span></label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the full text of the document…" rows={5}
          className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors text-sm resize-none" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Attachment <span className="text-[#7A5A38] font-normal">(optional)</span></label>
        {fileName ? (
          <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3">
            <span className="text-sm text-white flex-1 truncate">📎 {fileName}</span>
            <button onClick={() => { setFileName(null); setFileUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="text-[#7A5A38] hover:text-red-500 transition-colors text-sm">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#150F09] border border-dashed border-[#2E1E0F] hover:border-[#7B4A1E] rounded-xl px-4 py-3 text-[#7A5A38] hover:text-[#C4A882] text-sm transition-colors text-left">
            + Upload file (.pdf, .doc, .docx, .txt)
          </button>
        )}
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileChange} className="hidden" />
      </div>
      <button onClick={handleSubmit} disabled={!canSubmit}
        className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-3.5 rounded-xl font-bold transition-colors">
        Submit Document
      </button>
    </div>
  );
}

// ── Doc Card ──────────────────────────────────────────────────────────────────
function DocCard({ doc, committeeId, onStatusChange, onRemove }: {
  doc: CommitteeDocument;
  committeeId: string;
  onStatusChange: (docId: string, status: DocumentStatus) => void;
  onRemove: (docId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [presentationDialog, setPresentationDialog] = useState<'ask' | 'timing' | null>(null);
  const [presentationMinutes, setPresentationMinutes] = useState(5);
  const [qaMinutes, setQaMinutes] = useState(3);

  const nextStatus = STATUS_NEXT[doc.status];
  const needsPresentationPrompt = nextStatus === 'introduced';

  const handleAdvance = () => {
    if (!nextStatus) return;
    if (needsPresentationPrompt) { setPresentationDialog('ask'); }
    else { onStatusChange(doc.id, nextStatus); }
  };

  return (
    <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono font-bold text-[#7B4A1E]">{doc.docCode}</span>
            <StatusBadge status={doc.status} />
          </div>
          <p className="text-sm font-bold text-white leading-snug">{doc.title}</p>
        </div>
        <button onClick={() => onRemove(doc.id)} className="text-[#7A5A38] hover:text-red-500 transition-colors text-sm shrink-0" title="Delete">🗑</button>
      </div>
      <div className="text-xs text-[#C4A882]">
        <span className="font-semibold">Sponsors: </span>{doc.sponsors.join(', ') || '—'}
      </div>
      {doc.fileUrl && doc.fileName && (
        <div className="text-xs">
          <a href={doc.fileUrl} download={doc.fileName} className="text-blue-400 hover:text-blue-300 transition-colors">📎 {doc.fileName}</a>
        </div>
      )}
      {doc.content && (
        <div>
          <button onClick={() => setExpanded((v) => !v)} className="text-xs text-[#7B4A1E] hover:text-[#C4A882] transition-colors">
            {expanded ? '▲ Hide content' : '▼ Show content'}
          </button>
          {expanded && (
            <pre className="mt-2 text-xs text-white bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{doc.content}</pre>
          )}
        </div>
      )}

      {presentationDialog === 'ask' && (
        <div className="bg-[#150F09] border border-[#2E1E0F] rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Set up presentation?</p>
          <div className="flex gap-2">
            <button onClick={() => setPresentationDialog('timing')} className="flex-1 bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-2 rounded-lg font-bold text-xs transition-colors">Yes — set up timing</button>
            <button onClick={() => { setPresentationDialog(null); onStatusChange(doc.id, nextStatus!); }} className="flex-1 bg-[#2E1E0F] hover:bg-[#3E2A1A] text-[#C4A882] py-2 rounded-lg font-bold text-xs transition-colors">No — skip</button>
          </div>
        </div>
      )}

      {presentationDialog === 'timing' && (
        <div className="bg-[#150F09] border border-[#2E1E0F] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#C4A882]">Presentation Duration</span>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={60} value={presentationMinutes} onChange={(e) => setPresentationMinutes(Number(e.target.value))}
                className="w-16 bg-[#1A1209] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-[#7B4A1E]" />
              <span className="text-sm text-[#7A5A38]">min</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#C4A882]">Q&amp;A Duration</span>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={60} value={qaMinutes} onChange={(e) => setQaMinutes(Number(e.target.value))}
                className="w-16 bg-[#1A1209] border border-[#2E1E0F] rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-[#7B4A1E]" />
              <span className="text-sm text-[#7A5A38]">min</span>
            </div>
          </div>
          <button onClick={() => { setPresentationDialog(null); onStatusChange(doc.id, nextStatus!); }}
            className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-2 rounded-lg font-bold text-xs transition-colors">
            Confirm &amp; Introduce
          </button>
        </div>
      )}

      {presentationDialog === null && (
        <div className="flex gap-2 pt-1">
          {nextStatus && doc.status !== 'passed' && doc.status !== 'failed' && (
            <button onClick={handleAdvance} className="flex-1 bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white py-2 rounded-lg font-bold text-xs transition-colors">
              {nextStatus === 'introduced' ? 'Introduce' : `Advance → ${STATUS_META[nextStatus].label}`}
            </button>
          )}
          {doc.status === 'introduced' && (
            <button onClick={() => onStatusChange(doc.id, 'failed')}
              className="flex-1 bg-[#2E1E0F] hover:bg-red-950/40 border border-[#2E1E0F] hover:border-red-800/40 text-[#C4A882] hover:text-red-500 py-2 rounded-lg font-bold text-xs transition-colors">
              ✗ Fail
            </button>
          )}
        </div>
      )}
      <div className="text-xs text-[#7A5A38]">Submitted {new Date(doc.submittedAt).toLocaleDateString()}</div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function DocumentsModal({ committee, onClose, onCommitteeUpdate }: {
  committee: Committee;
  onClose: () => void;
  onCommitteeUpdate?: (updater: (c: Committee) => Committee) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<DocTab>('working-paper');
  const [showForm, setShowForm] = useState(false);

  const update = (updater: (c: Committee) => Committee) => onCommitteeUpdate?.(updater);

  const docs = (committee.documents ?? []).filter((d) => d.type === tab);
  const introducedDRs = (committee.documents ?? []).filter((d) => d.type === 'draft-resolution' && d.status === 'introduced');

  const handleDocumentAdded = (doc: CommitteeDocument) => {
    update((c) => ({ ...c, documents: [...(c.documents ?? []), doc] }));
  };

  const handleStatusChange = (docId: string, status: DocumentStatus) => {
    update((c) => ({ ...c, documents: (c.documents ?? []).map((d) => d.id === docId ? { ...d, status } : d) }));
    updateDocumentStatusInDB(docId, status);
  };

  const handleRemove = (docId: string) => {
    update((c) => ({ ...c, documents: (c.documents ?? []).filter((d) => d.id !== docId) }));
    removeDocumentInDB(docId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5, 8, 20, 0.88)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-7 pt-6 pb-4 shrink-0 border-b border-[#2E1E0F]">
          <h2 className="text-2xl font-black text-white">Documents</h2>
          <button onClick={onClose} className="text-[#7A5A38] hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {!showForm && (
          <div className="flex gap-2 px-7 pt-4 shrink-0">
            {(['working-paper', 'draft-resolution'] as const).map((t) => {
              const label = t === 'working-paper' ? 'Working Papers' : 'Draft Resolutions';
              const count = (committee.documents ?? []).filter((d) => d.type === t && (d.status === 'submitted' || d.status === 'on-floor')).length;
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors relative ${tab === t ? 'bg-[#7B4A1E] text-white' : 'bg-[#1A1209] border border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'}`}>
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black ${tab === t ? 'bg-white/30 text-white' : 'bg-[#7B4A1E] text-white'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="overflow-y-auto flex-1 pt-4">
          {showForm ? (
            <SubmitForm committee={committee} type={tab} onDone={() => setShowForm(false)} onDocumentAdded={handleDocumentAdded} />
          ) : (
            <div className="px-7 pb-7 space-y-3">
              {docs.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">{tab === 'working-paper' ? '📄' : '📜'}</div>
                  <p className="text-[#C4A882] font-semibold">No {tab === 'working-paper' ? 'working papers' : 'draft resolutions'} yet.</p>
                  <p className="text-sm text-[#7A5A38] mt-1">Submit the first one below.</p>
                </div>
              ) : (
                docs.map((doc) => (
                  <DocCard key={doc.id} doc={doc} committeeId={committee.id} onStatusChange={handleStatusChange} onRemove={handleRemove} />
                ))
              )}
              <button onClick={() => setShowForm(true)}
                className="w-full bg-[#1A1209] hover:bg-[#2E1E0F] border border-[#2E1E0F] hover:border-[#7B4A1E] text-white py-3.5 rounded-2xl font-bold transition-all mt-2">
                + Submit New {tab === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}
              </button>
              {tab === 'draft-resolution' && introducedDRs.length > 0 && (
                <div className="pt-2">
                  <div className="border-t border-[#2E1E0F] pt-4">
                    <button onClick={() => { onClose(); router.push(`/voting/${committee.code}`); }}
                      className="w-full bg-[#1A1209] hover:bg-[#2E1E0F] border border-[#7B4A1E] text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
                      🗳️ Ready to Vote on Draft Resolutions
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}