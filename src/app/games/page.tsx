import { pageMetadata } from '@/lib/seo';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';
import MunillionGame from './munillion/MunillionGame';
import { MUNILLION_CSS } from './munillion/styles';

export const metadata = pageMetadata({
  title: { absolute: 'MUNillion: The Daily MUN Game | Gavelling' },
  description:
    'Seven Model UN questions a day. Name a UN member, a committee, a clause, a resolution or a MUN conference: the rarer your answer, the more points you score.',
  path: '/games',
  // Its own share card (owner, 27 Nov 2026: WhatsApp showed no preview). Drawn from the pixel hall;
  // 1200x630 JPG under 300 KB so WhatsApp, iMessage and LinkedIn all show it.
  image: 'https://gavelling.com/games/munillion-og.jpg?v=1',
  imageAlt: 'MUNillion: a pixel UN General Assembly hall and a delegate raising a placard that reads The Gavel, +100 points',
  imageSize: { width: 1200, height: 630 },
});

// The game fills exactly one screen (owner, 26 Nov 2026); the top bar floats over the hall.
export default function GamesPage() {
  return (
    <div className="mn-page">
      <style dangerouslySetInnerHTML={{ __html: MUNILLION_CSS }} />
      <div className="mn-shell">
        <SiteNav overlay />
        <MunillionGame
          header={
            <header className="mn-title-row">
              <h1 className="mn-title mn-px">MUNillion</h1>
              <p className="mn-tagline mn-tx">
                <span className="mn-tag-long">Seven MUN questions a day. The rarer your answer, the bigger your placard grows</span>
                <span className="mn-tag-short">7 MUN questions a day. Rarer answers grow your placard</span>
              </p>
            </header>
          }
        />
      </div>
      <SiteFooter />
    </div>
  );
}
