'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCommitteeStore } from '@/lib/store';
import { Committee, CommitteeDocument, DocumentType } from '@/lib/types';
import ChatPanel from '@/components/ChatPanel';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function autoDocCode(type: DocumentType, existingDocs: { type: DocumentType }[]): string {
  const prefix = type === 'working-paper' ? 'WP' : 'DR';
  const sep = type === 'working-paper' ? '.' : '/';
  const sameType = existingDocs.filter((d) => d.type === type);
  const num = sameType.length + 1;
  return `${prefix} 1${sep}${num}`;
}

type AddDocFn = (committeeId: string, doc: Omit<CommitteeDocument, 'id' | 'submittedAt'>) => void;

function DelegateDocumentsTab({
  committee,
  country,
  addDocument,
}: {
  committee: Committee;
  country: string;
  addDocument: AddDocFn;
}) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('working-paper');
  const [sponsors, setSponsors] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = title.trim();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileUrl(reader.result as string);
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const sponsorList = sponsors.split(',').map((s) => s.trim()).filter(Boolean);
    addDocument(committee.id, {
      type: docType,
      docCode: autoDocCode(docType, committee.documents ?? []),
      title: title.trim(),
      sponsors: sponsorList.length > 0 ? sponsorList : [country],
      content: '',
      status: 'submitted',
      ...(fileUrl && fileName ? { fileUrl, fileName } : {}),
    });
    setTitle('');
    setSponsors('');
    setFileName(null);
    setFileUrl(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h2 className="text-lg font-bold text-white">Submit Document</h2>

      {submitted && (
        <div className="bg-green-900/30 border border-green-700/40 rounded-xl px-4 py-3 text-green-400 text-sm font-semibold">
          ✓ Document submitted successfully!
        </div>
      )}

      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title…"
            className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocumentType)}
            className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#7B4A1E] transition-colors text-sm"
          >
            <option value="working-paper">Working Paper</option>
            <option value="draft-resolution">Draft Resolution</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Sponsors <span className="text-[#7A5A38] font-normal">(comma-separated, defaults to your country)</span></label>
          <input
            type="text"
            value={sponsors}
            onChange={(e) => setSponsors(e.target.value)}
            placeholder="e.g. Germany, France, Brazil"
            className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3 text-white placeholder-[#7A5A38] focus:outline-none focus:border-[#7B4A1E] transition-colors text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#C4A882] mb-1.5">Attachment <span className="text-[#7A5A38] font-normal">(optional)</span></label>
          {fileName ? (
            <div className="flex items-center gap-2 bg-[#150F09] border border-[#2E1E0F] rounded-xl px-4 py-3">
              <span className="text-sm text-white flex-1 truncate">📎 {fileName}</span>
              <button
                onClick={() => { setFileName(null); setFileUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="text-[#7A5A38] hover:text-red-500 transition-colors text-sm"
              >✕</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-[#150F09] border border-dashed border-[#2E1E0F] hover:border-[#7B4A1E] rounded-xl px-4 py-3 text-[#7A5A38] hover:text-[#C4A882] text-sm transition-colors text-left"
            >
              + Upload file (.pdf, .doc, .docx, .txt)
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-3 rounded-xl font-bold transition-colors text-sm"
        >
          Submit Document
        </button>
      </div>

      {/* Show submitted docs by this delegate */}
      {(committee.documents ?? []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#C4A882] mb-2">Committee Documents</h3>
          <div className="space-y-2">
            {(committee.documents ?? []).map((doc) => (
              <div key={doc.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-[#7B4A1E]">{doc.docCode}</span>
                  <span className="text-xs text-[#7A5A38] capitalize">{doc.status}</span>
                </div>
                <p className="text-sm font-semibold text-white">{doc.title}</p>
                {doc.fileUrl && doc.fileName && (
                  <a href={doc.fileUrl} download={doc.fileName} className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1 block">
                    📎 {doc.fileName}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DelegateSession({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || '';
  const { committees, addToSpeakersList, proposeMotion, addDocument } = useCommitteeStore();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [tab, setTab] = useState<'session' | 'motions' | 'resolutions' | 'documents' | 'chat'>('session');

  useEffect(() => {
    const found = Object.values(committees).find((c) => c.code === code.toUpperCase());
    if (found) setCommittee(found);
  }, [committees, code]);

  if (!committee) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Session not found</h1>
          <p className="text-[#C4A882] mb-6">Code "{code}" is invalid or the session ended.</p>
          <Link href="/join" className="bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  const myDelegate = committee.delegates.find((d) => d.country === country);
  const isOnSpeakersList = committee.speakersList.some((s) => s.country === country);
  const isCurrentSpeaker = committee.currentSpeaker?.country === country;
  const progress = isCurrentSpeaker ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 0;

  const phaseLabel: Record<string, string> = {
    'pre-session': 'Pre-Session',
    'roll-call': 'Roll Call',
    'speakers-list': 'General Debate',
    'moderated-caucus': 'Moderated Caucus',
    'unmoderated-caucus': 'Unmoderated Caucus',
    'voting': 'Voting Procedure',
    'adjourned': 'Adjourned',
  };

  return (
    <div className="min-h-screen bg-[#0D0906] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <img src="/gavelling-logo.png" alt="Gavelling" className="h-8 w-auto" onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-sm truncate">{committee.name}</div>
          <div className="text-xs text-[#7A5A38] truncate">{committee.topic}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white">{country}</div>
          <div className="text-xs text-[#7A5A38]">{phaseLabel[committee.phase] || committee.phase}</div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="flex border-b border-[#2E1E0F] bg-[#150F08]">
        {(['session', 'motions', 'resolutions', 'documents', 'chat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${
              tab === t ? 'text-white border-b-2 border-[#7B4A1E]' : 'text-[#7A5A38] hover:text-[#C4A882]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'session' && (
          <div className="p-4 space-y-4 max-w-2xl mx-auto">
            {/* Status card */}
            <div className={`rounded-xl p-5 border ${
              isCurrentSpeaker
                ? 'bg-[#7B4A1E]/20 border-[#7B4A1E]/50'
                : committee.phase === 'moderated-caucus' || committee.phase === 'unmoderated-caucus'
                ? 'bg-purple-900/20 border-purple-700/30'
                : 'bg-[#1A1209] border-[#2E1E0F]'
            }`}>
              <div className="text-xs font-mono text-[#7A5A38] mb-2">SESSION STATUS</div>
              <div className={`text-2xl font-black mb-1 ${
                isCurrentSpeaker ? 'text-[#B8844A]' :
                committee.phase === 'adjourned' ? 'text-red-400' : 'text-white'
              }`}>
                {isCurrentSpeaker ? '🎙️ You Have the Floor' : phaseLabel[committee.phase] || committee.phase}
              </div>

              {isCurrentSpeaker && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-[#C4A882]">Remaining time</span>
                    <span className={`text-sm font-mono font-bold ${committee.speakerTimeRemaining <= 10 ? 'text-red-400' : 'text-white'}`}>
                      {formatTime(committee.speakerTimeRemaining)}
                    </span>
                  </div>
                  <div className="h-3 bg-[#2E1E0F] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progress > 50 ? 'bg-[#B8844A]' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {committee.caucus && (
                <div className="mt-3">
                  <div className="text-sm text-[#C4A882] mb-2">
                    {committee.caucus.type === 'moderated' ? 'Moderated' : 'Unmoderated'} Caucus
                    {committee.caucus.purpose && ` — ${committee.caucus.purpose}`}
                  </div>
                  <div className="text-3xl font-black font-mono text-white">
                    {formatTime(committee.caucus.remainingTime)}
                  </div>
                  <div className="h-2 bg-[#2E1E0F] rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${(committee.caucus.remainingTime / committee.caucus.totalTime) * 100}%` }}
                    />
                  </div>
                  {committee.caucus.currentSpeaker && (
                    <div className="mt-3 text-sm">
                      <span className="text-[#C4A882]">Speaking: </span>
                      <span className={`font-bold ${committee.caucus.currentSpeaker === country ? 'text-[#B8844A]' : 'text-white'}`}>
                        {committee.caucus.currentSpeaker}
                        {committee.caucus.currentSpeaker === country && ' (You)'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Current speaker (if not me) */}
            {committee.currentSpeaker && !isCurrentSpeaker && committee.phase === 'speakers-list' && (
              <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                <div className="text-xs text-[#7A5A38] font-mono mb-2">NOW SPEAKING</div>
                <div className="text-lg font-bold text-white">{committee.currentSpeaker.country}</div>
                <div className="text-sm font-mono text-[#C4A882] mt-1">{formatTime(committee.speakerTimeRemaining)}</div>
              </div>
            )}

            {/* Speakers list */}
            {committee.phase === 'speakers-list' && (
              <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-[#7A5A38] font-mono">SPEAKERS LIST</div>
                  {!isOnSpeakersList && !isCurrentSpeaker && myDelegate?.status !== 'absent' && (
                    <button
                      onClick={() => myDelegate && addToSpeakersList(committee.id, myDelegate.id)}
                      className="text-xs bg-[#7B4A1E] hover:bg-[#8B5A2B] text-white px-3 py-1 rounded-lg font-medium transition-colors"
                    >
                      + Add Me
                    </button>
                  )}
                  {isOnSpeakersList && (
                    <span className="text-xs text-green-400 font-medium">✓ On list</span>
                  )}
                </div>
                {committee.speakersList.length === 0 ? (
                  <p className="text-sm text-[#7A5A38]">No speakers queued</p>
                ) : (
                  <div className="space-y-1">
                    {committee.speakersList.map((s, i) => (
                      <div key={s.delegateId} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg text-sm ${s.country === country ? 'bg-[#7B4A1E]/20 border border-[#7B4A1E]/30' : ''}`}>
                        <span className="text-[#7A5A38] text-xs w-4 font-mono">{i + 1}</span>
                        <span className={s.country === country ? 'text-[#B8844A] font-bold' : 'text-[#C4A882]'}>
                          {s.country}{s.country === country && ' (You)'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My delegation status */}
            <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
              <div className="text-xs text-[#7A5A38] font-mono mb-3">YOUR DELEGATION</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">{country}</div>
                  <div className="text-sm text-[#C4A882] mt-0.5">
                    Status:{' '}
                    <span className={
                      myDelegate?.status === 'present' ? 'text-green-400' :
                      myDelegate?.status === 'present-voting' ? 'text-[#B8844A]' : 'text-red-400'
                    }>
                      {myDelegate?.status === 'present' ? 'Present' :
                       myDelegate?.status === 'present-voting' ? 'Present & Voting' : 'Absent'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'motions' && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            <h2 className="text-lg font-bold text-white">Pending Motions</h2>
            {committee.motions.filter((m) => m.status === 'pending').length === 0 ? (
              <div className="text-center py-8 text-[#7A5A38]">No pending motions</div>
            ) : (
              committee.motions
                .filter((m) => m.status === 'pending')
                .map((motion) => (
                  <div key={motion.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                    <div className="font-semibold text-white text-sm capitalize">{motion.type.replace(/-/g, ' ')}</div>
                    <div className="text-xs text-[#C4A882] mt-1">Proposed by {motion.proposedBy}</div>
                    {motion.purpose && <div className="text-xs text-[#C4A882] italic mt-1">"{motion.purpose}"</div>}
                    {motion.totalTime && (
                      <div className="text-xs text-[#7A5A38] mt-1">
                        {Math.floor(motion.totalTime / 60)}m total
                        {motion.speakingTime && `, ${motion.speakingTime}s per speaker`}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {tab === 'resolutions' && (
          <div className="p-4 max-w-2xl mx-auto space-y-3">
            <h2 className="text-lg font-bold text-white">Resolutions</h2>
            {committee.resolutions.length === 0 ? (
              <div className="text-center py-8 text-[#7A5A38]">No resolutions submitted</div>
            ) : (
              committee.resolutions.map((res) => (
                <div key={res.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-white text-sm">{res.title}</div>
                    <span className={`text-xs font-bold ml-3 ${
                      res.status === 'passed' ? 'text-emerald-400' :
                      res.status === 'failed' ? 'text-red-400' :
                      res.status === 'approved' ? 'text-green-400' :
                      res.status === 'submitted' ? 'text-[#B8844A]' :
                      res.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
                    }`}>{res.status}</span>
                  </div>
                  <div className="text-xs text-[#C4A882] mt-1">Sponsors: {res.sponsors.join(', ')}</div>
                  {res.content && (
                    <div className="mt-2 text-xs text-[#7A5A38] bg-[#150F09] border border-[#2E1E0F] rounded-lg p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {res.content}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'documents' && (
          <DelegateDocumentsTab committee={committee} country={country} addDocument={addDocument} />
        )}

        {tab === 'chat' && (
          <div className="h-[calc(100vh-120px)]">
            <ChatPanel committee={committee} senderName={country} />
          </div>
        )}
      </div>
    </div>
  );
}
