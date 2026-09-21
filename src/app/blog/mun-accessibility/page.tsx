import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, JSONLD_PUBLISHER } from '@/lib/seo';
import ArticleLayout from '@/components/blog/ArticleLayout';
import { authorJsonLd } from '@/components/blog/authors';
import { H2, Callout, ChairScript, FactCard, TableWrap } from '@/components/blog/prose';

export const metadata: Metadata = pageMetadata({
  title: 'Accessible MUN Conferences: A Practical Inclusion Guide for Organisers',
  description:
    'What to change so your conference is genuinely attendable: venue, documents, committee procedure, cost, and the access statement that increases attendance',
  path: '/blog/mun-accessibility',
  ogDescription: 'Venue, documents, procedure and cost: making a MUN conference genuinely attendable.',
  type: 'article',
});

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Accessible MUN Conferences: A Practical Inclusion Guide for Organisers',
  description: 'What to change so that your Model UN conference is genuinely attendable, from the venue to the dais.',
  url: 'https://gavelling.com/blog/mun-accessibility',
  datePublished: '2026-09-20',
  dateModified: '2026-09-20',
  author: authorJsonLd('peter'),
  publisher: JSONLD_PUBLISHER,
  image: 'https://gavelling.com/og-image.png',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://gavelling.com/blog/mun-accessibility' },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://gavelling.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://gavelling.com/blog' },
    { '@type': 'ListItem', position: 3, name: 'Accessible MUN Conferences', item: 'https://gavelling.com/blog/mun-accessibility' },
  ],
};

