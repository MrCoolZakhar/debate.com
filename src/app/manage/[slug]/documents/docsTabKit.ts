// docsTabKit.ts — what the Documents tab's two modes share (prompt 111): the
// roles a document can be narrowed to, the audience line, the kind's disc and
// the tab's CSS (moved here unchanged from ConferenceDocsTab.tsx), plus the
// styles of the Document Uploads mode.

import { FileText } from 'lucide-react';
import { kindInfo } from '@/lib/conferenceDocuments';
import { TINT_GOLD, TINT_GREEN, INK, INK_SOFT, FOREST, DANGER } from '../financials/dashboardKit';

/** Roles an organiser can narrow a document to. Empty = everyone accepted. */
export const ROLE_CHOICES: { key: string; label: string }[] = [
  { key: 'delegate', label: 'Delegates' },
  { key: 'head-delegate', label: 'Head delegates' },
  { key: 'faculty-advisor', label: 'Faculty advisors' },
  { key: 'observer', label: 'Observers' },
  { key: 'chair', label: 'Chairs' },
  { key: 'secretariat', label: 'Secretariat' },
  { key: 'staff', label: 'Staff' },
];

export function audienceLine(visibleTo: string[]): string {
  if (!visibleTo || visibleTo.length === 0) return 'Everyone accepted';
  const names = ROLE_CHOICES.filter(r => visibleTo.includes(r.key)).map(r => r.label);
  return names.length ? `Only ${names.join(', ')}` : 'Everyone accepted';
}

export function kindIcon(kind: string) {
  const info = kindInfo(kind);
  return { emoji: info.emoji, lucide: info.lucide ?? FileText, tint: info.tint === 'green' ? TINT_GREEN : TINT_GOLD };
}

export const CD_CSS = `
.gv-cd-hero{position:relative;margin-top:30px;padding:46px 28px 26px!important}
.gv-cd-hero-disc{position:absolute;top:-34px;left:26px}
.gv-cd-hero-title{margin:0;font-size:clamp(28px,3vw,34px);font-weight:800;letter-spacing:-0.02em;line-height:1.1;color:${INK}}
.gv-cd-hero-line{margin:8px 0 0;font-size:15px;line-height:1.5;color:${INK_SOFT};max-width:560px}
.gv-cd-hero-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:20px}
.gv-cd-count{display:inline-flex;align-items:baseline;gap:10px}
.gv-cd-count-word{font-size:16px;font-weight:700;color:${INK}}
.gv-cd-hero .gv-st-btn{min-height:50px;padding:0 22px;font-size:15.5px}
.gv-cd-rows{display:flex;flex-direction:column;gap:14px}
.gv-cd-row{display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:20px;background:#FFFFFF;box-shadow:0 1px 0 rgba(27,56,40,0.08),0 18px 40px -30px rgba(27,56,40,0.45)}
.gv-cd-row-main{flex:1 1 auto;min-width:0}
.gv-cd-row-title{margin:0;font-size:17.5px;font-weight:800;line-height:1.3;color:${INK};overflow-wrap:anywhere}
.gv-cd-row-sub{margin:4px 0 0;font-size:14px;line-height:1.45;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cd-row-who{display:inline-block;margin-top:8px;padding:4px 10px;border-radius:8px;font-size:13px;font-weight:700;color:${FOREST};background:rgba(61,122,82,0.10)}
.gv-cd-row-who[data-some="true"]{color:#7A5A10;background:rgba(238,217,138,0.40)}
.gv-cd-row-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
.gv-cd-row-actions .gv-st-btn{min-height:44px;padding:0 16px;font-size:14.5px}
.gv-cd-move{width:44px;height:44px;border-radius:12px;border:none;background:#F6F3EC;color:${FOREST};display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.gv-cd-move:hover:not(:disabled){background:#EFE9DC}
.gv-cd-move:disabled{opacity:0.35;cursor:default}
.gv-cd-move:focus{outline:none}
.gv-cd-move:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-del{color:${DANGER}!important;font-size:14.5px;font-weight:700;text-decoration:underline;text-underline-offset:3px}
@media (max-width:700px){.gv-cd-row{flex-wrap:wrap}.gv-cd-row-actions{width:100%;justify-content:flex-start;padding-left:68px}}
.gv-cd-kinds{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.gv-cd-kind{display:flex;align-items:center;gap:10px;min-height:58px;padding:6px 12px 6px 6px;border-radius:14px;border:1.5px solid rgba(27,56,40,0.18);background:#FFFFFF;color:${INK};font-family:inherit;font-size:14.5px;font-weight:700;text-align:left;cursor:pointer}
.gv-cd-kind[aria-checked="true"]{border-color:${FOREST};box-shadow:0 0 0 1px ${FOREST};background:rgba(61,122,82,0.06)}
.gv-cd-kind:focus{outline:none}
.gv-cd-kind:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-input{width:100%;height:50px;padding:0 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:inherit;font-size:16px}
.gv-cd-input:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-cd-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;min-height:136px;padding:18px;border-radius:14px;border:2px dashed rgba(27,56,40,0.28);background:#FAF8F3;color:${INK};font-family:inherit;cursor:pointer}
.gv-cd-drop:hover,.gv-cd-drop[data-over="true"]{border-color:${FOREST};background:#F6F3EC}
.gv-cd-drop:focus{outline:none}
.gv-cd-drop:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-file{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(61,122,82,0.08)}
.gv-cd-chips{display:flex;flex-wrap:wrap;gap:8px}
.gv-cd-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid rgba(27,56,40,0.22);background:#FFFFFF;color:${INK};font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer}
.gv-cd-chip[aria-checked="true"],.gv-cd-chip[aria-pressed="true"]{background:${FOREST};border-color:${FOREST};color:#EED98A}
.gv-cd-chip:focus{outline:none}
.gv-cd-chip:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:30px 12px 12px}
.gv-cd-empty-title{margin:0;font-size:22px;font-weight:800;color:${INK}}
`;


