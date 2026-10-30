'use client';
// Gavelling Crisis: the news composer. The working copy is autosaved in this browser (useNewsDraft),
// "Preview" shows the story exactly as players will see it, "Save draft" sends it to the crisis for
// approval, "Discard" throws the working copy away.

import { useEffect, useRef, useState } from 'react';
import { Check, Eye, ImagePlus, Newspaper, Paperclip, Pencil, Save, Send, Trash2, X } from 'lucide-react';
import GSelect from '@/components/GSelect';
import { notifyErr } from '@/lib/appNotify';
import { crisisError, uploadCrisisBanner, uploadCrisisFile } from '@/lib/crisis/api';
import type { News } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { Btn, Card, CardTitle, CK, FieldLabel, fieldStyle } from '../../crisisKit';
import { NewsDetailBody } from './NewsDetailDialog';
import { ALL_ROOMS, type NewsForm } from './useNewsDraft';
import { ZoomableImage } from './ImageLightbox';

export default function NewsComposer({ form, setForm, discard, savedAt, hasContent, canPublish, busy, onSave, onPublish }: {
  form: NewsForm;
  setForm: (patch: Partial<NewsForm>) => void;
  discard: () => void;
  savedAt: number | null;
  hasContent: boolean;
  canPublish: boolean;
  busy: null | 'save' | 'publish';
  onSave: () => void;
  onPublish: () => void;
}) {
  const v = useCrisis();
  const cabinets = v.core.cabinets;
  const [preview, setPreview] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [uploading, setUploading] = useState<null | 'banner' | 'file'>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [nowIso] = useState(() => new Date().toISOString());

  // The story has no limit: the box grows with the text instead of scrolling inside itself.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [form.body, preview]);

  const audienceOptions = [{ value: ALL_ROOMS, label: 'Every room' }, ...cabinets.map((c) => ({ value: c.id, label: c.name }))];
  const ready = form.title.trim().length > 0 && form.body.trim().length > 0 && !uploading;

  const pickBanner = async (file: File | undefined) => {
    if (!file) return;
    setUploading('banner');
    try { setForm({ bannerUrl: await uploadCrisisBanner(v.ref, file) }); }
    catch (e) { notifyErr(crisisError(e, 'Could not upload the banner. Try again.')); }
    finally { setUploading(null); if (bannerInput.current) bannerInput.current.value = ''; }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading('file');
    try { const r = await uploadCrisisFile(v.ref, file); setForm({ fileUrl: r.url, fileName: r.name }); }
    catch (e) { notifyErr(crisisError(e, 'Could not upload the file. Try again.')); }
    finally { setUploading(null); if (fileInput.current) fileInput.current.value = ''; }
  };

  // The story as players see it. The number comes when it is published.
  const previewNews: News = {
    id: 'preview', crisis_id: v.ref.id, title: form.title.trim() || 'Your headline', body: form.body.trim() || 'Your story appears here.',
    source_label: form.source.trim() || null, image_url: null, audience_cabinet_id: form.audience === ALL_ROOMS ? null : form.audience,
    status: 'published', author_member_id: null, published_by: null, published_at: nowIso, directive_id: null, numbers: {},
    banner_url: form.bannerUrl, attachment_url: form.fileUrl, attachment_name: form.fileUrl ? form.fileName : null, created_at: nowIso,
  };

  return (
    <Card warm>
      <CardTitle
        icon={<Newspaper size={18} strokeWidth={1.5} />}
        sub={canPublish ? 'Players see it as soon as you publish. It also pops up in the live room.' : 'Save a draft. The Crisis Director publishes it.'}
        right={(
          <Btn tone="ghost" size="sm" icon={preview ? <Pencil size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />} aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? 'Keep writing' : 'Preview'}
          </Btn>
        )}
      >
        {form.editingId ? 'Edit This Draft' : 'Write News'}
      </CardTitle>

      {preview ? (
        <div style={{ background: CK.card, borderRadius: 18, boxShadow: CK.shadowSm, overflow: 'hidden', marginBottom: 12 }}>
          <NewsDetailBody n={previewNews} preview />
        </div>
      ) : (
        <div className="grid gap-3" style={{ marginBottom: 12 }}>
          {form.bannerUrl && (
            <div style={{ position: 'relative' }}>
              <ZoomableImage src={form.bannerUrl} alt="Banner preview" style={{ width: '100%', aspectRatio: '16 / 6', borderRadius: 16, boxShadow: CK.shadowSm }} />
              <button
                type="button" aria-label="Remove the banner" onClick={() => setForm({ bannerUrl: null })}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ position: 'absolute', top: 8, right: 8, border: 0, borderRadius: 10, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.92)', color: CK.red, boxShadow: CK.shadowSm }}
              ><X size={16} strokeWidth={1.5} aria-hidden /></button>
            </div>
          )}
          <div>
            <FieldLabel htmlFor="news-title">Headline</FieldLabel>
            <input id="news-title" value={form.title} onChange={(e) => setForm({ title: e.target.value })} maxLength={200} style={fieldStyle} placeholder="What happened?" />
          </div>
          <div>
            <FieldLabel htmlFor="news-body">Story</FieldLabel>
            <textarea id="news-body" ref={bodyRef} value={form.body} onChange={(e) => setForm({ body: e.target.value })} rows={6} style={{ ...fieldStyle, resize: 'none', overflow: 'hidden', minHeight: 150, whiteSpace: 'pre-wrap' }} placeholder="Tell it like a reporter would." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="news-source">Source</FieldLabel>
              <input id="news-source" value={form.source} onChange={(e) => setForm({ source: e.target.value })} maxLength={80} style={fieldStyle} placeholder="For example Radio Moscow" />
            </div>
            <div>
              <FieldLabel htmlFor="news-audience">Who sees it</FieldLabel>
              <GSelect id="news-audience" value={form.audience} onChange={(a) => setForm({ audience: a })} options={audienceOptions} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Btn tone="ghost" icon={<ImagePlus size={15} strokeWidth={1.5} />} disabled={!!uploading || !!busy} onClick={() => bannerInput.current?.click()}>
              {uploading === 'banner' ? 'Uploading the banner' : form.bannerUrl ? 'Change the banner' : 'Add a banner'}
            </Btn>
            <Btn tone="ghost" icon={<Paperclip size={15} strokeWidth={1.5} />} disabled={!!uploading || !!busy || !!form.fileUrl} onClick={() => fileInput.current?.click()}>
              {uploading === 'file' ? 'Uploading the file' : 'Attach a file'}
            </Btn>
            <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { void pickBanner(e.target.files?.[0]); }} />
            <input ref={fileInput} type="file" accept="application/pdf,text/plain,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); }} />
          </div>
          {form.fileUrl && (
            <div className="flex items-center gap-2" style={{ background: CK.card, boxShadow: `inset 0 0 0 1px ${CK.hair}`, borderRadius: 12, padding: '8px 12px' }}>
              <Paperclip size={16} strokeWidth={1.5} aria-hidden style={{ color: CK.inkSoft, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: CK.ink, overflowWrap: 'anywhere' }}>{form.fileName || 'Attached file'}</span>
              <button
                type="button" aria-label="Remove the file" onClick={() => setForm({ fileUrl: null, fileName: null })}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                style={{ border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 0, color: CK.muted, padding: 4 }}
              ><X size={16} strokeWidth={1.5} aria-hidden /></button>
            </div>
          )}
        </div>
      )}

      {confirmDiscard ? (
        <div role="alert" style={{ background: 'rgba(163,65,47,0.08)', borderRadius: 14, padding: '10px 12px', boxShadow: 'inset 0 0 0 1px rgba(163,65,47,0.25)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13.5, color: CK.ink }}>Throw away what you wrote? It cannot be brought back.</p>
          <div className="flex flex-wrap gap-2">
            <Btn tone="red" size="sm" onClick={() => { discard(); setConfirmDiscard(false); setPreview(false); }}>Discard</Btn>
            <Btn tone="ghost" size="sm" onClick={() => setConfirmDiscard(false)}>Keep writing</Btn>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canPublish && (
            <Btn tone="green" icon={<Send size={15} strokeWidth={1.5} />} disabled={!ready || !!busy} onClick={onPublish}>
              {busy === 'publish' ? 'Publishing' : 'Publish now'}
            </Btn>
          )}
          <Btn tone="ghost" icon={<Save size={15} strokeWidth={1.5} />} disabled={!ready || !!busy} onClick={onSave}>
            {busy === 'save' ? 'Saving' : 'Save draft'}
          </Btn>
          <Btn tone="ghost" icon={<Trash2 size={15} strokeWidth={1.5} />} disabled={!!busy || (!hasContent && !form.editingId)} onClick={() => setConfirmDiscard(true)}>Discard</Btn>
          {savedAt !== null && hasContent && (
            <span className="inline-flex items-center gap-1" style={{ fontSize: 12, color: CK.muted }} role="status">
              <Check size={13} strokeWidth={1.6} aria-hidden />Draft saved
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
