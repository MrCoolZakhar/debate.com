import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, Lock, LockOpen } from 'lucide-react';
import BlogChrome from '@/components/blog/BlogChrome';
import GuideBlocks from '@/components/premiumGuides/GuideBlocks';
import GuideIcon from '@/components/premiumGuides/GuideIcon';
import PremiumBody from '@/components/premiumGuides/PremiumBody';
import { JSONLD_PUBLISHER, OG_IMAGE_URL, SITE_URL, pageMetadata } from '@/lib/seo';
import { getGuide, listGuides } from '@/lib/premiumGuides';
import GuideCard from '../GuideCard';

// A premium guide. The server renders the title, the description, the full
// table of contents and the public teaser (real text, for search); the rest is
// fetched by PremiumBody from /api/guides/<slug> for readers on Unlimited and
// is never in this page's HTML. The JSON-LD marks the article as not free and
// points Google's paywalled-content markup at `.premium-body`.

export const dynamicParams = false;

export function generateStaticParams() {
  return listGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return pageMetadata({
    title: guide.meta.title,
    description: guide.meta.description,
    path: `/guides/${slug}`,
    type: 'article',
  });
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const { meta, teaser } = guide;
  const url = `${SITE_URL}/guides/${slug}`;
  const locked = meta.toc.filter((t) => !t.free);
  const others = listGuides().filter((g) => g.slug !== slug);

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    url,
    mainEntityOfPage: url,
    image: OG_IMAGE_URL,
    datePublished: meta.updated,
    dateModified: meta.updated,
    wordCount: meta.words,
    inLanguage: 'en-GB',
    ...(meta.authors.length
      ? { author: meta.authors.map((a) => ({ '@type': 'Person', name: a.name })) }
      : { author: JSONLD_PUBLISHER }),
    publisher: JSONLD_PUBLISHER,
    isAccessibleForFree: false,
    hasPart: {
      '@type': 'WebPageElement',
      isAccessibleForFree: false,
      cssSelector: '.premium-body',
    },
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: 'Premium guides', item: `${SITE_URL}/guides` },
      { '@type': 'ListItem', position: 4, name: meta.title, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <BlogChrome>
        <div className="gvg-wrap">
          <nav className="gvg-crumbs" aria-label="Breadcrumb">
            <Link href="/blog">Blog</Link>
            <span aria-hidden="true">/</span>
            <Link href="/guides">Premium guides</Link>
          </nav>

          <header>
            <p className="gvg-eyebrow">
              <GuideIcon name={meta.icon} size={18} />
              Premium guide for {meta.audience.toLowerCase()}
            </p>
            <h1 className="gvg-h1">{meta.title}</h1>
            <p className="gvg-lead">{meta.description}</p>
            <div className="gvg-meta">
              <span><Clock size={16} strokeWidth={2.2} aria-hidden="true" />{meta.readingMinutes} min read</span>
              <span><Lock size={16} strokeWidth={2.2} aria-hidden="true" /><strong>Included with Unlimited</strong></span>
              <span>Updated {formatDate(meta.updated)}</span>
              {/* Contributor credits appear only when the owner supplies real ones. */}
              {meta.authors.length > 0 ? (
                <span>By {meta.authors.map((a) => (a.credential ? `${a.name}, ${a.credential}` : a.name)).join('; ')}</span>
              ) : null}
            </div>
          </header>

          <div className="gvg-layout">
            <aside className="gvg-aside" aria-label="In this guide">
              <nav className="gvg-toc">
                <p className="gvg-toc-title">In this guide</p>
                <ol>
                  {meta.toc.map((t) => (
                    <li key={t.id}>
                      {t.free ? (
                        <LockOpen size={15} strokeWidth={2.2} aria-hidden="true" />
                      ) : (
                        <Lock size={15} strokeWidth={2.2} aria-hidden="true" />
                      )}
                      {t.free ? (
                        <a href={`#${t.id}`}>{t.text}</a>
                      ) : (
                        <span className="gvg-locked">
                          {t.text}
                          <span className="sr-only"> (included with Unlimited)</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <article className="gvg-article">
              <GuideBlocks blocks={teaser} />
              <PremiumBody slug={slug} title={meta.title} lockedSections={locked.map((t) => t.text)} />
            </article>
          </div>

          <section className="gvg-more" aria-labelledby="gvg-more-title">
            <h2 id="gvg-more-title">More premium guides</h2>
            <div className="gvg-cards">
              {others.map((g) => (
                <GuideCard key={g.slug} guide={g} />
              ))}
            </div>
          </section>
        </div>
      </BlogChrome>
    </>
  );
}
