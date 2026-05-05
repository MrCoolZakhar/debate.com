import { getFlagUrl } from '@/lib/countries';
import { Emoji } from '@/components/Emoji';

interface FlagImgProps {
  code: string;
  size?: number;
  className?: string;
}

export function FlagImg({ code, size = 24, className = '' }: FlagImgProps) {
  if (!code) return <Emoji size={`${size}px`}>🌐</Emoji>;
  return (
    <img
      src={getFlagUrl(code)}
      alt={code}
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block' }}
      className={className}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
