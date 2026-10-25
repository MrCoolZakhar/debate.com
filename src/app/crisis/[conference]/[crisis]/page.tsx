'use client';
// The crisis home: each role lands on its own page.
import { useCrisis } from './CrisisContext';
import CommandPage from '../../components/command/CommandPage';
import BackroomInbox from '../../components/directives/BackroomInbox';
import DelegateHome from '../../components/delegate/DelegateHome';
import ChairHome from '../../components/chair/ChairHome';
import NewsPage from '../../components/news/NewsPage';

export default function CrisisHomePage() {
  const { role } = useCrisis();
  if (role === 'director' || role === 'assistant_director' || role === 'organiser') return <CommandPage />;
  if (role === 'backroomer') return <BackroomInbox />;
  if (role === 'chair') return <ChairHome />;
  if (role === 'press') return <NewsPage />;
  return <DelegateHome />;
}
