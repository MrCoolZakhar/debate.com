'use client';
// Gavelling Crisis: the news page (/news, and the press home).
// Staff write news, save drafts and publish. Everyone reads the published history (RLS decides what they see).

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Newspaper, Paperclip, Pencil, Send, Save, X } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, publishNews, saveNews, uploadCrisisBanner, uploadCrisisFile } from '@/lib/crisis/api';
import type { News } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, Card, CardTitle, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import { audienceLabel, newsTime, NewsHistory } from './NewsList';
import { useCrisisNews } from './useCrisisNews';

const ALL = 'all';

function roomsText(rooms: number): string {
  if (rooms <= 0) return 'Published. No live room was open to show it in.';
  return `Published to ${rooms} ${rooms === 1 ? 'room' : 'rooms'}`;
}

export default function NewsPage() {
  const v = useCrisis();
  const { items, error, reload } = useCrisisNews(v.ref);
  const cabinets = v.core.cabinets;
  const canPublish = v.director || (!v.settings.newsNeedsApproval && v.settings.backroomPowers.news);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState('');
  const [audience, setAudience] = useState<string>(ALL);
  const [busy, setBusy] = useState<null | 'save' | 'publish'>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState<null | 'banner' | 'file'>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // The story has no limit: the box grows with the text instead of scrolling inside itself.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const drafts = (items ?? []).filter((n) => n.status === 'draft');
  const audienceOptions = [
    { value: ALL, label: 'Every room' },
    ...cabinets.map((c) => ({ value: c.id, label: c.name })),
  ];
  const ready = title.trim().length > 0 && body.trim().length > 0 && !uploading;

  const clear = () => {
    setEditingId(null); setTitle(''); setBody(''); setSource(''); setAudience(ALL);
    setBannerUrl(null); setFileUrl(null); setFileName(null);
    if (bannerInput.current) bannerInput.current.value = '';
    if (fileInput.current) fileInput.current.value = '';
  };

  const edit = (n: News) => {
    setEditingId(n.id);
    setTitle(n.title);
    setBody(n.body);
    setSource(n.source_label ?? '');
    setAudience(n.audience_cabinet_id ?? ALL);
    setBannerUrl(n.banner_url);
    setFileUrl(n.attachment_url);
    setFileName(n.attachment_name);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async (): Promise<string | null> => {
    const id = await saveNews(v.ref, editingId, {
      title: title.trim(), body: body.trim(), source_label: source.trim() || null,
      audience_cabinet_id: audience === ALL ? null : audience,
      banner_url: bannerUrl, attachment_url: fileUrl, attachment_name: fileUrl ? fileName : null,
    });
    if (!id) throw new Error('not saved');
    setEditingId(id);
    return id;
  };

  const pickBanner = async (file: File | undefined) => {
    if (!file) return;
    setUploading('banner');
    try {
      setBannerUrl(await uploadCrisisBanner(v.ref, file));
    } catch (e) {
      notifyErr(crisisError(e, 'Could not upload the banner. Try again.'));
    } finally {
      setUploading(null);
      if (bannerInput.current) bannerInput.current.value = '';
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading('file');
    try {
      const r = await uploadCrisisFile(v.ref, file);
      setFileUrl(r.url);
      setFileName(r.name);
    } catch (e) {
      notifyErr(crisisError(e, 'Could not upload the file. Try again.'));
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onSave = async () => {
    if (!ready || busy) return;
    setBusy('save');
    try {
      await save();
      notifyOk('Draft saved');
      clear();
      await reload();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save the draft. Your text is kept.'));
    } finally {
      setBusy(null);
    }
  };

  const onPublish = async () => {
    if (!ready || busy) return;
    setBusy('publish');
    try {
      const id = await save();
      const r = await publishNews(v.ref, id as string);
      notifyOk(roomsText(r.rooms));
      clear();
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
      if (editingId === n.id) clear();
      await reload();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not publish.'));
    } finally {
      setBusy(null);
    }
  };

  const composer = (
    <Card warm>
      <CardTitle icon={<Newspaper size={18} strokeWidth={1.5} />} sub={canPublish ? 'Players see it as soon as you publish. It also pops up in the live room.' : 'Save a draft. The Crisis Director publishes it.'}>
        {editingId ? 'Edit This Draft' : 'Write News'}
      </CardTitle>
      <div className="grid gap-3">
        {bannerUrl && (
          <div style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bannerUrl} alt="Banner preview" style={{ display: 'block', width: '100%', aspectRatio: '16 / 6', objectFit: 'cover', borderRadius: 16, boxShadow: CK.shadowSm }} />
            <button
              type="button" aria-label="Remove the banner" onClick={() => setBannerUrl(null)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ position: 'absolute', top: 8, right: 8, border: 0, borderRadius: 10, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.92)', color: CK.red, boxShadow: CK.shadowSm }}
            ><X size={16} strokeWidth={1.5} aria-hidden /></button>
          </div>
        )}
        <div>
          <FieldLabel htmlFor="news-title">Headline</FieldLabel>
          <input id="news-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} style={fieldStyle} placeholder="What happened?" />
        </div>
        <div>
          <FieldLabel htmlFor="news-body">Story</FieldLabel>
          <textarea id="news-body" ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={6} style={{ ...fieldStyle, resize: 'none', overflow: 'hidden', minHeight: 150, whiteSpace: 'pre-wrap' }} placeholder="Tell it like a reporter would." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="news-source">Source</FieldLabel>
            <input id="news-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={80} style={fieldStyle} placeholder="For example Radio Moscow" />
          </div>
          <div>
            <FieldLabel htmlFor="news-audience">Who sees it</FieldLabel>
            <GSelect id="news-audience" value={audience} onChange={setAudience} options={audienceOptions} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="ghost" icon={<ImagePlus size={15} strokeWidth={1.5} />} disabled={!!uploading || !!busy} onClick={() => bannerInput.current?.click()}>
            {uploading === 'banner' ? 'Uploading the banner' : bannerUrl ? 'Change the banner' : 'Add a banner'}
          </Btn>
          <Btn tone="ghost" icon={<Paperclip size={15} strokeWidth={1.5} />} disabled={!!uploading || !!busy || !!fileUrl} onClick={() => fileInput.current?.click()}>
            {uploading === 'file' ? 'Uploading the file' : 'Attach a file'}
          </Btn>
          <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { void pickBanner(e.target.files?.[0]); }} />
          <input ref={fileInput} type="file" accept="application/pdf,text/plain,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); }} />
        </div>
        {fileUrl && (
          <div className="flex items-center gap-2" style={{ background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 12, padding: '8px 12px' }}>
            <Paperclip size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.inkSoft, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{fileName || 'Attached file'}</span>
            <button
              type="button" aria-label="Remove the file" onClick={() => { setFileUrl(null); setFileName(null); }}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
              style={{ border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0, color: CK.muted, padding: 4 }}
            ><X size={16} strokeWidth={1.5} aria-hidden /></button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {canPublish && (
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} disabled={!ready || !!busy} onClick={onPublish}>
              {busy === 'publish' ? 'Publishing' : 'Publish now'}
            </Btn>
          )}
          <Btn tone="ghost" icon={<Save size={15} strokeWidth={1.5} />} disabled={!ready || !!busy} onClick={onSave}>
            {busy === 'save' ? 'Saving' : 'Save draft'}
          </Btn>
          {editingId && <Btn tone="ghost" icon={<X size={15} strokeWidth={1.5} />} disabled={!!busy} onClick={clear}>Start over</Btn>}
        </div>
      </div>
    </Card>
  );

  const draftList = drafts.length > 0 && (
    <Card>
      <CardTitle sub="Not published yet. Only staff see these.">Drafts</CardTitle>
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
      <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: CK.ink }}>Published News</h2>
      {error && items === null
        ? <Card><p style={{ margin: 0, fontSize: 14, color: CK.danger }}>{error}</p></Card>
        : <NewsHistory items={items} cabinets={cabinets} columns={!v.staff} />}
    </section>
  );

  return (
    <div style={{ paddingTop: 8 }}>
      <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: CK.ink }}>News</h1>
      {v.staff ? (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          <div className="grid gap-4">{composer}{draftList}</div>
          {history}
        </div>
      ) : history}
    </div>
  );
}
