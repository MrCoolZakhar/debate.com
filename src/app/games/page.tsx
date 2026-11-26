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
});

export default function GamesPage() {
  return (
    <div className="mn-page min-h-screen flex flex-col">
      <style dangerouslySetInnerHTML={{ __html: MUNILLION_CSS }} />
      <SiteNav />
      <main className="flex-1 w-full">
        <MunillionGame
          header={
            <header className="mn-title-row">
              <h1 className="mn-title mn-px">MUNillion</h1>
              <p className="mn-tagline mn-tx">Seven MUN questions a day. The rarer your answer, the higher your placard goes</p>
            </header>
          }
        />
      </main>
      <SiteFooter />
    </div>
  );
}