export default function Article() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <ArticleLayout
        slug="mun-accessibility"
        pitch="Gavelling puts the speakers list, the timer and every document on each delegate phone, so nobody has to read a projector from the back row."
      >
        <p>Most Model UN conferences are not inaccessible on purpose. They are inaccessible because nobody asked. The room with the step was booked because it was free, the schedule has no gaps because the programme was ambitious, and the background guides are scanned PDFs because that is what the chair had. Almost every fix in this guide is cheap, most of them are free, and several of them make the conference better for everybody who attends.</p>

        <p className="gv-note">This is practical guidance from how conferences are run, not legal advice. Accessibility duties for schools, universities and venues differ by country and by institution. Check your own school or university policy, your national law, and what your venue is contractually obliged to provide, and talk to a disability or student support office before you publish anything that promises a standard.</p>

        <H2>Ask before you promise anything</H2>
        <p>The whole of accessibility planning starts with one question asked early and answered privately. Put it on the registration form for delegates, chairs, staff and faculty advisors alike, phrased as an offer rather than a disclosure demand.</p>
        <FactCard title="The registration question that works">
          &quot;Is there anything we should know to make the conference work for you? This covers access needs, dietary requirements, medical conditions, and anything else. It is read only by the logistics team and it is not shared with chairs unless you ask us to.&quot;
        </FactCard>
        <p>Then act on it. The reason delegates stop answering these questions honestly is that they have answered them before and nothing happened. Assign one named person to read every response and own the follow-up, and reply to every substantive answer within a week, even if the reply is that you cannot do it. A conference that says &quot;our venue has no lift to the second floor, so we have moved your committee to the ground floor&quot; has been more useful than one that says nothing and hopes.</p>

        <H2>Physical access, and what to ask on the site visit</H2>
        <p>Walk the actual route a delegate takes, in the order they take it: street, entrance, registration, committee room, toilet, lunch, ceremony hall. Not the tour the venue gives you. Our <Link href="/blog/mun-conference-venue-logistics">venue logistics guide</Link> covers the rest of the site visit.</p>
        <ul className="gv-check">
          <li>Step-free route from the nearest drop-off point and from public transport, not just from the car park</li>
          <li>Lift capacity and location, plus what happens if it fails. Book ground-floor rooms for the committees you know need them</li>
          <li>Door widths and whether heavy fire doors are held open or need to be pushed</li>
          <li>Accessible toilets: how many, on which floors, and are they locked</li>
          <li>Committee rooms with removable chairs, so a wheelchair user takes a place at the table rather than a space at the end of it</li>
          <li>A seat near the door for anyone who may need to leave and return without crossing the room</li>
          <li>Lunch queues: seating that does not require standing with a tray, and a route through</li>
          <li>Lighting that can be dimmed for a screen and raised for note-taking, independently if possible</li>
        </ul>
        <p>Two details are missed almost every time. Registration desks are usually standing height, so put one section at seated height or have a staff member come round the front. And the ceremony hall is usually the one room with fixed tiered seating, so reserve step-free places at the front and tell recipients in advance how they will be brought forward.</p>

        <H2>Deaf and hard of hearing delegates</H2>
        <p>Committee rooms are acoustically hostile: hard surfaces, forty people, a placard tapping, an air conditioner. Start with the room. A carpeted room with soft furnishings is worth more than most technology you can buy.</p>
        <p>If your venue has a hearing loop, find out which rooms have one, test it, and put the committees that need it there. If it has none, a directional microphone routed to the room speakers helps everyone at the back, not only the delegate who asked. Live captioning is available through several services and through automatic captions in common video tools, and for a hybrid or online room it is close to free. For an in-person room, a laptop running speech-to-text on a table microphone, projected, is imperfect but far better than nothing, and useful to non-native speakers too.</p>
        <p>The things <Link href="/blog/how-to-chair-first-mun">a chair</Link> can do cost nothing and matter more than any of that.</p>
        <ul>
          <li>Repeat every motion, every vote result and every time setting, clearly, before moving on</li>
          <li>Face the room when speaking, and do not talk while writing on a board</li>
          <li>Require delegates to be recognised by name before speaking, so the room knows where to look</li>
          <li>Keep the speakers list, the current speaker and the timer visible on a screen, so procedure is readable rather than only audible</li>
          <li>Never rely on a spoken aside to one half of the room</li>
        </ul>
        <Callout>If you hire a sign language interpreter, brief them in advance with the topic, the country list and the procedural vocabulary. &quot;Moderated caucus&quot; and &quot;unfriendly amendment&quot; are not general-purpose phrases, and an interpreter who meets them cold will spend the first session inventing signs.</Callout>

        <H2>Blind and low vision delegates</H2>
        <p>The core issue is that MUN runs on documents that appear at short notice and a room that runs on visual cues. Both are solvable.</p>
        <p>Documents first. Require background guides as real text PDFs or documents, never scans or images of text, with proper headings and no text baked into pictures. That single rule makes every guide work with a screen reader. Ask chairs to publish working papers and draft resolutions in an accessible format during committee rather than photographs of a printed sheet, which is the usual failure and is unreadable to assistive technology. If your conference shares papers on screen, share the file too.</p>
        <p>Then the room. Ask the chair to read the speakers list aloud at each change rather than only displaying it, to announce vote results numerically, and to name delegates when recognising them. A delegate who cannot see the placards needs to be told who is in the room and who is speaking. If papers are being passed around during unmoderated caucus, make sure someone is passing them to everyone.</p>

        <H2>Neurodivergent delegates</H2>
        <p>Much of what autistic and ADHD delegates find hard about MUN is not the debate. It is the sensory load, the unpredictability, and the unmoderated caucus.</p>
        <ul>
          <li><strong>A quiet room.</strong> Signposted, open all day, no phones out loud, not the same room as the staff base. Say in the programme that it exists and that using it is normal.</li>
          <li><strong>A predictable schedule.</strong> <Link href="/blog/mun-conference-day-operations">Publish timings</Link> and stick to them. If a session overruns, say by how long. &quot;We will resume at 14:10&quot; is workable. &quot;Shortly&quot; is not.</li>
          <li><strong>Written procedure.</strong> Publish the rules of procedure in writing and keep a one-page version in every committee room, so nobody has to ask what is happening or guess from context.</li>
          <li><strong>Warn before change.</strong> A chair who says &quot;in two minutes we will move to voting procedure&quot; costs nothing and helps a lot of people.</li>
          <li><strong>The unmoderated caucus.</strong> This is the hardest twenty minutes of the day for many delegates: unstructured, loud, and socially demanding, with no rule about how to join a group.</li>
        </ul>
        <p>For unmoderated caucus, a chair can do three concrete things: announce what the time is for and what should exist at the end of it, suggest that blocs gather in named corners so a delegate can find a group without reading the room, and stay in the room and available rather than leaving. Our <Link href="/blog/unmoderated-caucus-guide">guide to running unmoderated caucus</Link> covers the procedural side; the inclusion side is mostly structure.</p>

        <H2>First speeches, anxiety and the cost of speaking</H2>
        <p>Lowering the cost of a first speech benefits the quiet half of every committee. The mechanisms are procedural.</p>
        <ul>
          <li>Open with a round where every delegation speaks briefly in a fixed order, so the first speech is expected rather than volunteered</li>
          <li>Tell delegates the speaking time before they stand, and keep a visible clock so they can see it</li>
          <li>Let delegates read from notes. Say so out loud. Plenty of delegates believe reading is penalised</li>
          <li>Never call on someone who has not put themselves on the list</li>
          <li>Take a written question or a submitted point as a valid way to contribute</li>
        </ul>
        <ChairScript>&quot;Before we begin the general speakers list, a note. Every delegate here is welcome to read from prepared notes. Speaking time is ninety seconds and the clock is on the screen. If you would like to be added to the list, raise your placard now or message the dais at any time.&quot;</ChairScript>

        <H2>Language and speaking speed</H2>
        <p>At most international conferences, a large share of the room is debating in a second or third language, at speed, in a register full of jargon. That is an access issue even though it is rarely filed as one.</p>
        <p>Ask chairs to say this in the first session, and to mean it: speak at a pace the room can follow, procedural terms will be explained when used, and a delegate may ask the dais to repeat anything at any time without it counting against them. Ask chairs to avoid idioms and to slow down for numbers and dates, which are the hardest things to catch in a second language. And publish the procedure in writing, because reading it is far easier than hearing it.</p>
        <Callout>Fast, idiomatic, reference-heavy speaking is often rewarded as skill. It is frequently just exclusion with good diction. A chair who judges substance over fluency gets better committees and fairer awards.</Callout>

        <H2>Cost, and financial aid that is easy to ask for</H2>
        <p>Money is the access barrier that removes the most delegates, and the application process is usually the thing that removes them, not the decision. Three rules make a real difference.</p>
        <ul>
          <li><strong>Publish the total cost</strong>, including socials, materials and any deposit, on the same page as the fee. A delegate cannot ask their family for a number they do not have.</li>
          <li><strong>Make aid a tick box on the ordinary form</strong>, not a separate application with an essay and a reference. The essay is what stops people applying.</li>
          <li><strong>Decide before the payment deadline</strong>, and say when. Nobody should be asked to pay while waiting to hear whether they must.</li>
        </ul>
        <p>Keep applications confidential from chairs, and make sure an aided delegate is indistinguishable from everyone else on the day: same badge, same materials, same socials. If your funding is limited, partial waivers spread across more delegates usually widen the room more than a small number of full ones, though full waivers matter for travel. The same logic applies to travel bursaries, which are what actually decide whether a school an hour away can send a team.</p>

        <H2>Dress code, dietary needs and the other quiet exclusions</H2>
        <p>Write the dress code down and write it in terms of garments and formality, never in terms of gender. &quot;Business attire: a suit or blazer with trousers or a skirt, a shirt or blouse, closed shoes. National dress and religious dress are welcome and count as formal wear.&quot; That sentence prevents almost every dress code dispute, because it removes the enforcer&apos;s discretion. Tell staff that they enforce the written rule and nothing else, and that nobody is turned away at the door over clothing without a senior member of the secretariat present. Our <Link href="/blog/mun-conference-preparation">preparation guide</Link> is where delegates will look for what to bring, so keep the two consistent.</p>
        <p>Dietary and medical requirements should be collected once, at registration, and passed to catering as a count rather than a list of names. Label every dish at the buffet with its allergens. Keep the vegetarian and halal options in the same quantity and the same queue as everything else, and do not put them at the end, where they run out. If a delegate has told you about a medical condition, make sure the first aid point knows the plan, as part of your <Link href="/blog/mun-safeguarding">safeguarding</Link> arrangements, and that their faculty advisor knows who to find.</p>

        <H2>Your own website, documents and software</H2>
        <p>Almost every conference produces its own digital estate: a site, a registration form, a handbook, a set of guides. Four checks cover most of it. Real text rather than images of text. Colour contrast high enough to read on a phone in daylight. Every form field with a visible label. Everything usable with a keyboard alone. If your handbook is a beautifully designed PDF that a screen reader reads as one block of nonsense, publish a plain web version alongside it.</p>
        <p>In committee, the single most useful accessibility measure is that procedure lives somewhere a delegate can read at their own pace rather than only in the air of the room. A shared screen showing the speakers list and the clock helps a deaf delegate, a delegate at the back, a delegate whose English is their third language, and a delegate who has lost track. Gavelling does this on each delegate&apos;s own phone: the speakers list, the current speaker, the timer and the documents, updating live, which removes the need to read a projector from twelve metres away. It is free for sessions, and you can <Link href="/create">open a practice session</Link> and test it with a screen reader and at whatever text size you like before you commit to it.</p>

        <H2>Write an access statement and publish it</H2>
        <p>An access statement is a short public page that says what your venue and conference actually offer. It is not a promise to be perfect. It is information, and it is what lets a delegate or an advisor decide whether to come without having to write an awkward email first.</p>
        <TableWrap>
          <table>
            <thead><tr><th>Section</th><th>What to write</th></tr></thead>
            <tbody>
              <tr><td>Getting here</td><td>Step-free routes, nearest accessible station, drop-off point, parking</td></tr>
              <tr><td>The building</td><td>Lifts, accessible toilets by floor, step-free committee rooms, quiet room location</td></tr>
              <tr><td>In committee</td><td>Screen-based speakers list and timer, written procedure, document formats, speaking time</td></tr>
              <tr><td>Food</td><td>Allergen labelling, dietary options, whether needs are collected in advance</td></tr>
              <tr><td>Support</td><td>Named contact, email address, deadline for requests, what can be arranged on the day</td></tr>
              <tr><td>What we cannot do</td><td>Stated plainly. This is the most useful section on the page</td></tr>
            </tbody>
          </table>
        </TableWrap>
        <p>Conferences worry that publishing limitations will lose them delegates. In practice the opposite happens: a delegate who can see that the building has a lift, a quiet room and a named contact registers. A delegate who can see nothing assumes the worst and does not. If you are browsing <Link href="/conferences/explore">conferences to attend</Link>, an access statement is one of the fastest ways to tell how carefully a conference has been organised in general, which tells you something about the rest of the weekend too.</p>
        <p>Finally, ask afterwards. Add two questions to the post-conference survey: was there anything that made it harder for you to take part, and was there anything we did that helped. Both answers are specific, both are free, and both are more accurate than anything you will work out from a floor plan.</p>
      </ArticleLayout>
    </>
  );
}
