// Gemeinsame Bausteine: Statusplakette, Suchfeld, Filter-Auswahl, Dialog mit Aktionen, Kennzahl, Datums-Kachel, Avatar mit Initialen.
import { useState, type ReactNode } from 'react';
import {
  alpha, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select,
  Stack, TextField, Typography, useMediaQuery, useTheme, type ChipProps, type SxProps,
} from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { fehler } from '../lib/meldungen';
import { ausIso, heuteIso, WOCHENTAGE_KURZ, MONATE } from '../lib/datum';

export type Ton = 'entfall' | 'aenderung' | 'pruefung' | 'termin' | 'frei' | 'ok' | 'neutral' | 'primaer' | 'warnung';

/** Kleine Plakette in der Statusfarbe (hell hinterlegt). */
export function Plakette({ ton = 'neutral', children, fest = false, sx, title }: { ton?: Ton; children: ReactNode; fest?: boolean; sx?: SxProps; title?: string }) {
  const t = useTheme();
  const farbe = ton === 'neutral' ? t.palette.text.secondary : ton === 'primaer' ? t.palette.primary.main : ton === 'warnung' ? t.palette.status.pruefung.main : t.palette.status[ton].main;
  return (
    <Box component="span" title={title} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 22, px: 1, borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
      color: fest ? '#fff' : farbe, bgcolor: fest ? farbe : alpha(farbe, ton === 'neutral' ? 0.1 : 0.12), ...sx }}>{children}</Box>
  );
}

export function SuchFeld({ wert, onWert, platzhalter = 'Suchen', breite = 260, autoFocus }: { wert: string; onWert: (s: string) => void; platzhalter?: string; breite?: number | string; autoFocus?: boolean }) {
  return (
    <TextField value={wert} onChange={e => onWert(e.target.value)} placeholder={platzhalter} aria-label={platzhalter} type="search" autoFocus={autoFocus}
      sx={{ width: breite, maxWidth: '100%' }}
      slotProps={{ input: {
        sx: { borderRadius: 999, bgcolor: 'background.default' },
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

/** Kennzahl (Übersichten). */
export function Kennzahl({ wert, text, ton = 'primaer', onClick, unter }: { wert: ReactNode; text: string; ton?: Ton; onClick?: () => void; unter?: ReactNode }) {
  const t = useTheme();
  const farbe = ton === 'neutral' ? t.palette.text.primary : ton === 'primaer' ? t.palette.primary.main : ton === 'warnung' ? t.palette.status.pruefung.main : t.palette.status[ton].main;
  return (
    <Paper variant="outlined" onClick={onClick} sx={{ p: 2, borderRadius: 3.5, cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .12s', '&:hover': onClick ? { boxShadow: '0 4px 14px rgba(21,26,33,.08)' } : {} }}>
      <Typography sx={{ fontSize: 28, fontWeight: 600, color: farbe, lineHeight: 1.1 }}>{wert}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{text}</Typography>
      {unter}
    </Paper>
  );
}

/** Datum als Kachel (Wochentag, Tag, Monat) für Listen. */
export function DatumKachel({ datum, klein }: { datum: string; klein?: boolean }) {
  const d = ausIso(datum);
  const heute = datum === heuteIso();
  return (
    <Box sx={{ width: klein ? 44 : 52, flex: 'none', textAlign: 'center', borderRadius: 2.5, py: 0.5, bgcolor: heute ? 'primary.main' : 'action.hover', color: heute ? 'primary.contrastText' : 'text.primary' }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8, lineHeight: 1.2 }}>{WOCHENTAGE_KURZ[(d.getDay() + 6) % 7]}</Typography>
      <Typography sx={{ fontSize: klein ? 16 : 19, fontWeight: 600, lineHeight: 1.1 }}>{d.getDate()}</Typography>
      <Typography sx={{ fontSize: 10.5, opacity: 0.8, lineHeight: 1.2 }}>{MONATE[d.getMonth()].slice(0, 3)}</Typography>
    </Box>
  );
}

const AVATAR_FARBEN = ['#dce6f6', '#dff0e8', '#f6e8da', '#e9e1f6', '#f6e0e6', '#dcedf0', '#efedd8'];
export function NamensAvatar({ name, id = 0, groesse = 32 }: { name: string; id?: number; groesse?: number }) {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  const ini = (teile.length > 1 ? teile[0][0] + teile[teile.length - 1][0] : (teile[0] ?? '?').slice(0, 2)).toUpperCase();
  return <Avatar sx={{ width: groesse, height: groesse, fontSize: groesse * 0.38, fontWeight: 600, bgcolor: AVATAR_FARBEN[Math.abs(id) % AVATAR_FARBEN.length], color: 'grey.800' }}>{ini}</Avatar>;
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
