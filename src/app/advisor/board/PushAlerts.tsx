'use client';

// "Get alerts on this phone" (23 Oct 2026): web push for the faculty advisor board, so a
// reminder reaches a phone in a pocket. One card under the board's toolbar:
//   off        one plain line and the button (sign in first when signed out)
//   on         "Alerts on this phone are on" and Turn off; "Paused" while the board's
//              own Alerts toggle is off (the server then sends nothing to this phone)
//   blocked    notifications are blocked in the browser: one line, no button
//   iPhone     iOS 16.4+ outside a Home Screen web app: how to add it, no button
// Hidden entirely without NEXT_PUBLIC_VAPID_PUBLIC_KEY or the Push API (push.ts), so
// nothing is promised before the server side is deployed. All logic is in push.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Loader2, Share } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { useLanguage, useT } from '@/contexts/LanguageContext';
import {
  currentSubscription, disablePush, enablePush, pushSignature, pushSupport, readLocalPush, resavePush,
  serverHasSubscription, writeWorkerLocal, type DeviceFollow, type PushSupport, type WorkerLocalData,
} from '@/lib/advisorBoard/push';
import type { BoardRoom } from '@/lib/advisorBoard/store';
import { C, SHADOW } from './tokens';

/** Re-save at least this often while the board is open (the server rebuilds follows). */
const RESAVE_EVERY_MS = 6 * 60 * 60 * 1000;

type Status = 'checking' | 'off' | 'on' | 'blocked';

