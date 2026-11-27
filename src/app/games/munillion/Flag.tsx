// A small rectangular flag beside an answer that is a country or belongs to one (owner, 28 Nov 2026):
// a president, a Middle East country, a conference's host country. Rectangles use getFlagUrl (CLAUDE.md §8.10).
import { getCountryByName, getFlagUrl } from '@/lib/countries';

export default function CountryFlag({ country, size = 20 }: { country: string | null | undefined; size?: number }) {
  const code = country ? getCountryByName(country)?.code : undefined;
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="mn-flag" src={getFlagUrl(code)} alt={country ?? ''} width={size} height={size} loading="lazy" decoding="async" />
  );
}
