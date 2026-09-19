'use client';

// Visual kit for the "Log in or sign up" pop-up. Airbnb's language, in green:
// white surfaces, 1px grey borders, 12px radii, floating-label fields, one
// full-width green gradient button. Every step of AuthModal and its
// questionnaire is built from these, so the whole flow reads as one dialog.

import { useState } from 'react';
import Link from 'next/link';
import { EyeIcon, EyeOffIcon } from '@/app/auth/authUi';

export const OUTFIT = "'Outfit', sans-serif";
export const INK = '#222222';
export const INK_SOFT = '#6A6A6A';
export const BORDER = '#B0B0B0';
export const HAIR = '#DDDDDD';
export const FOREST = '#1B3828';
export const DANGER = '#C13515';
export const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#222222] focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/** The designed picture on the LEFT of the pop-up (owner, 19 Sep 2026: the
 *  "Wall" layout, Canva-style). One file: replace `public/auth/side.webp` with
 *  the owner's artwork and nothing else changes. Portrait, drawn with
 *  `object-fit: cover` into a 400 x 560 (and taller) panel, so supply it at
 *  800 x 1120 or larger and keep the important part away from the bottom edge.
 *  Hidden below 860px wide, where the pop-up is a single column. */
export const AUTH_SIDE_IMAGE = '/auth/side.webp';
export const AUTH_SIDE_ALT = 'Gavelling: apply to conferences, chair a committee, build your MUN CV, organise a conference for free.';
export const AUTH_SPLIT_MIN_WIDTH = 860;

/** Airbnb floating label: the label sits inside the field and moves up once
 *  the field is focused or filled (the `placeholder=" "` + :placeholder-shown
 *  trick, no JS). */
export function FloatInput({
  id, label, right, invalid, ...props
}: { id: string; label: string; right?: React.ReactNode; invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`gv-fl${invalid ? ' gv-fl-bad' : ''}${right ? ' gv-fl-right' : ''}`}>
      <input id={id} placeholder=" " aria-invalid={invalid || undefined} {...props} />
      <label htmlFor={id}>{label}</label>
      {right}
    </div>
  );
}