export default function PushAlerts({ rooms, remindersOn }: { rooms: BoardRoom[]; remindersOn: boolean }) {
  const t = useT();
  const { language } = useLanguage();
  const { user, loading } = useAuth();
  const uid = loading ? null : user?.id ?? null;
  const [support, setSupport] = useState<PushSupport>('none');
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rooms added by code on this phone: (code, country) for the server, names for the worker.
  const follows: DeviceFollow[] = useMemo(
    () => rooms.flatMap((r) => r.follows.map((f) => ({ code: r.code, country: f.country }))),
    [rooms],
  );
  const local: WorkerLocalData = useMemo(() => {
    const names: Record<string, string[]> = {};
    for (const r of rooms) {
      for (const f of r.follows) {
        const list = [f.name, f.name2].map((n) => n?.trim() ?? '').filter(Boolean);
        if (list.length) names[`${r.code}|${f.country.trim().toLowerCase()}`] = list;
      }
    }
    return {
      lang: language,
      dir: language === 'ar' ? 'rtl' : 'ltr',
      templates: {
        speaking: t('adv_banner_speaking'),
        speaking_many: t('adv_banner_speaking_many'),
        next: t('adv_banner_next'),
        next_many: t('adv_banner_next_many'),
        soon: t('adv_banner_soon'),
        soon_many: t('adv_banner_soon_many'),
        test_title: t('adv_push_test_title'),
        test_body: t('adv_push_test_body'),
      },
      names,
    };
  }, [rooms, language, t]);

  // Is this phone already on, for THIS account? (Another account's alerts read as off.)
  useEffect(() => {
    const s = pushSupport();
    let cancelled = false;
    // Applied on the next task, never synchronously inside the effect.
    const apply = (next: Status) => window.setTimeout(() => { if (!cancelled) setStatus(next); }, 0);
    setTimeout(() => { if (!cancelled) setSupport(s); }, 0);
    if (s !== 'ok') return () => { cancelled = true; };
    if (Notification.permission === 'denied') { apply('blocked'); return () => { cancelled = true; }; }
    void (async () => {
      const sub = await currentSubscription();
      const mine = readLocalPush();
      if (cancelled) return;
      apply(sub && uid && mine && mine.uid === uid && mine.endpoint === sub.endpoint && Notification.permission === 'granted' ? 'on' : 'off');
    })();
    return () => { cancelled = true; };
  }, [uid]);

  // While on: keep the worker's wording and names current, and the server's copy of this
  // phone's rooms and Alerts toggle (re-saved when they change, and every few hours).
  const verified = useRef(false);
  useEffect(() => {
    if (status !== 'on' || !uid) return;
    void writeWorkerLocal(local);
    const mine = readLocalPush();
    const sig = pushSignature(remindersOn, follows);
    const due = !mine || mine.sig !== sig || Date.now() - mine.savedAt > RESAVE_EVERY_MS;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!verified.current) {
          verified.current = true;
          // The server forgot this phone (it failed too often, or the row was removed):
          // this account opted in here, so save it again quietly.
          if (mine && (await serverHasSubscription(mine.endpoint)) === false) { await resavePush(remindersOn, follows, uid); return; }
        }
        if (due) await resavePush(remindersOn, follows, uid);
      })();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [status, uid, local, follows, remindersOn]);

  const turnOn = useCallback(async () => {
    if (!uid) { openAuth({ next: '/advisor' }); return; }
    setError(null);
    setBusy(true);
    const res = await enablePush({ uid, enabled: remindersOn, follows, local });
    setBusy(false);
    if (res === 'ok') { setStatus('on'); return; }
    if (res === 'denied') { setStatus(Notification.permission === 'denied' ? 'blocked' : 'off'); return; }
    setStatus('off');
    if (res === 'signed-out') { openAuth({ next: '/advisor' }); return; }
    setError(res === 'unsupported' ? t('adv_push_unsupported') : t('adv_push_failed'));
  }, [uid, remindersOn, follows, local, t]);

  const turnOff = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await disablePush();
      setStatus('off');
    } catch {
      setError(t('adv_push_off_failed'));
    }
    setBusy(false);
  }, [t]);

  if (support === 'none' || loading) return null;

  if (support === 'ios-home-screen') {
    return (
      <Card>
        <Share size={20} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" style={{ color: C.ink }} />
        <p className="min-w-0 flex-1" style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, lineHeight: 1.4 }}>{t('adv_push_ios')}</p>
      </Card>
    );
  }
  if (status === 'checking') return null;

  const on = status === 'on';
  const working = busy;
  const line = status === 'blocked'
    ? t('adv_push_blocked')
    : on
      ? (remindersOn ? t('adv_push_line') : t('adv_push_paused'))
      : uid ? t('adv_push_line') : t('adv_push_signin');

  return (
    <Card>
      <BellRing size={20} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" style={{ color: C.ink }} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          {on && <p style={{ fontSize: 15, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{t('adv_push_on')}</p>}
          <p title={t('adv_push_privacy')} style={{ fontSize: 14, fontWeight: 600, color: C.inkSoft, lineHeight: 1.4 }}>{line}</p>
          {error && <p role="status" className="mt-1" style={{ fontSize: 13.5, fontWeight: 600, color: C.danger }}>{error}</p>}
        </div>
        {status !== 'blocked' && (on ? (
          <button type="button" onClick={() => void turnOff()} disabled={working} aria-busy={working}
            className="adv-focus flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 transition-transform active:scale-[0.97] disabled:opacity-60"
            style={{ backgroundColor: 'rgba(27,56,40,0.08)', color: C.forest, fontSize: 14.5, fontWeight: 800 }}>
            {working && <Loader2 size={16} strokeWidth={2} aria-hidden className="animate-spin" />}
            {t('adv_push_turn_off')}
          </button>
        ) : (
          <button type="button" onClick={() => void turnOn()} disabled={working} aria-busy={working}
            className="adv-focus flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 transition-transform active:scale-[0.97] disabled:opacity-70"
            style={{ backgroundColor: C.forest, color: C.gold, fontSize: 14.5, fontWeight: 800 }}>
            {working && <Loader2 size={16} strokeWidth={2} aria-hidden className="animate-spin" />}
            {t('adv_push_btn')}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: C.cream, boxShadow: SHADOW.card }}>
      {children}
    </div>
  );
}
