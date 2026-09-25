// Renders premium guide Blocks. No 'use client' and no content of its own:
// the guide page renders the public teaser with it on the server, and
// PremiumBody renders the paywalled blocks with it in the browser after
// /api/guides/[slug] returned them. Everything is rendered as text nodes, so
// nothing in a guide source can inject markup.

import { Fragment } from 'react';
import { Check } from 'lucide-react';
import type { Block } from '@/lib/premiumGuides/types';

export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export default function GuideBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h2':
            return (
              <h2 key={i} id={b.id} className="gvg-h2">
                <InlineText text={b.text} />
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} id={b.id} className="gvg-h3">
                <InlineText text={b.text} />
              </h3>
            );
          case 'p':
            return (
              <p key={i} className="gvg-p">
                <InlineText text={b.text} />
              </p>
            );
          case 'ul':
          case 'ol': {
            const Tag = b.t;
            return (
              <Tag key={i} className={`gvg-list gvg-${b.t}`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <InlineText text={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          case 'check':
            return (
              <ul key={i} className="gvg-check">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <span className="gvg-box" aria-hidden="true">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span>
                      <InlineText text={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case 'note':
            return (
              <aside key={i} className="gvg-note">
                <InlineText text={b.text} />
              </aside>
            );
          case 'template':
            return (
              <figure key={i} className="gvg-template">
                {b.title ? <figcaption>{b.title}</figcaption> : null}
                <pre>{b.lines.join('\n')}</pre>
              </figure>
            );
          case 'table':
            return (
              <div key={i} className="gvg-table-wrap">
                <table className="gvg-table">
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} scope="col">
                          <InlineText text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k}>
                            <InlineText text={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
