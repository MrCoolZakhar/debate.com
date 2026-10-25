'use client';
// /crisis: the crises you work on (signed in), and the personal code entry for everyone else.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, ArrowRight } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import ProfileAvatarMenu from '@/components/ProfileAvatar';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { codeLogin, listMyCrises, type MyCrisis } from '@/lib/crisis/api';
import { ROLE_LABEL, type CrisisRole } from '@/lib/crisis/types';
import { CK, Btn, Card, Eyebrow, fieldStyle, FieldLabel, Skeleton } from './crisisKit';
import { Suspense } from 'react';
import TryAsPanel from './components/command/TryAsPanel';

function CodeEntry({ next, initialCode }: { next: string | null; initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await codeLogin(code, password);
      if (!r.ok) {
        setError(r.reason === 'locked' ? `Too many wrong tries. Try again in ${Math.ceil((r.wait_seconds ?? 600) / 60)} minutes.` : 'That code and password do not match.');
        return;
      }
      const target = `/crisis/${r.conference_slug}/${r.crisis_slug}`;
      router.push(next && next.startsWith(target) ? next : target);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ padding: 22 }}>
      <h2 className="flex items-center gap-2" style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>
        <KeyRound size={18} strokeWidth={1.6} color={CK.red} />Enter With a Personal Code
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: 13.5, color: CK.inkSoft }}>Use your committee&apos;s room code, or the personal code from your Crisis Director, with your own password.</p>
      <form onSubmit={submit} className="grid" style={{ gap: 12 }}>
        <div>
          <FieldLabel htmlFor="crisis-code">Code</FieldLabel>
          <input id="crisis-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="username" autoCapitalize="characters"
            placeholder="For example 03FAAB" style={{ ...fieldStyle, letterSpacing: '0.12em', fontWeight: 700 }} required />
        </div>
        <div>
          <FieldLabel htmlFor="crisis-password">Password</FieldLabel>
          <input id="crisis-password" type="password" inputMode="numeric" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" style={fieldStyle} required />
        </div>
        {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: CK.danger, fontWeight: 600 }}>{error}</p>}
        <Btn type="submit" tone="red" disabled={busy || !code || !password} style={{ justifyContent: 'center' }}>{busy ? 'Entering' : 'Enter the crisis'}</Btn>
      </form>
    </Card>
  );
}

function CrisisHome() {
  const { user, loading } = useAuth();
  const search = useSearchParams();
  const next = search?.get('next') ?? null;
  const [list, setList] = useState<MyCrisis[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    listMyCrises().then((l) => { if (!cancelled) setList(l); }).catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [user?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen" style={{ background: CK.pageBg, fontFamily: CK.font, color: CK.ink }}>
      <header className="flex items-center" style={{ height: 60, padding: '0 18px', gap: 12 }}>
        <BrandLogo height={22} priority />
        <div className="flex-1" />
        {user ? <ProfileAvatarMenu size={36} /> : <Btn tone="ghost" size="sm" onClick={() => openAuth({ next: '/crisis' })}>Sign in</Btn>}
      </header>
      <main style={{ padding: '18px 18px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <Eyebrow>GAVELLING CRISIS</Eyebrow>
        <h1 style={{ margin: '4px 0 18px', fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 800 }}>Your Crises</h1>
        <div className="grid" style={{ gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
          <Card warm style={{ padding: 22 }}>
            {!user && !loading && (
              <>
                <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Sign In to See Your Crises</h2>
                <p style={{ margin: '0 0 14px', fontSize: 13.5, color: CK.inkSoft }}>Crisis Directors, staff, chairs and delegates with a Gavelling account find their crisis here.</p>
                <Btn onClick={() => openAuth({ next: '/crisis' })}>Sign in</Btn>
              </>
            )}
            {(loading || (user && list === null && !error)) && <div className="grid" style={{ gap: 10 }}><Skeleton h={22} w="60%" /><Skeleton h={54} /><Skeleton h={54} /></div>}
            {error && <p role="alert" style={{ color: CK.danger, fontWeight: 600, margin: 0 }}>{error}</p>}
            {user && list && list.length === 0 && (
              <>
                <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>No Crises Yet</h2>
                <p style={{ margin: 0, fontSize: 13.5, color: CK.inkSoft }}>When an organiser switches on Gavelling Crisis for a committee and adds you, it shows up here.</p>
              </>
            )}
            {user && list && list.length > 0 && (
              <div className="grid" style={{ gap: 8 }}>
                {list.map((c) => (
                  <Link key={c.crisis_id} href={`/crisis/${c.conference_slug}/${c.crisis_slug}`}
                    className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]"
                    style={{ gap: 12, padding: '10px 12px', borderRadius: 14, background: CK.well, textDecoration: 'none', color: CK.ink }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.logo_url || '/committee-emblems/crisis.svg'} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    <span className="min-w-0 flex-1">
                      <b style={{ display: 'block', fontSize: 14.5, overflowWrap: 'anywhere' }}>{c.crisis_name}</b>
                      <span style={{ display: 'block', fontSize: 12.5, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{c.conference_acronym} · {ROLE_LABEL[c.role as CrisisRole] ?? c.role}</span>
                    </span>
                    <ArrowRight size={17} strokeWidth={1.6} color={CK.red} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <CodeEntry next={next} initialCode={(search?.get('code') ?? '').toUpperCase()} />
        </div>
        {user && list && list.filter((c) => ['director', 'assistant_director', 'organiser'].includes(c.role)).map((c) => (
          <div key={c.crisis_id} style={{ marginTop: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: CK.inkSoft, overflowWrap: 'anywhere' }}>{c.crisis_name} · {c.conference_acronym}</p>
            <TryAsPanel cref={{ conf: c.conference_slug, crisis: c.crisis_slug, id: c.crisis_id }} />
          </div>
        ))}
      </main>
    </div>
  );
}

export default function CrisisIndexPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: CK.pageBg }} />}>
      <CrisisHome />
    </Suspense>
  );
}
