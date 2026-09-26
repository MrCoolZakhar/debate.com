// Instant route-level loading UI for the /account/* pages. It renders inside
// the account layout's content column, so switching pages paints the page's
// shape at once: the hero band and three grey card shapes floating over its
// lower edge (grey skeleton shapes, CLAUDE.md §8 "Feedback"), instead of
// leaving the previous page frozen while the next one's bundle and data load.

export default function Loading() {
  const bar = (w: string, h: number, extra: React.CSSProperties = {}) => (
    <span className="block rounded-full gv-acct-skel" style={{ width: w, height: h, backgroundColor: 'rgba(27,56,40,0.07)', ...extra }} />
  );
  return (
    <div role="status" aria-label="Loading your account">
      <style>{`
        @keyframes gvAcctSkel{0%,100%{opacity:1}50%{opacity:0.55}}
        .gv-acct-skel{animation:gvAcctSkel 1.4s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.gv-acct-skel{animation:none}}
      `}</style>
      <div className="rounded-[28px] px-6 pt-8 pb-[104px] md:px-10 md:pt-10" style={{ backgroundColor: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.06)' }}>
        {bar('110px', 12)}
        {bar('min(360px, 70%)', 38, { marginTop: 14, borderRadius: 12 })}
        {bar('min(280px, 55%)', 14, { marginTop: 14 })}
      </div>
      <div className="relative -mt-[76px] px-2 sm:px-4 md:px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-[22px] p-5" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.07), 8px 12px 28px -6px rgba(27,56,40,0.14)' }}>
            {bar('40px', 40, { borderRadius: 14 })}
            {bar('50%', 30, { marginTop: 16, borderRadius: 10 })}
            {bar('70%', 12, { marginTop: 10 })}
          </div>
        ))}
      </div>
    </div>
  );
}
