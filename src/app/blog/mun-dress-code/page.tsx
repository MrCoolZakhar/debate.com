import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { H2, Callout, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'What to Wear to Model UN: The Dress Code, Explained Plainly',
  description:
    'What Western business attire actually means, a workable outfit on a student budget, the shoe mistake everyone makes once, and what chairs really notice.',
  path: '/blog/mun-dress-code',
  ogDescription: 'Western business attire, explained plainly, on a student budget.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'What to Wear to Model UN: The Dress Code, Explained Plainly',
  description: 'What western business attire means in practice, on a student budget, with the things chairs notice.',
  url: 'https://gavelling.com/blog/mun-dress-code',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: { '@type': 'Organization', name: 'Gavelling', url: 'https://gavelling.com' },
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-dress-code' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'MUN Dress Code', item: 'https://gavelling.com/blog/mun-dress-code' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-dress-code"
        pitch="Worry about the speech, not the blazer. Run a free practice session with your club and get the first committee out of the way before the real one."
      >
        <p>Nobody has ever won <Link href="/blog/mun-awards-guide">Best Delegate</Link> because of a jacket. Plenty of delegates have spent <Link href="/blog/mun-for-beginners">their first conference</Link> quietly anxious about clothes instead of thinking about their country, which is a waste of a weekend. Here is what the dress code actually requires, what it does not, and what it costs. If you are still working out <Link href="/blog/what-is-model-un">what Model UN is</Link>, start there.</p>

        <H2>What &quot;Western business attire&quot; means in practice</H2>
        <p>The phrase in your conference handbook sounds more demanding than it is. It means office formal: the clothes an adult would wear to a job interview at a bank or a government department. Nothing more specific than that.</p>
        <p>In practice the room will be full of dark blazers, plain shirts, tailored trousers or a knee-length skirt, and closed shoes. That is the whole convention.</p>
        <p>It does not require a suit that matches. It does not require a tie. It does not require expensive fabric, a new purchase, or the same colour as anyone else. It does not require heels, and it never has. A conference that tells you otherwise has written its own stricter rule and should say so in writing.</p>
        <Callout>The test is not &quot;does this look expensive&quot;. It is &quot;does this look deliberate&quot;. A clean, pressed, well-fitting outfit from a charity shop reads better from the dais than an ill-fitting new suit with the label still in the sleeve.</Callout>

        <H2>A workable outfit, on a budget</H2>
        <p>Almost every student can build a passable committee outfit from what is already in the house plus one borrowed item. Work through it in this order.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Item</th><th>What works</th><th>What to skip</th></tr></thead>
            <tbody>
              <tr><td>Top layer</td><td>Any plain dark blazer or suit jacket. Navy, black, grey or charcoal</td><td>Buying one to match trousers you already own</td></tr>
              <tr><td>Shirt or blouse</td><td>Plain white or light blue, ironed, tucked in</td><td>Loud patterns, logos, anything sheer</td></tr>
              <tr><td>Legs</td><td>Tailored trousers or a knee-length skirt in a dark neutral</td><td>Jeans of any colour, chinos in bright shades, anything with visible casual stitching</td></tr>
              <tr><td>Shoes</td><td>Closed, dark, comfortable, already worn in</td><td>New shoes. See below</td></tr>
              <tr><td>Optional</td><td>A tie, a plain jumper over the shirt on a cold day, a simple watch</td><td>Anything you have to keep adjusting</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>School uniform, if yours includes a blazer, is usually acceptable and is what many delegations wear. Ask your faculty advisor rather than assuming either way. A plain dark jumper over a shirt is fine in any committee that is not the closing ceremony. And the jacket can come off once you are seated and the room has warmed up, because it will.</p>
        <p>One word on fit, which is the only part that costs nothing and changes everything: sleeves that end at the wrist bone and trousers that end at the shoe. If a borrowed blazer is close but long in the sleeve, a safety pin in the lining takes two minutes and is invisible from a metre away.</p>

        <H2>Shoes: the mistake everyone makes once</H2>
        <p>A conference day is six to nine hours, and you spend more of it on your feet than you expect: registration, corridors, lunch queues, unmoderated caucus standing in a corner arguing about a preambulatory clause, then a ceremony. Delegates who buy shoes the week before spend Sunday in pain and sit down through the caucus, which is how delegates stop being part of a bloc.</p>
        <ul className="gv-check">
          <li>Wear shoes you have already walked in for a full day</li>
          <li>If they are new, break them in over at least a week before the conference</li>
          <li>Pack plasters. Everyone who has done this twice packs plasters</li>
          <li>Flat and comfortable is entirely acceptable, in every committee, for everyone</li>
          <li>If you wear heels, bring a flat second pair and use them during unmoderated caucus</li>
        </ul>

        <H2>What is not acceptable at most conferences</H2>
        <p>Stated plainly, without moralising, because the list is short and the reason is the same for all of it: the simulation asks everyone to look like a delegation rather than like themselves on a Saturday.</p>
        <ul>
          <li>Jeans, shorts, leggings as trousers, tracksuits, sportswear</li>
          <li>Trainers, sandals, flip-flops and, in most handbooks, open-toe shoes</li>
          <li>T-shirts, hoodies, anything with a visible logo or slogan</li>
          <li>Hats and caps indoors, other than religious head coverings, which are always fine</li>
          <li>Very short hemlines or anything a handbook would call revealing, though see the note below</li>
        </ul>
        <p>The last line is where dress codes go wrong. A good handbook writes rules about garments, not about bodies, and applies them identically to everyone. If your conference&apos;s rule is vague, the safe reading is knee-length or longer and shoulders covered by a jacket. If a member of staff tries to enforce something that is not written down, you are entitled to ask to see the written rule, politely, and to ask for your faculty advisor.</p>

        <H2>National dress and religious dress</H2>
        <p>National and cultural dress is formal wear. Nearly every conference handbook says so explicitly, and the ones that do not still mean it. If you would wear it to a formal occasion at home, it belongs in committee, and it tends to be the best-dressed thing in the room.</p>
        <p>Religious dress, including head coverings, is never in question and needs no permission or explanation. A hijab, a turban, a kippah, a cross or a kara are all simply part of what you wear. If anything in a handbook appears to conflict, that is a drafting error in the handbook and the secretariat will say so if asked.</p>

        <H2>Gender-neutral guidance</H2>
        <p>Older MUN handbooks split the dress code into two lists by gender, which produced rules about skirt length and heels that nobody could justify. Many conferences have now moved to a single list of acceptable garments that anyone may choose from. That is the sensible version, and if your conference still uses gendered lists, the practical reading is that you may follow whichever list you like.</p>
        <FactCard title="The single-list version">
          Business formal, any combination: blazer or suit jacket, shirt or blouse, tailored trousers or a skirt or a dress at or below the knee, closed shoes. National and religious dress count as formal wear. No jeans, sportswear, trainers, slogans or hats indoors.
        </FactCard>

        <H2>Socials, crisis committees and online conferences</H2>
        <p>A weekend usually has more than one dress code, and the handbook is the only reliable source for yours.</p>
        <ul>
          <li><strong>Socials and the delegate dance.</strong> Usually smart casual or a stated theme. Pack one separate outfit and shoes you can stand in. Do not wear your committee shoes to a dance.</li>
          <li><strong>Crisis and cabinet committees.</strong> Normally the same business attire. Some historical or cabinet committees invite period or in-character dress. That invitation comes from the dais in writing, and in its absence, wear the ordinary code.</li>
          <li><strong>Online conferences.</strong> Business attire from the waist up, genuinely. Cameras usually stay on all session, and what a chair notices most is the background and the lighting: a plain wall, a light source in front of you rather than behind, and the camera at eye level. Our <Link href="/blog/mun-online-committees">guide to online committees</Link> covers the rest of the setup.</li>
          <li><strong>The closing ceremony.</strong> Full committee dress, jacket on, even if the last session was relaxed. It is the photograph.</li>
        </ul>

        <H2>What to actually carry into committee</H2>
        <p>Pockets and a small folder, not a rucksack, and not a handbag you have to guard during unmoderated caucus.</p>
        <ul className="gv-check">
          <li>Your placard, which you will be given, and which you should write your country on if it is blank</li>
          <li>Two pens and a small notepad. Pens vanish</li>
          <li>Your position paper and a printed page of your key facts, because screens get confiscated in some committees and go flat in others</li>
          <li>A phone plus a charger or power bank if the committee runs on software</li>
          <li>A water bottle. Speaking dries you out faster than you expect</li>
          <li>Plasters, a hair tie, a spare collar stay, and anything else you would be annoyed to need and not have</li>
        </ul>
        <p>Then stop thinking about it. Once you are seated and recognised for the first time, nobody in the room is looking at your clothes, including the chair. They are listening to whether you <Link href="/blog/mun-country-research">know your country&apos;s position</Link>, which is the part worth the preparation time. Our <Link href="/blog/mun-conference-preparation">pre-conference checklist</Link> covers the week before, and <Link href="/blog/mun-public-speaking-tips">the speaking guide</Link> covers the part that actually gets noticed.</p>
      </ArticleLayout>
    </>
  );
}