/** Document Uploads mode (prompt 111): descriptions, returned counts, the switches, the review pop-up. */
export const EXTRA_CSS = `
.gv-cd-row-desc{margin:6px 0 0;font-size:14px;line-height:1.5;color:${INK};overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gv-cd-row-ret{margin:6px 0 0;font-size:13.5px;line-height:1.5;color:${INK_SOFT};display:flex;flex-wrap:wrap;gap:4px 14px}
.gv-cd-row-ret b{color:${INK};font-weight:800;font-variant-numeric:tabular-nums}
.gv-cd-gold{color:#8A6410!important;font-weight:800}
.gv-cd-hero-review{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:15px;font-weight:700;color:${INK}}
.gv-cd-field{display:flex;flex-direction:column;gap:6px}
.gv-cd-count-line{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:${INK_SOFT}}
.gv-cd-area{width:100%;min-height:84px;padding:11px 14px;border-radius:12px;border:1.5px solid rgba(27,56,40,0.28);background:#FFFFFF;color:${INK};font-family:inherit;font-size:16px;line-height:1.45;resize:vertical}
.gv-cd-area:focus{outline:none;border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.12)}
.gv-cd-switch{display:flex;align-items:flex-start;gap:12px;cursor:pointer}
.gv-cd-switch-track{position:relative;flex-shrink:0;width:46px;height:28px;border-radius:999px;border:none;background:#D9D3C4;cursor:pointer;transition:background-color 160ms ease;margin-top:1px}
.gv-cd-switch-track[aria-checked="true"]{background:${FOREST}}
.gv-cd-switch-track::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:999px;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:transform 160ms ease}
.gv-cd-switch-track[aria-checked="true"]::after{transform:translateX(18px)}
.gv-cd-switch-track:focus{outline:none}
.gv-cd-switch-track:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-switch-track:disabled{opacity:0.5;cursor:default}
.gv-cd-switch b{display:block;font-size:15px;color:${INK}}
.gv-cd-switch small{display:block;font-size:13px;line-height:1.45;color:${INK_SOFT};margin-top:2px}
.gv-cd-sub-block{margin-top:12px;padding:14px;border-radius:14px;background:#F6F3EC;display:flex;flex-direction:column;gap:14px}
.gv-cd-check{display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:15px;color:${INK}}
.gv-cd-check input{width:20px;height:20px;margin-top:1px;accent-color:${FOREST};flex-shrink:0}
.gv-cd-err{margin:4px 0 0;font-size:13.5px;color:${DANGER}}
.gv-buy-panel.gv-cd-pop{max-width:680px;min-height:0}
.gv-buy-panel.gv-cd-pop .gv-buy-body{flex-direction:column;min-height:0}
.gv-cd-pop-scroll{overflow-y:auto;max-height:calc(100dvh - 120px)}
@media (max-width:743px){.gv-buy-panel.gv-cd-pop{height:auto;max-height:94dvh;margin-top:auto;border-radius:22px 22px 0 0}}
.gv-buy-panel.gv-cd-rev{max-width:1180px;width:100%;min-height:0;height:min(820px,calc(100dvh - 48px))}
.gv-buy-panel.gv-cd-rev .gv-buy-body{flex-direction:column;min-height:0;height:100%}
@media (max-width:743px){.gv-buy-panel.gv-cd-rev{height:100dvh;max-height:100dvh;border-radius:0}}
.gv-cd-rev-grid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:0;border-top:1px solid rgba(27,56,40,0.12)}
@media (max-width:860px){.gv-cd-rev-grid{grid-template-columns:minmax(0,1fr)}}
.gv-cd-rev-list{overflow-y:auto;min-height:0;padding:8px 10px 16px;border-right:1px solid rgba(27,56,40,0.12)}
.gv-cd-rev-side{min-height:0;display:flex;flex-direction:column;overflow:hidden}
.gv-cd-tabs{display:flex;flex-wrap:wrap;gap:4px 18px;padding:0 2px}
.gv-cd-tab{border:none;background:none;padding:8px 0;font-family:inherit;font-size:14.5px;font-weight:700;color:${INK_SOFT};cursor:pointer;border-bottom:2.5px solid transparent;display:inline-flex;gap:6px;align-items:baseline}
.gv-cd-tab b{font-variant-numeric:tabular-nums;color:${INK}}
.gv-cd-tab[aria-selected="true"]{color:${FOREST};border-bottom-color:${FOREST}}
.gv-cd-tab:focus{outline:none}
.gv-cd-tab:focus-visible{outline:2px solid ${FOREST};outline-offset:2px;border-radius:4px}
.gv-cd-person{width:100%;display:flex;flex-direction:column;gap:3px;text-align:left;padding:12px 12px;border-radius:14px;border:none;background:none;font-family:inherit;color:${INK};cursor:pointer}
.gv-cd-person:hover{background:#F6F3EC}
.gv-cd-person[aria-current="true"]{background:rgba(61,122,82,0.10);box-shadow:inset 0 0 0 1.5px rgba(61,122,82,0.35)}
.gv-cd-person:focus{outline:none}
.gv-cd-person:focus-visible{outline:2px solid ${FOREST};outline-offset:2px}
.gv-cd-person-name{font-size:15.5px;font-weight:800;line-height:1.3;overflow-wrap:anywhere}
.gv-cd-person-sub{font-size:13px;line-height:1.4;color:${INK_SOFT};overflow-wrap:anywhere}
.gv-cd-state{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700}
`;

/** Plain-words state of a returned copy, with its colour. */
export const RETURN_STATE_WORDS: Record<string, string> = {
  submitted: 'Waiting for review',
  accepted: 'Accepted',
  sent_back: 'Sent back',
  not_yet: 'Not sent yet',
};
