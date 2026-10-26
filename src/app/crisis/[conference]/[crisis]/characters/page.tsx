'use client';
// Delegates get their own Cabinet page (their cabinet, plus as much of the others as the director allows).
// Staff, chair and press keep the Characters page.
import CabinetPage from '../../../components/cabinet/CabinetPage';
import CharactersPage from '../../../components/command/CharactersPage';
import { useCrisis } from '../CrisisContext';

export default function Page() {
  const v = useCrisis();
  return v.role === 'delegate' ? <CabinetPage /> : <CharactersPage />;
}
