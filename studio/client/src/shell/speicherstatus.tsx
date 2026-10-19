// Speicherstand in der Kopfleiste. Der Server speichert jede Änderung sofort (kurz verzögert, zusammengefasst) in die Datenbank –
// hier steht nur ruhig der Stand: „Gespeichert · 14:32“, „Speichert …“ oder bei einem Fehler „Nicht gespeichert“ mit „Erneut
// versuchen“. Strg+S legt einen Sicherungspunkt an (ältere Fassung, die nicht automatisch verdrängt wird).
import { Button, Text, Tooltip, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { CloudCheckmark16Regular, CloudDismiss16Regular, CloudSync16Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { speichern } from '@/kern/dokument';
import { datumDe } from '@/kern/hilfen';
import { useStudio } from '@/kern/zustand';
import { fehlerMelden } from '@/komponenten/hinweise';

const useStile = makeStyles({
  stand: {
    display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap', maxWidth: '220px', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis',
  },
  symbol: { flexShrink: 0, display: 'inline-flex' },
  fehler: { color: tokens.colorPaletteRedForeground1 },
  getrennt: { color: tokens.colorPaletteRedForeground1 },
  knopf: { minWidth: 0, padding: '0 6px', height: '24px', fontSize: tokens.fontSizeBase200 },
});

/** „Speichert …“ erst zeigen, wenn es länger als einen Augenblick dauert (sonst flackert die Anzeige bei jeder Änderung). */
function useVerzoegert(wert: boolean, ms = 600): boolean {
  const [an, setAn] = useState(false);
  useEffect(() => {
    if (!wert) { setAn(false); return; }
    const t = setTimeout(() => setAn(true), ms);
    return () => clearTimeout(t);
  }, [wert, ms]);
  return an;
}

const uhrzeit = (iso: string | null | undefined) => (iso ? datumDe(iso).split(', ')[1] || '' : '');

export function Speicherstatus() {
  const s = useStile();
  const d = useStudio((x) => x.dokument);
  const verbunden = useStudio((x) => x.verbunden);
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  const offen = !!d && (d.geaendert || !!d.speichert) && !d.speicherfehler;
  const zeigeSpeichert = useVerzoegert(offen);
  const [versucht, setVersucht] = useState(false);
  if (!d) return null;

  if (!verbunden) {
    return (
      <Tooltip relationship="description" content="Die Verbindung zum Server ist unterbrochen. Änderungen sind erst nach der Wiederverbindung möglich.">
        <Text className={mergeClasses(s.stand, s.getrennt)} data-testid="speicherstand" data-stand="getrennt">
          <span className={s.symbol}><CloudDismiss16Regular /></span>Verbindung unterbrochen
        </Text>
      </Tooltip>
    );
  }
  if (d.speicherfehler) {
    const erneut = () => {
      setVersucht(true);
      speichern().catch(fehlerMelden).finally(() => setVersucht(false));
    };
    return (
      <span className={mergeClasses(s.stand, s.fehler)} data-testid="speicherstand" data-stand="fehler">
        <Tooltip relationship="description" content={`${d.speicherfehler} Der Server versucht es automatisch erneut.`}>
          <span className={s.stand} style={{ color: 'inherit' }}><span className={s.symbol}><CloudDismiss16Regular /></span>Nicht gespeichert</span>
        </Tooltip>
        {schreiben ? <Button size="small" appearance="transparent" className={s.knopf} disabled={versucht} onClick={erneut} data-testid="speichern-erneut">Erneut versuchen</Button> : null}
      </span>
    );
  }
  if (zeigeSpeichert) {
    return (
      <Text className={s.stand} data-testid="speicherstand" data-stand="speichert">
        <span className={s.symbol}><CloudSync16Regular /></span>Speichert …
      </Text>
    );
  }
  const zeit = uhrzeit(d.gespeichert);
  return (
    <Tooltip relationship="description"
      content={`Alle Änderungen werden sofort gespeichert${d.gespeichert ? ` (zuletzt am ${datumDe(d.gespeichert)})` : ''}. Strg+S legt zusätzlich einen Sicherungspunkt an.`}>
      <Text className={s.stand} data-testid="speicherstand" data-stand={offen ? 'speichert' : 'gespeichert'}>
        <span className={s.symbol}><CloudCheckmark16Regular /></span>{zeit ? `Gespeichert · ${zeit}` : 'Gespeichert'}
      </Text>
    </Tooltip>
  );
}
