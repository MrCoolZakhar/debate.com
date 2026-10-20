'use client';

// ── "From the Job Board": an applicant's ranked listing picks ──────────────
//
// Job Board prompt 3. Used in the Applications page's applicant pop-up (chair
// applicants, from job_application_picks) and in Settings > Team's review
// pop-up (team_applicants.picks). Each pick: "1. UNSC Chair", and under it the
// listing's screening questions with the applicant's answers. Renders nothing
// when there are no picks.

export interface JobPickAnswer { id?: string; question?: string | null; answer?: string | null }
export interface JobPick { listing_id: string; title: string; rank: number | null; answers?: JobPickAnswer[] | null }

const FONT = "var(--font-brand), sans-serif";

export default function JobPicksBlock({ picks, title = 'From the Job Board' }: { picks: JobPick[] | null | undefined; title?: string }) {
  const list = [...(picks ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (list.length === 0) return null;
  return (
    <section aria-label={title} style={{ fontFamily: FONT }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#1C1410' }}>{title}</h3>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((p, i) => {
          const answers = (p.answers ?? []).filter((a) => (a.question ?? '').trim() || (a.answer ?? '').trim());
          return (
            <li key={p.listing_id} style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.05), 0 4px 12px rgba(27,56,40,0.06)' }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1C1410', overflowWrap: 'anywhere' }}>
                {p.rank ?? i + 1}. {p.title}
              </p>
              {answers.length > 0 && (
                <dl style={{ margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {answers.map((a, k) => (
                    <div key={a.id ?? k}>
                      <dt style={{ fontSize: 13, fontWeight: 600, color: '#5C5140', overflowWrap: 'anywhere' }}>{a.question}</dt>
                      <dd style={{ margin: '2px 0 0', fontSize: 14.5, color: '#1C1410', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{a.answer || 'No answer'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
