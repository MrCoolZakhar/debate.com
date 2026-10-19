'use client';

/**
 * useConferenceDraft: the creation wizard's server-side draft (12 Oct 2026).
 *
 * The page owns every answer; this hook only
 *   1. finds out whether the drafts SQL exists (`available`; false = behave
 *      exactly as before: signed-out visitors go to sign in, nothing is saved),
 *   2. resumes a draft from `?draft=<token>`, this browser's token, or the
 *      signed-out copy kept in this browser, handing the saved answers back
 *      through `restore`,
 *   3. autosaves: about 1 s after the last change, at once on a step change,
 *      and on `pagehide`. Signed in, or holding a server token: to the
 *      server. Signed out with no token (owner, 19 Oct 2026: no email step):
 *      to this browser only, because the server never mints a draft without
 *      an email and the wizard no longer asks for one. Signing in turns that
 *      copy into the account's server draft on the next save,
 *   4. marks the draft finished once the conference exists.
 *
 * It never sends an email address: a signed-in save takes the account's on
 * the server (src/lib/conferenceDrafts.ts).
 *
 * It never writes committee or conference data and never sends anything: the
 * reminder emails are the database's job (queue_conference_draft_reminders).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  conferenceDraftsAvailable, loadConferenceDraft, saveConferenceDraft, saveConferenceDraftKeepalive,
  stopConferenceDraftReminders, finishConferenceDraft, claimConferenceDrafts, fingerprintConferenceDraft,
  readLocalDraftToken, writeLocalDraftToken, isDraftToken, setPendingCreate, readPendingCreate,
  readLocalDraft, writeLocalDraft, clearLocalDraft, LOCAL_PENDING_CREATE, type RpcAnswer, type SaveDraftAnswer,
} from '@/lib/conferenceDrafts';
import { replaceUrlInPlace } from '@/lib/replaceUrlInPlace';

export type DraftStatus =
  | 'loading'        // probing / loading a saved draft
  | 'ready'          // the wizard may run (with or without a draft)
  | 'needs_sign_in'  // a claimed draft was opened while signed out
  | 'not_yours'      // a claimed draft of another account was opened
  | 'load_failed';   // the saved draft could not be read; saving is paused

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Options {
  userId: string | null;
  accessToken: string | null;
  authLoading: boolean;
  /** Everything the wizard would restore. Recomputed by the page each render. */
  data: Record<string, unknown>;
  step: number;
  /** Signed-in drafts are only created once something was entered. */
  hasContent: boolean;
  restore: (data: Record<string, unknown>, step: number) => void;
}

let claimedThisLoad: string | null = null;

