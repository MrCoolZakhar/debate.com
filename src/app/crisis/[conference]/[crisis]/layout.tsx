'use client';
// Gavelling Crisis shell: resolves the viewer, then draws the dark red rail and the top bar
// around every page of one crisis. Pages read the shared state with useCrisis().

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ScrollText, Map as MapIcon, Newspaper, ContactRound, UsersRound, Settings, Presentation,
  Home, LogOut, KeyRound,
} from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import ProfileAvatarMenu from '@/components/ProfileAvatar';
import { useAuth } from '@/components/AuthProvider';
import { openAuth } from '@/lib/authModal';
import { clearCrisisToken, readCrisisToken } from '@/lib/crisis/client';
import { codeLogout } from '@/lib/crisis/api';
import { ROLE_LABEL, type CrisisRole } from '@/lib/crisis/types';
import { CK, Btn } from '../../crisisKit';
import { CrisisProvider, crisisBase, useCrisisGate, type CrisisContextValue } from './CrisisContext';
import NewsPopup from '../../components/news/NewsPopup';

interface NavItem { href: string; label: string; icon: React.ReactNode; section?: string }

function navFor(role: CrisisRole, base: string): NavItem[] {
  const ic = (I: typeof Home) => <I size={19} strokeWidth={1.6} />;
  const staffWorld: NavItem[] = [
    { href: `${base}/map`, label: 'War map', icon: ic(MapIcon) },
  ];
  if (role === 'director' || role === 'assistant_director' || role === 'organiser') {
    return [
      { href: base, label: 'Command', icon: ic(LayoutDashboard) },
      ...staffWorld,
      { href: `${base}/directives`, label: 'Directives', icon: ic(ScrollText), section: 'RUN' },
      { href: `${base}/news`, label: 'News', icon: ic(Newspaper), section: 'RUN' },
      { href: `${base}/characters`, label: 'Characters', icon: ic(ContactRound), section: 'WORLD' },
      { href: `${base}/staff`, label: 'Staff and access', icon: ic(UsersRound), section: 'SET UP' },
      { href: `${base}/settings`, label: 'Settings', icon: ic(Settings), section: 'SET UP' },
    ];
  }
  if (role === 'backroomer') {
    return [
      { href: base, label: 'Directives', icon: ic(ScrollText) },
      ...staffWorld,
      { href: `${base}/news`, label: 'News', icon: ic(Newspaper), section: 'RUN' },
      { href: `${base}/characters`, label: 'Characters', icon: ic(ContactRound), section: 'WORLD' },
    ];
  }
  if (role === 'chair') {
    return [
      { href: base, label: 'Front room', icon: ic(Presentation) },
      { href: `${base}/map`, label: 'War map', icon: ic(MapIcon) },
      { href: `${base}/news`, label: 'News', icon: ic(Newspaper) },
    ];
  }
  if (role === 'press') {
    return [
      { href: base, label: 'News', icon: ic(Newspaper) },
      { href: `${base}/map`, label: 'War map', icon: ic(MapIcon) },
    ];
  }
  return [
    { href: base, label: 'My crisis', icon: ic(Home) },
    { href: `${base}/map`, label: 'War map', icon: ic(MapIcon) },
    { href: `${base}/news`, label: 'News', icon: ic(Newspaper) },
  ];
}

