// Gemeinsame Bausteine: Statuswort, Suchfeld, Filter-Auswahl, Dialog mit Aktionen, Kennzahl als Text, Datum für Listen, beschriftete Angabe.
// Keine Initialen-Avatare in Listen (nur das Kontomenü der Kopfleiste zeigt Initialen).
import { useState, type ReactNode } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Select,
  Stack, TextField, Typography, useMediaQuery, useTheme, type ChipProps, type SxProps,
} from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { fehler } from '../lib/meldungen';
import { ausIso, heuteIso, WOCHENTAGE_KURZ } from '../lib/datum';

export type Ton = 'entfall' | 'aenderung' | 'pruefung' | 'termin' | 'frei' | 'ok' | 'neutral' | 'primaer' | 'warnung';

/**
 * Kurzes Statuswort. Standard: nur Text in der Statusfarbe (12 px/500), ohne Fläche und Rahmen – Status wird über Textfarbe
 * gezeigt, nicht über bunte Pillen. „neutral“ ist Zweittext. „fest“ (sparsam, z. B. „Heute“) ist ein kleines gefülltes Schild.
 */
export function Plakette({ ton = 'neutral', children, fest = false, sx, title }: { ton?: Ton; children: ReactNode; fest?: boolean; sx?: SxProps; title?: string }) {
  const farbe = tonFarbe(ton);
  return (
    <Box component="span" title={title} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, verticalAlign: 'baseline', fontSize: 12.5, fontWeight: 500, lineHeight: '18px', whiteSpace: 'nowrap',
      color: fest ? 'background.paper' : farbe, ...(fest ? { bgcolor: farbe, px: 0.625, borderRadius: '3px' } : {}), '& svg': { fontSize: 14 }, ...sx }}>{children}</Box>
  );
}

/** Farbe eines Tons als Thema-Pfad (über CSS-Variablen, damit hell und dunkel stimmen). */
export const tonFarbe = (ton: Ton) => (ton === 'neutral' ? 'text.secondary' : ton === 'primaer' ? 'primary.main' : ton === 'warnung' ? 'status.pruefung.main' : `status.${ton}.main`);

export function SuchFeld({ wert, onWert, platzhalter = 'Suchen', breite = 260, autoFocus }: { wert: string; onWert: (s: string) => void; platzhalter?: string; breite?: number | string; autoFocus?: boolean }) {
  return (
    <TextField value={wert} onChange={e => onWert(e.target.value)} placeholder={platzhalter} aria-label={platzhalter} type="search" autoFocus={autoFocus}
      sx={{ width: breite, maxWidth: '100%' }}
      slotProps={{ input: {
        sx: { borderRadius: '6px', bgcolor: 'background.default' },
        startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment>,
        endAdornment: wert ? <InputAdornment position="end"><IconButton size="small" onClick={() => onWert('')} aria-label="Suche löschen"><CloseRounded fontSize="small" /></IconButton></InputAdornment> : null,
      } }} />
  );
}

