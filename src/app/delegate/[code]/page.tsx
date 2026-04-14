'use client';

import { use, useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Committee, CommitteeDocument, DocumentType, PendingMotionType } from '@/lib/types';
import ChatPanel from '@/components/ChatPanel';
import { useSettingsStore } from '@/lib/settingsStore';
import {
  getCommitteeByCode,
  subscribeToCommittee,
  addToSpeakersList as addToSpeakersListInDB,
  addDocument as addDocumentInDB,
  addPendingMotion as addPendingMotionInDB,
} from '@/lib/committeeService';

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

// ── Motion Request Form ───────────────────────────────────────────────────────
function MotionRequestForm({
  committee,
  country,
  enabledTypes,
}: {
  committee: Committee;
  country: string;
  enabledTypes: { moderated: boolean; unmoderated: boolean; consultation: boolean; tour: boolean };
}) {
  const ALL_TYPES: { value: PendingMotionType; label: string; hasTime: boolean; hasSpeakingTime: boolean }[] = [
    { value: 'moderated', label: 'Moderated Caucus', hasTime: true, hasSpeakingTime: true },
    { value: 'unmoderated', label: 'Unmoderated Caucus', hasTime: true, hasSpeakingTime: false },
    { value: 'consultation', label: 'Committee of the Whole (CoW)', hasTime: true, hasSpeakingTime: false },
    { value: 'tour', label: 'Tour de Table', hasTime: false, hasSpeakingTime: false },
  ];
  const available = ALL_TYPES.filter((m) => {
    if (m.value === 'moderated' && !enabledTypes.moderated) return false;
    if (m.value === 'unmoderated' && !enabledTypes.unmoderated) return false;
    if (m.value === 'consultation' && !enabledTypes.consultation) return false;
    if (m.value === 'tour' && !enabledTypes.tour) return false;
    return true;
  });

  const [type, setType] = useState<PendingMotionType>(available[0]?.value ?? 'moderated');
  const [totalMins, setTotalMins] = useState('');
  const [speakingSecs, setSpeakingSecs] = useState('');
  const [topic, setTopic] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const selected = available.find((a) => a.value === type);

  const handleSubmit = async () => {
    if (!selected || sending) return;
    setSending(true);
    const totalTime = selected.hasTime ? parseInt(totalMins || '0') * 60 : 0;
    const speakingTime = selected.hasSpeakingTime ? parseInt(speakingSecs || '0') : 0;

    await addPendingMotionInDB(committee.id, {
      type,
      proposedBy: country,
      totalTime,
      speakingTime,
      topic: topic.trim(),
      speakerList: [],
      proposerPosition: null,
    });
    setTotalMins('');
    setSpeakingSecs('');
    setTopic('');
    setSubmitted(true);
    setSending(false);
    setTimeout(() => setSubmitted(false), 3000);
  };

  if (available.length === 0) {
    return (
      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4 text-center text-[#7A5A38] text-sm">
        No motion types are currently enabled by the chair.
      </div>
    );
  }

  return (
    <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4 space-y-3">
      <div className="text-xs font-mono text-[#7A5A38] mb-1">REQUEST A MOTION</div>

      {submitted && (
        <div className="bg-green-900/30 border border-green-700/30 rounded-lg px-3 py-2 text-green-300 text-xs font-medium">
          ✓ Motion submitted to chair
        </div>
      )}

      <div>
        <label className="text-xs text-[#C4A882] mb-1 block">Motion type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as PendingMotionType)}
          className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E]"
        >
          {available.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {selected?.hasTime && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-[#C4A882] mb-1 block">Total time (min)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={totalMins}
              onChange={(e) => setTotalMins(e.target.value)}
              placeholder="e.g. 10"
              className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E]"
            />
          </div>
          {selected.hasSpeakingTime && (
            <div className="flex-1">
              <label className="text-xs text-[#C4A882] mb-1 block">Per speaker (sec)</label>
              <input
                type="number"
                min="10"
                max="300"
                value={speakingSecs}
                onChange={(e) => setSpeakingSecs(e.target.value)}
                placeholder="e.g. 60"
                className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E]"
              />
            </div>
          )}
        </div>
      )}

      <div>
        <label className="text-xs text-[#C4A882] mb-1 block">Topic / Purpose <span className="text-[#7A5A38]">(optional)</span></label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Humanitarian aid access in conflict zones"
          className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E]"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={sending || (selected?.hasTime ? !totalMins : false)}
        className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-2 rounded-lg text-sm font-semibold transition-colors"
      >
        {sending ? 'Submitting…' : 'Submit Motion →'}
      </button>
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────
function DelegateDocumentsTab({
  committee,
  country,
}: {
  committee: Committee;
  country: string;
}) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('working-paper');
  const [sponsors, setSponsors] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
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

  const handleSubmit = async () => {
    if (!canSubmit || sending) return;
    setSending(true);
    const sponsorList = sponsors.split(',').map((s) => s.trim()).filter(Boolean);
    await addDocumentInDB(committee.id, {
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
    setSending(false);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h2 className="text-lg font-bold text-white">Submit Document</h2>

      {submitted && (
        <div className="bg-green-900/30 border border-green-700/30 rounded-xl p-3 text-green-300 text-sm">
          ✓ Document submitted to chair for review
        </div>
      )}

      <div className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-[#C4A882] mb-1 block">Document type</label>
          <div className="flex gap-2">
            {(['working-paper', 'draft-resolution'] as DocumentType[]).map((dt) => (
              <button
                key={dt}
                onClick={() => setDocType(dt)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  docType === dt
                    ? 'bg-[#2E1E0F] border-[#7B4A1E] text-white'
                    : 'bg-[#150F09] border-[#2E1E0F] text-[#C4A882] hover:border-[#7B4A1E]'
                }`}
              >
                {dt === 'working-paper' ? 'Working Paper' : 'Draft Resolution'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-[#C4A882] mb-1 block">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. WP on climate adaptation"
            className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E]"
          />
        </div>

        <div>
          <label className="text-xs text-[#C4A882] mb-1 block">Sponsors <span className="text-[#7A5A38]">(comma-separated, optional)</span></label>
          <input
            type="text"
            value={sponsors}
            onChange={(e) => setSponsors(e.target.value)}
            placeholder={`${country}, France, Germany`}
            className="w-full bg-[#150F09] border border-[#2E1E0F] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7B4A1E]"
          />
        </div>

        <div>
          <label className="text-xs text-[#C4A882] mb-1 block">Attach file <span className="text-[#7A5A38]">(optional)</span></label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs bg-[#150F09] border border-[#2E1E0F] hover:border-[#7B4A1E] text-[#C4A882] px-3 py-2 rounded-lg transition-colors"
            >
              {fileName ? `📎 ${fileName}` : '+ Attach file'}
            </button>
            {fileName && (
              <button onClick={() => { setFileName(null); setFileUrl(null); }} className="text-xs text-[#7A5A38] hover:text-red-400">
                Remove
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || sending}
          className="w-full bg-[#7B4A1E] hover:bg-[#8B5A2B] disabled:bg-[#2E1E0F] disabled:text-[#7A5A38] text-white py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {sending ? 'Submitting…' : 'Submit to Chair →'}
        </button>
      </div>

      {/* Existing documents */}
      {(committee.documents ?? []).length > 0 && (
        <div>
          <div className="text-xs font-mono text-[#7A5A38] mb-2">SUBMITTED DOCUMENTS</div>
          <div className="space-y-2">
            {(committee.documents ?? []).map((doc) => (
              <div key={doc.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-sm">{doc.docCode} — {doc.title}</div>
                  <span className={`text-xs font-bold ml-2 ${
                    doc.status === 'on-floor' ? 'text-[#B8844A]' :
                    doc.status === 'passed' ? 'text-emerald-400' :
                    doc.status === 'failed' ? 'text-red-400' : 'text-[#7A5A38]'
                  }`}>{doc.status}</span>
                </div>
                {doc.sponsors.length > 0 && (
                  <div className="text-xs text-[#7A5A38] mt-1">Sponsors: {doc.sponsors.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Delegate Session ─────────────────────────────────────────────────────
function DelegateSessionInner({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const country = searchParams.get('country') || '';

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'session' | 'motions' | 'resolutions' | 'documents' | 'chat'>('session');

  const committeeIdRef = useRef('');

  const { getSettings } = useSettingsStore();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function load() {
      const found = await getCommitteeByCode(code.toUpperCase());
      setCommittee(found ?? null);
      setLoading(false);
      if (found) {
        committeeIdRef.current = found.id;
        unsubscribe = subscribeToCommittee(found.id, async () => {
          const updated = await getCommitteeByCode(code.toUpperCase());
          if (updated) setCommittee(updated);
        });
      }
    }
    load();
    return () => unsubscribe?.();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#C4A882] text-sm">Joining session…</p>
        </div>
      </div>
    );
  }

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

  const settings = getSettings(committee.code);
  const myDelegate = committee.delegates.find((d) => d.country === country);
  const isOnSpeakersList = committee.speakersList.some((s) => s.country === country);
  const isCurrentSpeaker = committee.currentSpeaker?.country === country;
  const progress = isCurrentSpeaker ? (committee.speakerTimeRemaining / committee.speakerTimeLimit) * 100 : 0;

  const enabledMotionTypes = {
    moderated: settings.motionModeratedCaucus,
    unmoderated: settings.motionUnmoderatedCaucus,
    consultation: settings.motionCoW,
    tour: settings.motionTourDeTable,
  };

  const phaseLabel: Record<string, string> = {
    'pre-session': 'Pre-Session',
    'roll-call': 'Roll Call',
    'speakers-list': 'General Debate',
    'moderated-caucus': 'Moderated Caucus',
    'unmoderated-caucus': 'Unmoderated Caucus',
    'voting': 'Voting Procedure',
    'adjourned': 'Adjourned',
  };

  const handleAddMeToSpeakers = () => {
    if (!myDelegate) return;
    addToSpeakersListInDB(committee.id, myDelegate.id, myDelegate.country);
  };

  return (
    <div className="min-h-screen bg-[#0D0906] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#2E1E0F] bg-[#150F08] px-4 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <img src="/gavelling-logo.png" alt="Gavelling" className="w-[16vw] h-auto max-h-9 object-contain" onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}} />
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
        {/* ── Session tab ── */}
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
                      onClick={handleAddMeToSpeakers}
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

        {/* ── Motions tab ── */}
        {tab === 'motions' && (
          <div className="p-4 max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold text-white">Motions</h2>

            {/* Motion request form */}
            <MotionRequestForm
              committee={committee}
              country={country}
              enabledTypes={enabledMotionTypes}
            />

            {/* Pending motions list */}
            {(committee.pendingMotions ?? []).length > 0 && (
              <div>
                <div className="text-xs font-mono text-[#7A5A38] mb-2">PENDING MOTIONS</div>
                <div className="space-y-2">
                  {(committee.pendingMotions ?? []).map((motion) => (
                    <div key={motion.id} className="bg-[#1A1209] border border-[#2E1E0F] rounded-xl p-4">
                      <div className="font-semibold text-white text-sm capitalize">{motion.type.replace(/-/g, ' ')}</div>
                      <div className="text-xs text-[#C4A882] mt-1">Proposed by {motion.proposedBy}</div>
                      {motion.topic && <div className="text-xs text-[#C4A882] italic mt-1">"{motion.topic}"</div>}
                      {motion.totalTime > 0 && (
                        <div className="text-xs text-[#7A5A38] mt-1">
                          {Math.floor(motion.totalTime / 60)}m total
                          {motion.speakingTime > 0 && `, ${motion.speakingTime}s per speaker`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(committee.pendingMotions ?? []).length === 0 && (
              <div className="text-center py-4 text-[#7A5A38] text-sm">No pending motions</div>
            )}
          </div>
        )}

        {/* ── Resolutions tab ── */}
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

        {/* ── Documents tab ── */}
        {tab === 'documents' && (
          <DelegateDocumentsTab committee={committee} country={country} />
        )}

        {/* ── Chat tab ── */}
        {tab === 'chat' && (
          <div className="h-[calc(100vh-120px)]">
            <ChatPanel committee={committee} senderName={country} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function DelegateSession({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0D0906] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7B4A1E] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DelegateSessionInner params={params} />
    </Suspense>
  );
}
