'use client';
import BackroomInbox from '../../../components/directives/BackroomInbox';
import ChairDirectivesPage from '../../../components/chair/ChairDirectivesPage';
import MyDirectivesPage from '../../../components/delegate/MyDirectivesPage';
import { useCrisis } from '../CrisisContext';

export default function Page() {
  const { role } = useCrisis();
  if (role === 'chair') return <ChairDirectivesPage />;
  if (role === 'delegate') return <MyDirectivesPage />;
  return <BackroomInbox />;
}