/** Auswahlfeld mit Beschriftung. optionen: [wert, text]. */
export function Wahl<T extends string | number>({ label, wert, onWert, optionen, breite = 180, alle, deaktiviert, mehrfach }: {
  label: string; wert: T; onWert: (w: T) => void; optionen: [T, string][]; breite?: number | string; alle?: string; deaktiviert?: boolean; mehrfach?: false;
}) {
  return (
    <FormControl sx={{ width: breite, maxWidth: '100%' }} disabled={deaktiviert}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={wert as string | number} onChange={e => onWert(e.target.value as T)} MenuProps={{ slotProps: { paper: { sx: { maxHeight: 400 } } } }} multiple={mehrfach}>
        {alle !== undefined && <MenuItem value={'' as string}>{alle}</MenuItem>}
        {optionen.map(([w, t]) => <MenuItem key={String(w)} value={w as string | number}>{t}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

/**
 * Dialog mit Titel, Inhalt und Aktionen. aktion: Haupt-Knopf (async; Fehler als Hinweis, false = offen lassen).
 */
export function FormDialog({ offen, titel, untertitel, children, onClose, aktion, aktionText = 'Speichern', gefahr, links, breite = 'sm', deaktiviert, ohneAbbrechen, abbrechenText = 'Abbrechen', vollbildMobil = true }: {
  offen: boolean; titel: ReactNode; untertitel?: ReactNode; children: ReactNode; onClose: () => void; aktion?: () => Promise<boolean | void> | boolean | void; aktionText?: string;
  gefahr?: boolean; links?: ReactNode; breite?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; deaktiviert?: boolean; ohneAbbrechen?: boolean; abbrechenText?: string; vollbildMobil?: boolean;
}) {
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('sm'));
  const [laeuft, setLaeuft] = useState(false);
  const los = async () => {
    if (!aktion) return;
    setLaeuft(true);
    try { if ((await aktion()) !== false) onClose(); } catch (err) { fehler(err); } finally { setLaeuft(false); }
  };
  return (
    <Dialog open={offen} onClose={onClose} maxWidth={breite} fullWidth fullScreen={vollbildMobil && mobil}>
      <DialogTitle sx={{ pr: 6 }}>
        {titel}
        {untertitel && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{untertitel}</Typography>}
        <IconButton onClick={onClose} aria-label="Schließen" sx={{ position: 'absolute', right: 10, top: 10 }}><CloseRounded /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderBottom: aktion || links || !ohneAbbrechen ? undefined : 0 }}>{children}</DialogContent>
      {(aktion || links || !ohneAbbrechen) && (
        <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
          {links && <Box sx={{ mr: 'auto', display: 'flex', gap: 1 }}>{links}</Box>}
          {!ohneAbbrechen && <Button variant="outlined" onClick={onClose}>{aktion ? abbrechenText : 'Schließen'}</Button>}
          {aktion && <Button variant="contained" color={gefahr ? 'error' : 'primary'} onClick={los} disabled={laeuft || deaktiviert}>{aktionText}</Button>}
        </DialogActions>
      )}
    </Dialog>
  );
}

/** Kennzahl als Text („5 Lehrkräfte“) für Zusammenfassungen über Tabellen – keine Kacheln. Mit onClick als Filter; ton „primaer“ = gewählt. */
export function Kennzahl({ wert, text, ton = 'neutral', onClick, unter }: { wert: ReactNode; text: string; ton?: Ton; onClick?: () => void; unter?: ReactNode }) {
  const gewaehlt = ton === 'primaer';
  const farbe = ton === 'neutral' || gewaehlt || wert === 0 ? 'text.primary' : tonFarbe(ton);
  return (
    <Box component={onClick ? 'button' : 'span'} type={onClick ? 'button' : undefined} onClick={onClick}
      sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5, p: 0, border: 0, bgcolor: 'transparent', font: 'inherit', fontSize: 13, color: 'text.secondary', cursor: onClick ? 'pointer' : 'default',
        borderBottom: '2px solid', borderColor: gewaehlt ? 'secondary.main' : 'transparent', pb: '1px', '&:hover': onClick ? { color: 'text.primary' } : {} }}>
      <Box component="span" sx={{ fontWeight: 600, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{wert}</Box>{text}{unter}
    </Box>
  );
}

/** Zeile mit Kennzahlen (Text, durch Abstand getrennt). */
export function Kennzahlen({ children, sx }: { children: ReactNode; sx?: object }) {
  return <Stack direction="row" flexWrap="wrap" columnGap={2} rowGap={0.5} alignItems="baseline" sx={{ mb: 1.5, ...sx }}>{children}</Stack>;
}

/** Datum für Listen als schlichter Text („Mo 19.10.“), heute in der Akzentfarbe – keine Kalenderkachel. */
export function DatumKachel({ datum, klein }: { datum: string; klein?: boolean }) {
  const d = ausIso(datum);
  const heute = datum === heuteIso();
  return (
    <Box sx={{ width: klein ? 64 : 76, flex: 'none', fontSize: 13, lineHeight: '20px', fontVariantNumeric: 'tabular-nums', color: heute ? 'secondary.main' : 'text.secondary', fontWeight: heute ? 600 : 400 }}>
      {WOCHENTAGE_KURZ[(d.getDay() + 6) % 7]} {String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}.
    </Box>
  );
}

export function ChipListe({ werte, farbe, groesse = 'small' }: { werte: string[]; farbe?: ChipProps['color']; groesse?: 'small' | 'medium' }) {
  return <Stack direction="row" gap={0.5} flexWrap="wrap">{werte.map(w => <Chip key={w} label={w} size={groesse} color={farbe} variant="outlined" />)}</Stack>;
}

/** Beschriftete Angabe (Definitionsliste). */
export function Angabe({ titel, children, breite = 120 }: { titel: string; children: ReactNode; breite?: number }) {
  return (
    <Stack direction="row" gap={2} sx={{ py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: breite, flex: 'none' }}>{titel}</Typography>
      <Box sx={{ minWidth: 0, flex: 1, fontSize: 14 }}>{children}</Box>
    </Stack>
  );
}
