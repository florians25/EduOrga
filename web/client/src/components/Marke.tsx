// Marke EduOrga (design/MARKE.md): Monogramm (Petrol-Kachel #164c55, weißes „E“, kleines helles Petrol-Quadrat am mittleren Balken),
// Zeichen (nur das „E“ in currentColor) und Wortmarke „EduOrga“ (Edu 600, Orga 400) mit Produktzusatz („Web“).
import { Box, Typography } from '@mui/material';

export const PRODUKT = 'EduOrga Web';
export const SLOGAN = 'Einfach mehr Schulalltag.';
/** Rechtlicher Hinweis (design/MARKE.md) für „Über EduOrga“ und Anmeldeseite. */
export const RECHTSHINWEIS = 'EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit '
  + 'Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst verantwortlich.';

/** Nur das „E“ (currentColor). */
export function Zeichen({ groesse = 28, farbe = 'currentColor' }: { groesse?: number; farbe?: string }) {
  return (
    <svg viewBox="12 10 40 44" width={groesse * 40 / 44} height={groesse} aria-hidden="true" focusable="false" style={{ color: farbe, flex: 'none' }}>
      <path d="M16 14h32v6H22v9h20v6H22v9h26v6H16z" fill="currentColor" />
    </svg>
  );
}

/** Monogramm: Kachel in der Primärfarbe (bzw. weiß auf dunklem Grund) mit „E“ und hellem Petrol-Quadrat. */
export function Monogramm({ groesse = 28, invers = false }: { groesse?: number; invers?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={groesse} height={groesse} aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
      <rect width="64" height="64" rx="12" fill={invers ? '#ffffff' : '#164c55'} />
      <path d="M18 14h28v6H24v9h14v6H24v9h22v6H18z" fill={invers ? '#164c55' : '#ffffff'} />
      <rect x="41" y="29" width="6" height="6" fill={invers ? '#28747a' : '#7fc9c9'} />
    </svg>
  );
}

export function Marke({ zusatz = 'Web', groesse = 28, hell = false }: { zusatz?: string; groesse?: number; hell?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} aria-label={zusatz ? `EduOrga ${zusatz}` : 'EduOrga'} role="img">
      <Box sx={{ borderRadius: `${groesse * 12 / 64}px`, boxShadow: hell ? '0 0 0 1px rgba(255,255,255,.22)' : 'none', display: 'flex' }}><Monogramm groesse={groesse} /></Box>
      <Typography component="span" aria-hidden sx={{ fontWeight: 600, fontSize: groesse * 0.66, lineHeight: 1, color: hell ? '#fff' : 'text.primary', letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>
        Edu<Box component="span" sx={{ fontWeight: 400 }}>Orga</Box>
        {zusatz && <Box component="span" sx={{ fontWeight: 400, color: hell ? 'rgba(255,255,255,.66)' : 'text.secondary', ml: 0.75 }}>{zusatz}</Box>}
      </Typography>
    </Box>
  );
}
