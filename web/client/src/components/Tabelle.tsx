// Tabelle für Listenseiten: Spalten mit Sortierung, Auswahl per Kontrollkästchen, Klick auf Zeilen, Leerzustand, schrittweises Nachladen.
import { useMemo, useState, type ReactNode } from 'react';
import { Box, Button, Checkbox, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, type SxProps } from '@mui/material';
import { Leer } from './Seite';

export interface Spalte<T> {
  id: string;
  kopf: ReactNode;
  zelle: (z: T, i: number) => ReactNode;
  sortWert?: (z: T) => string | number | null | undefined;
  breite?: number | string;
  rechts?: boolean;
  nowrap?: boolean;
  verbergenMobil?: boolean;
  sx?: SxProps;
}

export function Tabelle<T>({ zeilen, spalten, schluessel, onZeile, auswahl, setAuswahl, leer = 'Keine Einträge', leerUnter, dicht, max = 200, sortierung, rahmen = true, kopfFest = false, zeilenSx }: {
  zeilen: T[]; spalten: Spalte<T>[]; schluessel: (z: T, i: number) => string | number; onZeile?: (z: T) => void;
  auswahl?: Set<string | number>; setAuswahl?: (s: Set<string | number>) => void; leer?: string; leerUnter?: ReactNode; dicht?: boolean; max?: number;
  sortierung?: { id: string; richtung: 'asc' | 'desc' }; rahmen?: boolean; kopfFest?: boolean; zeilenSx?: (z: T) => SxProps;
}) {
  const [sort, setSort] = useState(sortierung ?? null);
  const [anzahl, setAnzahl] = useState(max);
  const sortiert = useMemo(() => {
    if (!sort) return zeilen;
    const sp = spalten.find(s => s.id === sort.id);
    if (!sp?.sortWert) return zeilen;
    const f = sp.sortWert;
    return [...zeilen].sort((a, b) => {
      const x = f(a) ?? '', y = f(b) ?? '';
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'de', { numeric: true });
      return sort.richtung === 'asc' ? r : -r;
    });
  }, [zeilen, spalten, sort]);
  const alleIds = sortiert.map(schluessel);
  const alle = !!auswahl && alleIds.length > 0 && alleIds.every(id => auswahl.has(id));
  const inhalt = (
    <TableContainer sx={{ maxHeight: kopfFest ? '70vh' : undefined }}>
      <Table size={dicht ? 'small' : 'medium'} stickyHeader={kopfFest}>
        <TableHead>
          <TableRow>
            {auswahl && setAuswahl && (
              <TableCell padding="checkbox"><Checkbox size="small" checked={alle} indeterminate={!alle && auswahl.size > 0} onChange={() => setAuswahl(alle ? new Set() : new Set(alleIds))} inputProps={{ 'aria-label': 'Alle auswählen' }} /></TableCell>
            )}
            {spalten.map(s => (
              <TableCell key={s.id} align={s.rechts ? 'right' : 'left'} sx={{ width: s.breite, display: s.verbergenMobil ? { xs: 'none', md: 'table-cell' } : undefined }}>
                {s.sortWert ? (
                  <TableSortLabel active={sort?.id === s.id} direction={sort?.id === s.id ? sort.richtung : 'asc'}
                    onClick={() => setSort(sort?.id === s.id ? { id: s.id, richtung: sort.richtung === 'asc' ? 'desc' : 'asc' } : { id: s.id, richtung: 'asc' })}>{s.kopf}</TableSortLabel>
                ) : s.kopf}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sortiert.slice(0, anzahl).map((z, i) => {
            const id = schluessel(z, i);
            const gewaehlt = !!auswahl?.has(id);
            return (
              <TableRow key={id} hover={!!onZeile || !!auswahl} selected={gewaehlt} onClick={onZeile ? () => onZeile(z) : undefined} sx={{ cursor: onZeile ? 'pointer' : 'default', ...zeilenSx?.(z) }}>
                {auswahl && setAuswahl && (
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    <Checkbox size="small" checked={gewaehlt} onChange={() => { const n = new Set(auswahl); if (gewaehlt) n.delete(id); else n.add(id); setAuswahl(n); }} inputProps={{ 'aria-label': 'Auswählen' }} />
                  </TableCell>
                )}
                {spalten.map(s => (
                  <TableCell key={s.id} align={s.rechts ? 'right' : 'left'} sx={{ whiteSpace: s.nowrap ? 'nowrap' : undefined, display: s.verbergenMobil ? { xs: 'none', md: 'table-cell' } : undefined, ...s.sx }}>{s.zelle(z, i)}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!zeilen.length && <Leer text={leer} unter={leerUnter} />}
      {sortiert.length > anzahl && (
        <Box sx={{ textAlign: 'center', py: 1.5 }}><Button onClick={() => setAnzahl(anzahl + max)}>Weitere {Math.min(max, sortiert.length - anzahl)} von {sortiert.length - anzahl} anzeigen</Button></Box>
      )}
    </TableContainer>
  );
  return rahmen ? <Paper variant="outlined" sx={{ borderRadius: 3.5, overflow: 'hidden' }}>{inhalt}</Paper> : inhalt;
}
