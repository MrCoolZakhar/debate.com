import Link from 'next/link';
import type { Metadata } from 'next';
import BlogChrome from '@/components/blog/BlogChrome';
import { JSONLD_PUBLISHER, SITE_URL, pageMetadata } from '@/lib/seo';
import { listGuides } from '@/lib/premiumGuides';
import GuideCardGrid from './GuideCardGrid';

export const metadata: Metadata = pageMetadata({
  title: 'Premium MUN Guides',
  description:
    'In-depth Model UN playbooks for delegates, chairs and organisers: award-winning habits, chairing, sponsorship, growth, clauses and committee design.',
  path: '/guides',
  ogTitle: 'Premium MUN Guides: Gavelling',
});

export default function GuidesIndexPage() {
  const guides = listGuides();
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Premium MUN Guides',
    url: `${SITE_URL}/guides`,
    publisher: JSONLD_PUBLISHER,
    itemListElement: guides.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/guides/${g.slug}`, name: g.title })),
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: 'Premium guides', item: `${SITE_URL}/guides` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <BlogChrome>
        <div className="gvg-wrap">
          <nav className="gvg-crumbs" aria-label="Breadcrumb">
            <Link href="/blog">Blog</Link>
            <span aria-hidden="true">/</span>
            <span>Premium guides</span>
          </nav>
          <h1 className="gvg-h1" style={{ marginTop: 20 }}>Premium MUN Guides</h1>
          <p className="gvg-lead">
            Each guide is a complete playbook for one job at a conference. The opening sections are free to read. The
            rest comes with Gavelling Unlimited.
          </p>
          <GuideCardGrid guides={guides} headingLevel={2} />
          <p className="gvg-lead" style={{ fontSize: 16 }}>
            Looking for the free basics? The <Link href="/blog" style={{ color: '#1B3828', textDecoration: 'underline', fontWeight: 700 }}>MUN guides on the blog</Link> cover
            procedure, speeches, position papers and running a committee, and stay free.
          </p>
        </div>
      </BlogChrome>
    </>
  );
}
