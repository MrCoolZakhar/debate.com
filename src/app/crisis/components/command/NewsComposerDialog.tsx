'use client';
// Gavelling Crisis: the news composer as a pop-up on Crisis Command ("Crisis news" and "Edit" on a draft).
// It wraps the same NewsComposer and working copy the News page uses (useNewsDraft), so nothing about the
// News page changes. Saving or publishing closes it with the usual glass notice.

import { useEffect, useRef, useState } from 'react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { crisisError, publishNews, saveNews } from '@/lib/crisis/api';
import type { News } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import CrisisDialog from '../delegate/CrisisDialog';
import NewsComposer from '../news/NewsComposer';
import { ALL_ROOMS, useNewsDraft } from '../news/useNewsDraft';

function roomsText(rooms: number): string {
  if (rooms <= 0) return 'Published. No live room was open to show it in.';
  return `Published to ${rooms} ${rooms === 1 ? 'room' : 'rooms'}`;
}

export default function NewsComposerDialog({ edit, onClose, onChanged }: { edit: News | null; onClose: () => void; onChanged: () => void }) {
  const v = useCrisis();
  const canPublish = v.director || (!v.settings.newsNeedsApproval && v.settings.backroomPowers.news);
  const draft = useNewsDraft(v.ref.id);
  const { form } = draft;
  const [busy, setBusy] = useState<null | 'save' | 'publish'>(null);
  const loaded = useRef(false);
  const replaceRef = useRef(draft.replace);
  useEffect(() => { replaceRef.current = draft.replace; });

  // Opening a saved draft loads it into the working copy, like Edit on the News page.
  useEffect(() => {
    if (!edit || loaded.current) return;
    loaded.current = true;
    const t = window.setTimeout(() => {
      replaceRef.current({
        editingId: edit.id, title: edit.title, body: edit.body, source: edit.source_label ?? '', audience: edit.audience_cabinet_id ?? ALL_ROOMS,
        bannerUrl: edit.banner_url, fileUrl: edit.attachment_url, fileName: edit.attachment_name,
      });
    }, 0);
    return () => window.clearTimeout(t);
  }, [edit]);

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
      draft.discard();
      onChanged();
      onClose();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not save the draft. Your text is kept.'));
    } finally { setBusy(null); }
  };

  const onPublish = async () => {
    if (busy) return;
    setBusy('publish');
    try {
      const id = await save();
      const r = await publishNews(v.ref, id);
      notifyOk(roomsText(r.rooms));
      draft.discard();
      onChanged();
      onClose();
    } catch (e) {
      notifyErr(crisisError(e, 'Could not publish. Your text is kept.'));
      onChanged();
    } finally { setBusy(null); }
  };

  return (
    <CrisisDialog title="Crisis News" onClose={onClose} width={760}>
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
    </CrisisDialog>
  );
}
