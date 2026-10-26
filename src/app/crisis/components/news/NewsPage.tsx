'use client';
// Gavelling Crisis: the news page (/news, and the press home).
// Staff write news, save drafts and publish. Everyone reads the published history (RLS decides what they see).

import { useState } from 'react';
import { FileText, Newspaper, Paperclip, Pencil, Radio, Send } from 'lucide-react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, publishNews, saveNews } from '@/lib/crisis/api';
import type { News } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, Card, CardTitle, CK } from '../../crisisKit';
import NewsComposer from './NewsComposer';
import { audienceLabel, newsTime, NewsHistory } from './NewsList';
import { useCrisisNews } from './useCrisisNews';
import { ALL_ROOMS, useNewsDraft } from './useNewsDraft';

function roomsText(rooms: number): string {
  if (rooms <= 0) return 'Published. No live room was open to show it in.';
  return `Published to ${rooms} ${rooms === 1 ? 'room' : 'rooms'}`;
}

export default function NewsPage() {
  const v = useCrisis();
  const { items, error, reload } = useCrisisNews(v.ref);
  const cabinets = v.core.cabinets;
  const canPublish = v.director || (!v.settings.newsNeedsApproval && v.settings.backroomPowers.news);
  const draft = useNewsDraft(v.ref.id);
  const { form } = draft;
  const [busy, setBusy] = useState<null | 'save' | 'publish'>(null);

  const drafts = (items ?? []).filter((n) => n.status === 'draft');

  const edit = (n: News) => {
    draft.replace({
      editingId: n.id, title: n.title, body: n.body, source: n.source_label ?? '', audience: n.audience_cabinet_id ?? ALL_ROOMS,
      bannerUrl: n.banner_url, fileUrl: n.attachment_url, fileName: n.attachment_name,
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (): Promise<string> => {
    const id = await saveNews(v.ref, form.editingId, {
      title: form.title.trim(), body: form.body.trim(), source_label: form.source.trim() || null,
      audience_cabinet_id: form.audience === ALL_ROOMS ? null : form.audience,
      banner_url: form.bannerUrl, attachment_url: form.fileUrl, attachment_name: form.fileUrl ? form.fileName : null,
    });
    if (!id) throw new Error('not saved');
    draft.setForm({ editingId: id });
    return id;
  };

  const onSave = async () => {
    if (busy) return;
    setBusy('save');
    try {
      await save();
      notifyOk('Draft saved');
      draft.discard(); // it now lives in Drafts below; the working copy is no longer needed
      await reload();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save the draft. Your text is kept.'));
    } finally {
      setBusy(null);
    }
  };

  const onPublish = async () => {
    if (busy) return;
    setBusy('publish');
    try {
      const id = await save();
      const r = await publishNews(v.ref, id);
      notifyOk(roomsText(r.rooms));
      draft.discard();
      await reload();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not publish. Your text is kept.'));
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const publishDraft = async (n: News) => {
    if (busy) return;
    setBusy('publish');
    try {
      const r = await publishNews(v.ref, n.id);
      notifyOk(roomsText(r.rooms));
      if (form.editingId === n.id) draft.discard();
      await reload();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not publish.'));
    } finally {
      setBusy(null);
    }
  };

  const composer = (
    <NewsComposer
      form={form}
      setForm={draft.setForm}
      discard={draft.discard}
      savedAt={draft.savedAt}
      hasContent={draft.hasContent}
      canPublish={canPublish}
      busy={busy}
      onSave={() => { void onSave(); }}
      onPublish={() => { void onPublish(); }}
    />
  );

  const draftList = drafts.length > 0 && (
    <Card>
      <CardTitle icon={<FileText size={17} strokeWidth={1.5} />} sub="Not published yet. Only staff see these.">Drafts</CardTitle>
      <div className="grid gap-2">
        {drafts.map((n) => (
          <div key={n.id} style={{ background: CK.well, borderRadius: 14, padding: '10px 12px' }}>
            {n.banner_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.banner_url} alt="" style={{ display: 'block', width: '100%', maxWidth: 260, aspectRatio: '16 / 6', objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
            )}
            <b style={{ display: 'block', fontSize: 14, color: CK.ink, overflowWrap: 'anywhere' }}>{n.title}</b>
            <span style={{ fontSize: 12, color: CK.muted }}>
              {n.source_label ? `${n.source_label} · ` : ''}{audienceLabel(n, cabinets)} · {newsTime(n.created_at)}
            </span>
            <p style={{ margin: '4px 0 8px', fontSize: 13, color: CK.inkSoft, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflowY: 'auto' }}>{n.body}</p>
            {n.attachment_url && (
              <p className="flex items-center gap-1.5" style={{ margin: '0 0 8px', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>
                <Paperclip size={13} strokeWidth={1.5} aria-hidden style={{ flexShrink: 0 }} />{n.attachment_name || 'Attached file'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" tone="ghost" icon={<Pencil size={13} strokeWidth={1.5} />} onClick={() => edit(n)}>Edit</Btn>
              {canPublish && <Btn size="sm" tone="green" icon={<Send size={13} strokeWidth={1.5} />} disabled={!!busy} onClick={() => publishDraft(n)}>Publish</Btn>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const history = (
    <section aria-label="Published news">
      <h2 className="flex items-center gap-2" style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: CK.ink }}><Radio size={17} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />Published News</h2>
      {error && items === null
        ? <Card><p style={{ margin: 0, fontSize: 14, color: CK.danger }}>{error}</p></Card>
        : <NewsHistory items={items} cabinets={cabinets} columns={!v.staff} />}
    </section>
  );

  return (
    <div style={{ paddingTop: 8 }}>
      <h1 className="flex items-center gap-2" style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: CK.ink }}><Newspaper size={24} strokeWidth={1.5} aria-hidden style={{ color: CK.red }} />News</h1>
      {v.staff ? (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <div className="grid gap-4">{composer}{draftList}</div>
          {history}
        </div>
      ) : history}
    </div>
  );
}
