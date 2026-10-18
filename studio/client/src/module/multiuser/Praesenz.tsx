// Feld in der Kopfleiste: wer arbeitet gerade an dieser Schuldatei (öffnet „Aktive Benutzer“).
import { Button, makeStyles, tokens } from '@fluentui/react-components';
import { PeopleRegular } from '@fluentui/react-icons';
import { seiteOeffnen } from '@/kern/befehle';
import { useMultiuser } from './stand';

const useStile = makeStyles({
  knopf: { minWidth: 0, fontWeight: tokens.fontWeightRegular, whiteSpace: 'nowrap' },
  sperre: { marginLeft: '6px', color: tokens.colorPaletteDarkOrangeForeground1 },
});

export default function Praesenz() {
  const s = useStile();
  const stand = useMultiuser((x) => x.stand);
  if (!stand) return null;
  const ich = stand.ich.toLowerCase();
  const aktive = stand.aktive.filter((a) => a.aktiv);
  const andere = aktive.filter((a) => a.benutzer.toLowerCase() !== ich);
  const sperre = stand.exklusiv && !stand.exklusiv.eigen ? `exklusiv: ${stand.exklusiv.anzeigename}` : stand.sperren.length ? `${stand.sperren.length} ${stand.sperren.length === 1 ? 'Sperre' : 'Sperren'}` : '';
  const titel = (andere.length ? `${andere.length + 1} Benutzer aktiv:\n` : 'Nur Sie arbeiten gerade an dieser Datei.\n') + aktive.map((a) => `${a.anzeigename}${a.taetigkeit ? ` – ${a.taetigkeit}` : ''}`).join('\n') || 'Mehrbenutzerbetrieb';
  return (
    <Button appearance="subtle" size="small" className={s.knopf} icon={<PeopleRegular />} title={titel} aria-label={andere.length ? `${andere.length + 1} Benutzer aktiv` : 'Nur Sie sind aktiv'} data-testid="multiuser-praesenz"
      onClick={() => seiteOeffnen('multiuser')}>
      {andere.length ? String(andere.length + 1) : null}
      {sperre ? <span className={s.sperre}>{sperre}</span> : null}
    </Button>
  );
}
