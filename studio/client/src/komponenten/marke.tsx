// Marke EduOrga (design/MARKE.md): Monogramm und Wortmarke als eingebettetes SVG (Formen wie design/logo/edo-*.svg).
import type { CSSProperties } from 'react';

export const SLOGAN = 'Einfach mehr Schulalltag.';
export const RECHTLICHER_HINWEIS = 'EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, '
  + 'entwickelt mit Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst verantwortlich.';

/** Monogramm: Kachel in Primärfarbe mit weißem „E“ (invers: weiße Kachel mit Petrol-„E“, für dunkle Flächen). */
export function Monogramm({ groesse = 28, invers = false, style }: { groesse?: number; invers?: boolean; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" width={groesse} height={groesse} aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
      <rect width="64" height="64" rx="12" fill={invers ? '#ffffff' : '#164c55'} />
      <path d="M18 14h28v6H24v9h14v6H24v9h22v6H18z" fill={invers ? '#164c55' : '#ffffff'} />
      <rect x="41" y="29" width="6" height="6" fill={invers ? '#28747a' : '#7fc9c9'} />
    </svg>
  );
}
