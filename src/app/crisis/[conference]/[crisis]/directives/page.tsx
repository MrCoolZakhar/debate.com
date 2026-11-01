'use client';
import BackroomInbox from '../../../components/directives/BackroomInbox';
import ChairDirectivesPage from '../../../components/chair/ChairDirectivesPage';
import { useCrisis } from '../CrisisContext';

export default function Page() {
  const { role } = useCrisis();
  return role === 'chair' ? <ChairDirectivesPage /> : <BackroomInbox />;
}