function Rail({ v, items }: { v: CrisisContextValue; items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside
      aria-label="Crisis navigation"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
      className="hidden md:flex flex-col fixed"
      style={{
        left: 14, top: 66, bottom: 14, width: open ? 256 : 68, zIndex: 25, background: CK.redGrad, borderRadius: 26,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 14px 32px rgba(58,14,15,0.32), 0 2px 6px rgba(58,14,15,0.2)',
        overflow: 'hidden', transition: 'width 280ms cubic-bezier(0.22,1,0.36,1)', fontFamily: CK.font,
      }}
    >
      <div className="flex items-center" style={{ gap: 12, padding: 14, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <span className="flex-shrink-0 grid place-items-center" style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', boxShadow: '0 0 0 2px rgba(238,217,138,0.55)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.conference.logo_url || '/committee-emblems/crisis.svg'} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
        </span>
        <div style={{ opacity: open ? 1 : 0, transition: 'opacity 200ms ease 60ms', whiteSpace: 'nowrap', minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 15, fontWeight: 800, color: '#FFF4E6' }}>{v.core.crisis.name}</b>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,232,214,0.7)' }}>
            {v.core.crisis.kind === 'joint' ? `Joint crisis · ${v.core.cabinets.length} cabinets` : 'Single cabinet'}
          </span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '8px 12px', scrollbarWidth: 'none' }}>
        {items.map((it, i) => {
          const active = it.href === pathname || (it.href !== crisisBase(v.ref) && pathname?.startsWith(it.href + '/'));
          const header = it.section && it.section !== items[i - 1]?.section ? it.section : null;
          return (
            <div key={it.href}>
              {header && (
                <p style={{ margin: '9px 0 0', borderTop: '1px solid rgba(255,255,255,0.1)', height: 28, padding: '9px 10px 3px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: CK.gold, opacity: open ? 1 : 0, transition: 'opacity 200ms ease 60ms', boxSizing: 'border-box' }}>
                  {header}
                </p>
              )}
              <Link
                href={it.href}
                title={open ? undefined : it.label}
                className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EED98A]"
                style={{
                  gap: 12, height: 42, padding: '0 11px', margin: '2px 0', borderRadius: 12, textDecoration: 'none', fontWeight: 600, fontSize: 14.5,
                  background: active ? '#F8EFE5' : 'transparent', color: active ? CK.red2 : 'rgba(255,232,214,0.78)',
                  boxShadow: active ? '0 4px 14px rgba(20,4,4,0.3)' : 'none',
                }}
              >
                <span className="flex-shrink-0" style={{ lineHeight: 0 }}>{it.icon}</span>
                <span style={{ whiteSpace: 'nowrap', opacity: open ? 1 : 0, transition: 'opacity 200ms ease 60ms' }}>{it.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar({ v, items }: { v: CrisisContextValue; items: NavItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const codeUser = !v.memberId ? false : !!readCrisisToken(v.ref.conf, v.ref.crisis);
  const signOutCode = async () => {
    try { await codeLogout(v.ref); } catch { /* the token is cleared below anyway */ }
    clearCrisisToken(v.ref.conf, v.ref.crisis);
    router.replace('/crisis');
  };
  return (
    <header className="sticky z-30 flex items-center" style={{ top: 'env(safe-area-inset-top, 0px)', height: 56, gap: 14, padding: '0 18px', fontFamily: CK.font }}>
      <BrandLogo height={22} priority />
      <div className="hidden sm:flex items-center min-w-0" style={{ gap: 6, fontSize: 13, fontWeight: 600, color: CK.muted }}>
        <span>{v.conference.acronym}</span>
        <span aria-hidden>/</span>
        <b style={{ color: CK.ink, fontWeight: 700, overflowWrap: 'anywhere' }}>Gavelling Crisis</b>
      </div>
      <div className="flex-1" />
      <span className="hidden sm:inline" style={{ fontSize: 12.5, fontWeight: 600, color: CK.inkSoft }}>
        {v.displayName ? `${v.displayName} · ` : ''}{ROLE_LABEL[v.role]}
      </span>
      {codeUser ? (
        <Btn tone="ghost" size="sm" onClick={signOutCode} icon={<LogOut size={14} strokeWidth={1.6} />}>Sign out</Btn>
      ) : (
        <ProfileAvatarMenu size={36} tone="light" panelStyle={{ zIndex: 60 }} />
      )}
      {/* Phone navigation: the rail is hidden under 768px. */}
      <nav aria-label="Crisis pages" className="md:hidden fixed left-0 right-0 bottom-0 flex justify-around" style={{ background: CK.redGrad, padding: '6px 8px calc(6px + env(safe-area-inset-bottom, 0px))', zIndex: 40 }}>
        {items.slice(0, 5).map((it) => {
          const active = it.href === pathname;
          return (
            <Link key={it.href} href={it.href} className="flex flex-col items-center focus:outline-none" style={{ gap: 2, fontSize: 10.5, fontWeight: 700, textDecoration: 'none', color: active ? CK.gold : 'rgba(255,232,214,0.78)', padding: '4px 6px' }}>
              {it.icon}
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function GateScreen({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center" style={{ background: CK.pageBg, fontFamily: CK.font, padding: 16 }}>
      <div style={{ background: CK.card, borderRadius: 24, boxShadow: CK.shadow, padding: 28, maxWidth: 440, width: '100%', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/committee-emblems/crisis.svg" alt="" width={56} height={56} style={{ margin: '0 auto 12px' }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: CK.ink }}>{title}</h1>
        <p style={{ margin: '8px 0 18px', color: CK.inkSoft, fontSize: 14.5 }}>{body}</p>
        <div className="flex flex-wrap justify-center" style={{ gap: 8 }}>{children}</div>
      </div>
    </main>
  );
}

export default function CrisisLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ conference: string; crisis: string }>();
  const conf = params?.conference ?? '';
  const crisisSlug = params?.crisis ?? '';
  const { user, loading } = useAuth();
  const router = useRouter();
  // Re-resolve when the viewer changes: their account, or a personal code entered on this device.
  const identityKey = `${loading ? 'loading' : user?.id ?? 'anon'}:${typeof window !== 'undefined' && readCrisisToken(conf, crisisSlug) ? 'code' : ''}`;
  const { gate, retry } = useCrisisGate(conf, crisisSlug, identityKey);
  const value = gate.state === 'ready' ? gate.value : null;
  const items = useMemo(() => (value ? navFor(value.role, crisisBase(value.ref)) : []), [value]);

  if (gate.state === 'loading' || loading) {
    return (
      <main className="min-h-screen" style={{ background: CK.pageBg }} aria-busy="true">
        <div style={{ padding: '80px 18px 18px 98px' }}>
          <div className="animate-pulse" style={{ height: 28, width: 280, borderRadius: 10, background: 'rgba(110,30,30,0.08)' }} />
        </div>
      </main>
    );
  }
  if (gate.state === 'not_found') {
    return <GateScreen title="Crisis Not Found" body="This link does not lead to a crisis. Check the address with your Crisis Director."><Btn onClick={() => router.push('/crisis')}>Go to my crises</Btn></GateScreen>;
  }
  if (gate.state === 'denied') {
    return (
      <GateScreen
        title="You Are Not in This Crisis"
        body={user ? 'Your account is not on this crisis. Ask your Crisis Director to add you, or enter with your personal code.' : 'Sign in with your Gavelling account, or enter with the personal code and password your Crisis Director gave you.'}
      >
        {!user && <Btn onClick={() => openAuth({ next: `/crisis/${conf}/${crisisSlug}` })}>Sign in</Btn>}
        <Btn tone="ghost" icon={<KeyRound size={15} strokeWidth={1.6} />} onClick={() => router.push(`/crisis?next=${encodeURIComponent(`/crisis/${conf}/${crisisSlug}`)}`)}>Use a personal code</Btn>
      </GateScreen>
    );
  }
  if (gate.state === 'error') {
    return <GateScreen title="Could Not Open the Crisis" body={gate.message}><Btn onClick={retry}>Try again</Btn></GateScreen>;
  }

  const v = gate.value;
  return (
    <CrisisProvider value={v}>
      <div className="min-h-screen" style={{ background: CK.pageBg, backgroundAttachment: 'fixed', color: CK.ink, fontFamily: CK.font }}>
        <TopBar v={v} items={items} />
        <Rail v={v} items={items} />
        <main className="crisis-main" style={{ padding: '4px 18px 90px', marginLeft: 0 }}>
          <style>{'@media (min-width: 768px) { .crisis-main { padding-left: 98px !important; padding-bottom: 18px !important; } }'}</style>
          {children}
        </main>
        <NewsPopup />
      </div>
    </CrisisProvider>
  );
}
