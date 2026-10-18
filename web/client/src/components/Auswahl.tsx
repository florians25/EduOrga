// Gemeinsame Auswahl-Bausteine: Element (Klasse/Lehrkraft/Raum) mit Vor/Zurück, Woche bzw. Tag mit Kalender, Datumsfeld.
import { useState } from 'react';
import { Autocomplete, Box, Button, IconButton, Popover, Stack, TextField, Tooltip, Typography } from '@mui/material';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import type { Element } from '../api/types';
import { datumDe, heuteIso, kalenderwoche, montag, plusTage, wochenText, wochentagKurz } from '../lib/datum';

export function ElementWahl({ liste, wert, onWahl, platzhalter, info, breite = 280, blaettern = true }: {
  liste: Element[]; wert: string | null; onWahl: (kurz: string) => void; platzhalter: string; info?: (e: Element) => string; breite?: number; blaettern?: boolean;
}) {
  const pos = liste.findIndex(x => x.kurz.toLowerCase() === (wert ?? '').toLowerCase());
  const aktuell = pos >= 0 ? liste[pos] : null;
  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {blaettern && <Tooltip title="Vorheriges Element (Alt+←)"><span><IconButton size="small" disabled={pos <= 0} onClick={() => onWahl(liste[pos - 1].kurz)} aria-label="Vorheriges Element"><ChevronLeftRounded /></IconButton></span></Tooltip>}
      <Autocomplete
        options={liste} value={aktuell} onChange={(_, v) => v && onWahl(v.kurz)} disableClearable={!!aktuell as true}
        getOptionLabel={o => o.kurz} isOptionEqualToValue={(a, b) => a.kurz === b.kurz}
        filterOptions={(o, s) => { const q = s.inputValue.toLowerCase(); return o.filter(x => x.kurz.toLowerCase().includes(q) || (x.name || '').toLowerCase().includes(q)); }}
        renderOption={(props, o) => {
          const { key, ...rest } = props as typeof props & { key: string };
          const zusatz = info ? info(o) : o.name !== o.kurz ? o.name : '';
          return <Box component="li" key={key} {...rest} sx={{ gap: 1.5 }}><Typography sx={{ fontWeight: 600, minWidth: 56 }}>{o.kurz}</Typography><Typography variant="body2" color="text.secondary" noWrap>{zusatz}</Typography></Box>;
        }}
        renderInput={p => <TextField {...p} placeholder={platzhalter} aria-label={platzhalter}
          slotProps={{ ...p.slotProps, input: { ...p.InputProps, sx: { borderRadius: 999, fontWeight: 600 }, endAdornment: <>{aktuell && info?.(aktuell) ? <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 140, mr: 0.5 }}>{info(aktuell)}</Typography> : null}{p.InputProps.endAdornment}</> } }} />}
        sx={{ width: breite }} slotProps={{ listbox: { sx: { maxHeight: 360 } } }} noOptionsText="Keine Treffer"
      />
      {blaettern && <Tooltip title="Nächstes Element (Alt+→)"><span><IconButton size="small" disabled={pos < 0 || pos >= liste.length - 1} onClick={() => onWahl(liste[pos + 1].kurz)} aria-label="Nächstes Element"><ChevronRightRounded /></IconButton></span></Tooltip>}
    </Stack>
  );
}

/** Woche (Montag) bzw. Tag wählen: Pfeile, Zeitraum mit Kalender, „Heute“. */
export function ZeitNavi({ datum, onDatum, art = 'woche', tage = 5 }: { datum: string; onDatum: (d: string) => void; art?: 'woche' | 'tag'; tage?: number }) {
  const [anker, setAnker] = useState<HTMLElement | null>(null);
  const mo = montag(datum);
  const schritt = art === 'woche' ? 7 : 1;
  const basis = art === 'woche' ? mo : datum;
  const tagWeiter = (n: number) => {
    let d = plusTage(datum, n);
    // Wochenende überspringen (Tagesansicht)
    while (tage <= 5 && [5, 6].includes((new Date(d + 'T12:00').getDay() + 6) % 7)) d = plusTage(d, n > 0 ? 1 : -1);
    return d;
  };
  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Tooltip title={art === 'woche' ? 'Vorherige Woche' : 'Vorheriger Tag'}><IconButton size="small" onClick={() => onDatum(art === 'woche' ? plusTage(basis, -schritt) : tagWeiter(-1))} aria-label={art === 'woche' ? 'Vorherige Woche' : 'Vorheriger Tag'}><ChevronLeftRounded /></IconButton></Tooltip>
      <Button variant="outlined" onClick={e => setAnker(e.currentTarget)} startIcon={<CalendarTodayOutlined sx={{ fontSize: '16px !important' }} />} aria-haspopup="dialog"
        sx={{ fontWeight: 600, gap: 0.5, whiteSpace: 'nowrap' }}>
        {art === 'woche' ? <><Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, mr: 0.75 }}>KW {kalenderwoche(mo)}</Box>{wochenText(mo, tage)}</>
          : <><Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, mr: 0.75 }}>{wochentagKurz(datum)}</Box>{datumDe(datum)}</>}
      </Button>
      <Tooltip title={art === 'woche' ? 'Nächste Woche' : 'Nächster Tag'}><IconButton size="small" onClick={() => onDatum(art === 'woche' ? plusTage(basis, schritt) : tagWeiter(1))} aria-label={art === 'woche' ? 'Nächste Woche' : 'Nächster Tag'}><ChevronRightRounded /></IconButton></Tooltip>
      <Button variant="outlined" size="small" onClick={() => onDatum(heuteIso())} sx={{ ml: 0.5 }}>Heute</Button>
      <Popover open={!!anker} anchorEl={anker} onClose={() => setAnker(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { borderRadius: 3, mt: 1 } } }}>
        <DateCalendar value={dayjs(datum)} onChange={(v: Dayjs | null) => { if (v) { onDatum(v.format('YYYY-MM-DD')); setAnker(null); } }} showDaysOutsideCurrentMonth displayWeekNumber />
      </Popover>
    </Stack>
  );
}

/** Datumsfeld (ISO-Wert). */
export function DatumFeld({ label, wert, onWert, min, max, breite = 170, deaktiviert, pflicht }: {
  label: string; wert: string | null; onWert: (d: string | null) => void; min?: string; max?: string; breite?: number | string; deaktiviert?: boolean; pflicht?: boolean;
}) {
  return (
    <DatePicker label={label} value={wert ? dayjs(wert) : null} onChange={(v: Dayjs | null) => onWert(v && v.isValid() ? v.format('YYYY-MM-DD') : null)}
      minDate={min ? dayjs(min) : undefined} maxDate={max ? dayjs(max) : undefined} disabled={deaktiviert}
      slotProps={{ textField: { size: 'small', sx: { width: breite }, required: pflicht }, field: { clearable: !pflicht } }} />
  );
}
