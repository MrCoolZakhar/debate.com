'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Share2, Check } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import { syncExperienceLevel } from '@/lib/munExperience';
import { CVEntryModal, type CVEntry } from '@/components/CVEntryModal';
import { Eyebrow, GlassCard, OUTFIT, MONO } from '../accountUi';
import { TimelineEntry, CVStatsRow } from './CVTimeline';

// ── Page ───────────────────────────────────────────────────────────────────

export default function CVPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [entries, setEntries]       = useState<CVEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalEntry, setModalEntry] = useState<CVEntry | null>(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [copied, setCopied]         = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user || !session) return;
    const supabase = getAuthedClient(session.access_token);
    const { data } = await supabase
      .from('mun_cv_entries')
      .select('id, entry_type, conference_name, committee, allocation, expertise_level, award, awards, photos, description, logo_url, conference_id, event_date, source, created_at')
      .eq('user_id', user.id);
    const rows = ((data as CVEntry[]) ?? []).map((r) => ({
      ...r,
      entry_type: r.entry_type ?? 'delegate',
      awards: r.awards ?? [],
      photos: r.photos ?? [],
    }));
    // Timeline order: most recent first. Prefer event_date; fall back to
    // created_at so undated entries still sort sensibly (near the bottom).
    rows.sort((a, b) => {
      const da = new Date(a.event_date ? `${a.event_date}T00:00:00` : a.created_at).getTime();
      const db = new Date(b.event_date ? `${b.event_date}T00:00:00` : b.created_at).getTime();
      return db - da;
    });
    setEntries(rows);
    setLoading(false);
    // Keep profiles.mun_experience_level in sync with the CV count.
    syncExperienceLevel(supabase, user.id, rows.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    fetchEntries();
  }, [authLoading, fetchEntries]);

  const handleDelete = useCallback(async (id: string) => {
    if (!session || !user) return;
    const supabase = getAuthedClient(session.access_token);
    await supabase.from('mun_cv_entries').delete().eq('id', id);
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      syncExperienceLevel(supabase, user.id, next.length);
      return next;
    });
  }, [session, user]);

  function handleShare() {
    if (!user) return;
    const url = `${window.location.origin}/cv/${user.id}`;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2200); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => {
        window.prompt('Copy your public CV link:', url);
      });
    } else {
      window.prompt('Copy your public CV link:', url);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <Eyebrow className="mb-2">Delegate Record</Eyebrow>
          <h1
            className="font-black text-[26px] mb-1"
            style={{ color: '#1C1410', fontFamily: OUTFIT, letterSpacing: '-0.01em' }}
          >
            MUN CV
          </h1>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT, margin: 0 }}>
            Your Model UN conference history: typeset, verified, and yours.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Share — copies a public read-only link to this CV */}
          <button
            onClick={handleShare}
            aria-label="Copy a public link to your CV"
            title={copied ? 'Link copied' : 'Share your CV'}
            className="inline-flex items-center gap-2 rounded-full focus:outline-none transition-all"
            style={{
              height: '42px',
              padding: '0 16px',
              backgroundColor: NEU_SURFACE,
              color: '#1B3828',
              border: '1px solid rgba(221,212,192,0.95)',
              boxShadow: '0 4px 14px rgba(27,56,40,0.10)',
              fontFamily: OUTFIT,
              fontWeight: 800,
              fontSize: '12.5px',
              letterSpacing: '0.02em',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            {copied ? <Check size={16} strokeWidth={2.6} style={{ color: '#2A5A3C' }} /> : <Share2 size={15} strokeWidth={2.4} />}
            {copied ? 'Copied!' : 'Share'}
          </button>

          <button
            onClick={() => { setModalEntry(null); setModalOpen(true); }}
            aria-label="Add a conference to your CV"
            title="Add conference"
            className="flex items-center justify-center flex-shrink-0 rounded-full focus:outline-none transition-all"
            style={{
              width: '58px',
              height: '58px',
              background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
              color: '#EED98A',
              border: '1px solid rgba(238,217,138,0.4)',
              boxShadow: '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 30px rgba(27,56,40,0.34), inset 0 1px 0 rgba(238,217,138,0.3)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)'; }}
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        </div>
      </div>

      {/* Stats row — three showcase counts + the rank insignia. */}
      <CVStatsRow entries={entries} />
      <div className="mb-8" />

      {/* Entries — vertical timeline */}
      {entries.length === 0 ? (
        <GlassCard className="text-center !py-14">
          <p className="text-lg font-bold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            No entries yet
          </p>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#9A8A78', fontFamily: OUTFIT, lineHeight: 1.7 }}>
            Add your past conferences manually, or they&apos;ll appear automatically when you attend Gavelling-verified conferences.
          </p>
          <button
            onClick={() => { setModalEntry(null); setModalOpen(true); }}
            aria-label="Add your first conference"
            className="flex items-center justify-center rounded-full focus:outline-none transition-all mx-auto"
            style={{
              width: '58px',
              height: '58px',
              background: 'radial-gradient(120% 120% at 30% 25%, #2A5A3C 0%, #1B3828 70%)',
              color: '#EED98A',
              border: '1px solid rgba(238,217,138,0.4)',
              boxShadow: '0 8px 22px rgba(27,56,40,0.28), inset 0 1px 0 rgba(238,217,138,0.25)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.07)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
          <p className="text-[12px] mt-3" style={{ color: '#B6871F', fontFamily: MONO, letterSpacing: '0.1em', margin: '12px 0 0 0' }}>
            ADD YOUR FIRST ENTRY
          </p>
        </GlassCard>
      ) : (
        <div className="flex flex-col">
          {entries.map((entry, i) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isLast={i === entries.length - 1}
              onEdit={() => { setModalEntry(entry); setModalOpen(true); }}
            />
          ))}
        </div>
      )}

      {modalOpen && user && (
        <CVEntryModal
          existing={modalEntry}
          userId={user.id}
          onClose={() => { setModalOpen(false); setModalEntry(null); }}
          onSaved={fetchEntries}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

const NEU_SURFACE = '#FAF8F3';