export function FloatPassword({
  id, label = 'Password', value, onChange, autoComplete, invalid, describedBy,
}: {
  id: string; label?: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <FloatInput
      id={id}
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      invalid={invalid}
      aria-describedby={describedBy}
      right={
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className={`gv-fl-eye ${FOCUS}`}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}

/** The green Continue. A soft light follows the pointer, as on Airbnb. */
export function GreenButton({
  children, busy, busyText, type = 'submit', onClick, disabled,
}: {
  children: React.ReactNode; busy?: boolean; busyText?: string; type?: 'submit' | 'button'; onClick?: () => void; disabled?: boolean;
}) {
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  return (
    <button
      type={type}
      data-primary
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className={`gv-green ${FOCUS}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      }}
      onMouseLeave={() => setSpot(null)}
      style={spot ? ({ '--spot-x': `${spot.x}%`, '--spot-y': `${spot.y}%` } as React.CSSProperties) : undefined}
    >
      <span className="gv-green-shine" aria-hidden style={{ opacity: spot ? 1 : 0 }} />
      <span style={{ position: 'relative' }}>{busy ? busyText ?? 'One moment…' : children}</span>
    </button>
  );
}

export function ErrorLine({ children, id }: { children: React.ReactNode; id?: string }) {
  return <p id={id} role="alert" className="gv-err">{children}</p>;
}

export function Hint({ children, id }: { children: React.ReactNode; id?: string }) {
  return <p id={id} className="gv-hint">{children}</p>;
}

export function TextButton({ children, onClick, quiet }: { children: React.ReactNode; onClick: () => void; quiet?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`gv-textbtn${quiet ? ' gv-textbtn-quiet' : ''} ${FOCUS}`}>
      {children}
    </button>
  );
}

export function TermsLine() {
  return (
    <p className="gv-hint" style={{ margin: '4px 0 0' }}>
      By selecting <strong style={{ color: INK }}>Agree and continue</strong>, I agree to Gavelling&apos;s{' '}
      <Link href="/terms" target="_blank" rel="noopener" className={`gv-inline ${FOCUS}`}>Terms of Service</Link>{' '}
      and acknowledge the{' '}
      <Link href="/privacy" target="_blank" rel="noopener" className={`gv-inline ${FOCUS}`}>Privacy Policy</Link>.
    </p>
  );
}

/** The left half of the split pop-up: one image, nothing else. */
export function AuthSideImage() {
  return (
    <div className="gv-auth-side">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={AUTH_SIDE_IMAGE} alt={AUTH_SIDE_ALT} decoding="async" />
    </div>
  );
}

/** A selectable card row (questionnaire answers). */
export function OptionRow({
  selected, onClick, children, role = 'radio',
}: { selected: boolean; onClick: () => void; children: React.ReactNode; role?: 'radio' | 'checkbox' }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={`gv-opt${selected ? ' gv-opt-on' : ''} ${FOCUS}`}
    >
      {children}
    </button>
  );
}

export const KIT_CSS = `
.gv-auth-backdrop{position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(0,0,0,0.5);animation:gvAuthFade 200ms ease;font-family:${OUTFIT};color:${INK}}
.gv-auth-panel{position:relative;width:100%;max-width:480px;max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:#FFFFFF;border-radius:32px;box-shadow:0 8px 28px rgba(0,0,0,0.28);overflow:hidden;animation:gvAuthRise 360ms cubic-bezier(0.2,0.8,0.2,1)}
.gv-auth-panel.gv-wide{max-width:568px}
.gv-auth-head{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:20px 20px 0;min-height:52px;flex-shrink:0}
.gv-auth-head-l{justify-self:start}.gv-auth-head-r{justify-self:end}
.gv-auth-head-title{margin:0;text-align:center;font-size:17px;font-weight:700;letter-spacing:-0.01em;color:${INK}}
.gv-auth-icon{width:36px;height:36px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:${INK};background:transparent;border:none;cursor:pointer;transition:background-color 160ms ease}
.gv-auth-icon:hover{background:#F2F2F2}
.gv-auth-skip{background:none;border:none;padding:6px 8px;border-radius:8px;font-family:${OUTFIT};font-size:14px;font-weight:600;color:${INK};text-decoration:underline;text-underline-offset:3px;cursor:pointer;white-space:nowrap}
.gv-auth-body{overflow-y:auto;padding:8px 32px 32px;overscroll-behavior:contain}
.gv-auth-screen{display:flex;flex-direction:column;gap:12px}
.gv-auth-brand{display:flex;align-items:center;justify-content:center;gap:8px;margin:4px auto 14px}
.gv-auth-mark{display:block;width:36px;height:36px;object-fit:contain}
.gv-auth-word{font-family:${OUTFIT};font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${FOREST}}
.gv-auth-big{margin:0 0 20px;text-align:center;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;color:${INK}}
.gv-auth-sub{margin:-8px 0 8px;text-align:center;font-size:15px;line-height:1.5;color:${INK_SOFT};text-wrap:pretty}
.gv-auth-lead{margin:4px 0 8px;font-size:15px;line-height:1.5;color:${INK_SOFT};text-wrap:pretty}
.gv-auth-lead strong{color:${INK};font-weight:600}
.gv-auth-qtitle{margin:0;text-align:center;font-size:24px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;color:${INK};text-wrap:balance}
.gv-auth-count{margin:0;text-align:center;font-size:13px;font-weight:600;color:${INK_SOFT}}
.gv-notice{margin:0 0 4px;padding:12px 14px;border-radius:12px;background:#F1F6F2;color:${FOREST};font-size:14px;line-height:1.45}
.gv-fl{position:relative}
.gv-fl input{display:block;width:100%;box-sizing:border-box;height:56px;padding:24px 14px 6px;border:1px solid ${BORDER};border-radius:12px;background:#FFFFFF;color:${INK};font-family:${OUTFIT};font-size:16px;line-height:1.25;outline:none;transition:border-color 140ms ease,box-shadow 140ms ease}
.gv-fl-right input{padding-right:48px}
.gv-fl label{position:absolute;left:15px;top:50%;transform:translateY(-50%);font-size:16px;color:${INK_SOFT};pointer-events:none;transition:top 140ms ease,font-size 140ms ease;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 30px)}
.gv-fl input:focus{border-color:${INK};box-shadow:inset 0 0 0 1px ${INK}}
.gv-fl input:focus+label,.gv-fl input:not(:placeholder-shown)+label{top:16px;font-size:12px}
.gv-fl input[readonly]{background:#F7F7F7;color:${INK_SOFT}}
.gv-fl-bad input{border-color:${DANGER};box-shadow:inset 0 0 0 1px ${DANGER};background:#FFF8F6}
.gv-fl-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;color:${INK_SOFT};border-radius:8px;cursor:pointer}
.gv-static{position:relative}
.gv-static-label{display:block;margin:0 0 6px 2px;font-size:13px;font-weight:600;color:${INK}}
.gv-dp>div>button{height:56px!important;background:#FFFFFF!important;border:1px solid ${BORDER}!important;border-radius:12px!important;font-size:16px!important;padding:0 14px!important}
.gv-dp>div>button:focus-visible{border-color:${INK}!important;box-shadow:inset 0 0 0 1px ${INK}!important}
.gv-hint{margin:0;font-size:12.5px;line-height:1.5;color:${INK_SOFT}}
.gv-err{margin:0;font-size:13.5px;line-height:1.45;color:${DANGER}}
.gv-green{position:relative;overflow:hidden;width:100%;height:52px;padding:0 20px;border:none;border-radius:10px;cursor:pointer;color:#FFFFFF;font-family:${OUTFIT};font-size:16px;font-weight:600;background:linear-gradient(90deg,${FOREST} 0%,#24593A 45%,#2F7A4C 100%);transition:transform 120ms ease,opacity 160ms ease}
.gv-green:active{transform:scale(0.985)}
.gv-green:disabled{cursor:default;opacity:0.7}
.gv-green-shine{position:absolute;inset:0;background:radial-gradient(circle at var(--spot-x,50%) var(--spot-y,50%),rgba(120,210,150,0.45) 0%,rgba(120,210,150,0) 60%);transition:opacity 200ms ease;pointer-events:none}
.gv-or{display:flex;align-items:center;gap:10px;margin:14px 0}
.gv-or span{flex:1;height:1px;background:${HAIR}}
.gv-or em{font-family:${OUTFIT};font-style:normal;font-weight:500;font-size:12px;line-height:1;color:#6A6A6A}
.gv-socials{display:flex;justify-content:center;gap:16px}
.gv-social{width:56px;height:56px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #E4E4E4;border-radius:12px;background:#FFFFFF;cursor:pointer;transition:background-color 140ms ease,transform 120ms ease}
.gv-social:hover{background:#F7F7F7}
.gv-social:active{transform:scale(0.96)}
.gv-social:disabled{opacity:0.55;cursor:default}
.gv-social svg{width:22px;height:22px}
.gv-textbtn{align-self:flex-start;background:none;border:none;padding:2px 0;border-radius:4px;font-family:${OUTFIT};font-size:14px;font-weight:600;color:${INK};text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-textbtn-quiet{color:${INK_SOFT};font-weight:500}
.gv-inline{color:${INK};font-weight:600;text-decoration:underline;text-underline-offset:2px}
.gv-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px}
.gv-chip{display:flex;align-items:center;gap:10px;padding:0 14px;height:56px;border:1px solid ${HAIR};border-radius:12px;background:#F7F7F7}
.gv-chip-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:500}
.gv-opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:14px 16px;border:1px solid ${HAIR};border-radius:12px;background:#FFFFFF;font-family:${OUTFIT};color:${INK};cursor:pointer;transition:border-color 140ms ease,box-shadow 140ms ease,transform 120ms ease}
.gv-opt:hover{border-color:${INK}}
.gv-opt:active{transform:scale(0.99)}
.gv-opt-on{border-color:${INK};box-shadow:inset 0 0 0 1px ${INK};background:#F7FAF8}
.gv-opt-title{display:block;font-size:16px;font-weight:600}
.gv-opt-sub{display:block;margin-top:2px;font-size:13.5px;color:${INK_SOFT}}
.gv-list{max-height:280px;overflow-y:auto;border:1px solid ${HAIR};border-radius:12px}
.gv-list-row{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;border:none;border-bottom:1px solid #F0F0F0;background:#FFFFFF;font-family:${OUTFIT};font-size:15px;color:${INK};text-align:left;cursor:pointer}
.gv-list-row:last-child{border-bottom:none}
.gv-list-row:hover{background:#F7F7F7}
.gv-check{margin-left:auto;width:22px;height:22px;border-radius:6px;border:1px solid ${BORDER};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:#FFFFFF}
.gv-check-on{background:${FOREST};border-color:${FOREST}}
.gv-pills{display:flex;flex-wrap:wrap;gap:8px}
.gv-pill{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px 0 8px;border:1px solid ${HAIR};border-radius:999px;background:#FFFFFF;font-family:${OUTFIT};font-size:13.5px;color:${INK};cursor:pointer}
.gv-add{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:56px;border:1px dashed ${BORDER};border-radius:12px;background:#FFFFFF;font-family:${OUTFIT};font-size:15px;font-weight:600;color:${INK};cursor:pointer}
.gv-add:hover{border-color:${INK};background:#FAFAFA}
/* Split layout (the "Wall"): image LEFT, form RIGHT, 400 + 480 = 880 wide,
   at least 560 tall, 24px radius. Taller steps grow the panel (the image
   covers whatever height) up to the viewport; then the form column scrolls. */
.gv-auth-side{display:none}
@media (min-width:${AUTH_SPLIT_MIN_WIDTH}px){
  .gv-auth-panel.gv-split{max-width:880px;min-height:min(560px,calc(100dvh - 48px));flex-direction:row;border-radius:24px;box-shadow:0 30px 80px -20px rgba(0,0,0,0.55)}
  .gv-auth-panel.gv-split.gv-wide{max-width:968px}
  .gv-split .gv-auth-side{display:block;position:relative;flex:0 0 400px;background:${FOREST}}
  .gv-split .gv-auth-side img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
  .gv-split .gv-auth-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;min-height:0}
  .gv-split .gv-auth-head{padding:16px 16px 0}
  .gv-split .gv-auth-body{flex:1 1 auto;display:flex;flex-direction:column;padding:4px 44px 32px}
  .gv-split .gv-auth-body>*{margin-top:auto;margin-bottom:auto}
  .gv-split .gv-auth-brand{justify-content:flex-start;margin:0 0 22px}
  .gv-split .gv-auth-mark{width:28px;height:28px}
  .gv-split .gv-auth-word{font-size:19px;letter-spacing:-0.01em}
  .gv-split .gv-auth-big{text-align:left;font-size:30px;line-height:1.15;margin:0 0 8px}
  .gv-split .gv-auth-intro{display:block}
  .gv-split .gv-auth-terms{text-align:left}
}
.gv-auth-main{display:flex;flex-direction:column;min-height:0}
.gv-auth-intro{display:none;margin:0 0 14px;font-size:15px;line-height:1.5;color:${INK_SOFT};text-wrap:pretty}
.gv-auth-terms{margin:14px 0 0;font-size:12px;line-height:1.5;color:${INK_SOFT};text-align:center}
@keyframes gvAuthFade{from{opacity:0}to{opacity:1}}
@keyframes gvAuthRise{from{opacity:0;transform:translateY(100px)}to{opacity:1;transform:none}}
@media (max-width:743px){
  .gv-auth-backdrop{padding:0;align-items:flex-end}
  .gv-auth-panel,.gv-auth-panel.gv-wide{max-width:none;height:100dvh;max-height:100dvh;border-radius:0;animation:gvAuthSheet 340ms cubic-bezier(0.2,0.8,0.2,1)}
  .gv-auth-head{padding:14px 12px 0}
  .gv-auth-body{padding:8px 24px calc(28px + env(safe-area-inset-bottom))}
}
@keyframes gvAuthSheet{from{transform:translateY(100%)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.gv-auth-backdrop,.gv-auth-panel{animation:none}}
`;