export function useConferenceDraft({ userId, accessToken, authLoading, data, step, hasContent, restore }: Options) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<DraftStatus>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest runSave, for the retry timer, a queued second save and the
  // sign-in path (all of which run after the render that made it).
  const runSaveRef = useRef<() => Promise<boolean>>(async () => true);

  const restoreRef = useRef(restore);
  const tokenRef = useRef<string | null>(null);
  const savedPrint = useRef<string>('');
  const inFlight = useRef(false);
  const again = useRef(false);
  const blockedPrint = useRef<string>('');   // a refused save is not retried until the data changes
  // The server save in flight, so `finish` can wait for the token it mints.
  const pendingSave = useRef<Promise<RpcAnswer<SaveDraftAnswer>> | null>(null);
  // Set once the conference exists: nothing is saved after that.
  const finished = useRef(false);
  const latest = useRef({ data, step, accessToken, userId });
  useLayoutEffect(() => {
    latest.current = { data, step, accessToken, userId };
    restoreRef.current = restore;
  });
  const loadedFor = useRef<string | null>(null);
  // True once the wizard is running with answers in memory. Signing in after
  // that must NOT reload the draft over them (the server copy can be up to a
  // second older); the next save claims it by its token instead.
  const running = useRef(false);

  const print = fingerprintConferenceDraft(data, step);

  const adoptToken = useCallback((t: string | null) => {
    tokenRef.current = t;
    setToken(t);
    writeLocalDraftToken(t);
  }, []);

  // 1. Is the SQL there?
  useEffect(() => {
    let cancelled = false;
    void conferenceDraftsAvailable().then((ok) => { if (!cancelled) setAvailable(ok); });
    return () => { cancelled = true; };
  }, []);

  // 2. Resume, once per account (signed out counts as one).
  useEffect(() => {
    if (available === null || authLoading) return;
    if (!available) { void Promise.resolve().then(() => setStatus('ready')); return; }
    const key = userId ?? 'anon';
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    let cancelled = false;

    void (async () => {
      if (!running.current) setStatus('loading');
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('draft');
      const wantsStop = params.get('stop') === '1';
      const urlToken = isDraftToken(fromUrl) ? fromUrl : null;
      const t = urlToken ?? tokenRef.current ?? readLocalDraftToken();

      if (userId && claimedThisLoad !== userId) {
        claimedThisLoad = userId;
        await claimConferenceDrafts();
      }
      if (running.current && !urlToken) {
        // Signed in mid-wizard: keep what is on screen and save it now, which
        // claims the draft for this account by its token, or (a browser-only
        // draft) creates the account's server draft on the next autosave.
        savedPrint.current = '';
        if (!cancelled) { setStatus('ready'); if (tokenRef.current) void runSaveRef.current(); }
        return;
      }
      if (t && wantsStop) {
        const s = await stopConferenceDraftReminders(t);
        if (!cancelled && s.kind === 'ok' && s.data.ok) {
          setNotice('Done. We will not remind you about this draft again. It is still saved.');
        }
      }
      // The token now lives in this browser; keep it out of the address bar.
      if (urlToken || wantsStop) replaceUrlInPlace('/conferences/new');

      if (!t) {
        // No server draft: the signed-out copy this browser kept, if any. Once
        // signed in (a Google round trip reloads the page) it is saved to the
        // account at once, so the baseline is left empty.
        const local = readLocalDraft();
        if (cancelled) return;
        if (local) {
          restoreRef.current(local.data, local.step);
          savedPrint.current = userId ? '' : '__restored__';
        }
        setStatus('ready');
        return;
      }

      const a = await loadConferenceDraft(t);
      if (cancelled) return;
      if (a.kind === 'missing') { setAvailable(false); setStatus('ready'); return; }
      if (a.kind === 'error') { tokenRef.current = t; setToken(t); setStatus('load_failed'); return; }
      const r = a.data;
      if (r.ok) {
        adoptToken(r.token);
        restoreRef.current(r.data ?? {}, r.step ?? 1);
        // The restored answers are what is saved: no save until they change.
        savedPrint.current = '__restored__';
        setStatus('ready');
        return;
      }
      if (r.reason === 'sign_in') {
        tokenRef.current = t; setToken(t);
        setMaskedEmail(r.email_masked ?? null);
        setStatus('needs_sign_in');
        loadedFor.current = null;   // load again once they sign in
        return;
      }
      if (r.reason === 'not_yours') {
        if (urlToken) { setStatus('not_yours'); return; }
        adoptToken(null);
        setStatus('ready');
        return;
      }
      // finished, deleted, not found: start fresh.
      adoptToken(null);
      if (urlToken && r.reason === 'finished') setNotice('This conference has already been created.');
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [available, authLoading, userId, adoptToken, reloadNonce]);

  // After a restore the first fingerprint is the baseline, not a change.
  useEffect(() => {
    if (savedPrint.current === '__restored__') savedPrint.current = print;
  }, [print]);

  useEffect(() => { if (status === 'ready') running.current = true; }, [status]);

  const canSave = available === true && status === 'ready' && (token !== null || hasContent);

  const runSave = useCallback(async (): Promise<boolean> => {
    if (finished.current) return true;
    if (inFlight.current) { again.current = true; return true; }
    const { data: d, step: s, userId: uid } = latest.current;
    const p = fingerprintConferenceDraft(d, s);
    if (p === savedPrint.current || p === blockedPrint.current) return true;
    if (!uid && !tokenRef.current) {
      // Signed out with no server draft: this browser keeps it.
      const ok = writeLocalDraft(d, s);
      savedPrint.current = p;
      setSaveState(ok ? 'saved' : 'idle');
      return ok;
    }
    inFlight.current = true;
    setSaveState('saving');
    const req = saveConferenceDraft(tokenRef.current, d, s);
    pendingSave.current = req;
    const a = await req;
    pendingSave.current = null;
    inFlight.current = false;
    let ok = false;
    if (a.kind === 'missing') { setAvailable(false); setSaveState('idle'); }
    else if (a.kind === 'error') {
      // Offline or a server hiccup: try again in a few seconds.
      setSaveState('error');
      if (!retryTimer.current) {
        retryTimer.current = setTimeout(() => { retryTimer.current = null; void runSaveRef.current(); }, 5000);
      }
    }
    else if (a.data.ok) {
      ok = true;
      if (a.data.token !== tokenRef.current) adoptToken(a.data.token);
      // Saved to the account now: the signed-out copy has done its job.
      if (uid) clearLocalDraft();
      savedPrint.current = p;
      setSaveState('saved');
      setSaveError('');
    } else {
      const reason = a.data.reason;
      if (reason === 'finished' || reason === 'deleted' || reason === 'not_found') {
        // That draft is gone: the next save starts a new one.
        adoptToken(null);
        again.current = true;
      } else if (reason === 'sign_in' || reason === 'not_yours') {
        setStatus(reason === 'sign_in' ? 'needs_sign_in' : 'not_yours');
        loadedFor.current = null;
      } else {
        blockedPrint.current = p;
        setSaveError(a.data.message || 'Your draft could not be saved.');
      }
      setSaveState('error');
    }
    if (again.current) { again.current = false; void runSaveRef.current(); }
    return ok;
  }, [adoptToken]);

  useLayoutEffect(() => { runSaveRef.current = runSave; }, [runSave]);
  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current); }, []);

  // 3a. Debounced autosave.
  useEffect(() => {
    if (!canSave || print === savedPrint.current || savedPrint.current === '__restored__') return;
    const t = setTimeout(() => { void runSave(); }, 1000);
    return () => clearTimeout(t);
  }, [canSave, print, runSave]);

  // 3b. At once on a step change.
  const lastStep = useRef(step);
  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    if (canSave) void Promise.resolve().then(() => runSave());
  }, [step, canSave, runSave]);

  // 3c. pagehide.
  useEffect(() => {
    function onHide() {
      const t = tokenRef.current;
      if (finished.current || available !== true || status !== 'ready') return;
      const { data: d, step: s, accessToken: at, userId: uid } = latest.current;
      if (fingerprintConferenceDraft(d, s) === savedPrint.current) return;
      if (!t) {
        // Signed out: the browser copy (synchronous). Signed in without a
        // token yet: the debounced save a second ago is the last word.
        if (!uid) writeLocalDraft(d, s);
        return;
      }
      saveConferenceDraftKeepalive(t, d, s, at);
    }
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [available, status]);

  /** Save now (before opening the sign-in pop-up, before creating). */
  const flush = useCallback(async () => {
    if (canSave) await runSave();
  }, [canSave, runSave]);

  /** The conference exists: the draft is done, and this browser forgets it. */
  const finish = useCallback(async (conferenceId: string) => {
    finished.current = true;
    setPendingCreate(null);
    clearLocalDraft();
    // A save that is minting the account's draft right now: wait for its token.
    if (pendingSave.current) { try { await pendingSave.current; } catch { /* nothing to finish */ } }
    const t = tokenRef.current;
    if (!t || available !== true) return;
    await finishConferenceDraft(t, conferenceId);
    adoptToken(null);
  }, [available, adoptToken]);

  /** Leave a draft that is not this account's and start a new one. */
  const startFresh = useCallback(() => {
    adoptToken(null);
    setStatus('ready');
  }, [adoptToken]);

  /** Read the saved draft again after a failed load. */
  const retryLoad = useCallback(() => {
    loadedFor.current = null;
    setReloadNonce((n) => n + 1);
  }, []);

  const markPendingCreate = useCallback(() => { setPendingCreate(tokenRef.current ?? LOCAL_PENDING_CREATE); }, []);
  const pendingCreate = useCallback(() => {
    const p = readPendingCreate();
    // A browser-only draft gets a token on its first signed-in save, so its
    // marker is not a token.
    return !!p && (p === tokenRef.current || p === LOCAL_PENDING_CREATE);
  }, []);
  const clearPendingCreate = useCallback(() => setPendingCreate(null), []);

  return {
    available,
    status,
    /** True while the page should not draw the wizard yet. */
    booting: available === null || (available === true && status === 'loading'),
    token,
    maskedEmail,
    saveState,
    saveError,
    notice,
    dismissNotice: () => setNotice(''),
    flush,
    finish,
    startFresh,
    retryLoad,
    markPendingCreate,
    pendingCreate,
    clearPendingCreate,
  };
}
