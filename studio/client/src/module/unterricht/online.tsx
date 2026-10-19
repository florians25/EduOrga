// „Findet online statt“ eines Unterrichts (regelmäßig, Bereich Unterricht): Schalter und Link (GET/PUT /unterricht/{uid}/online).
import { Field, Input, Switch, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useState } from 'react';
import { api } from '@/api/client';
import { darfSchreiben } from '@/kern/zustand';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';

export interface UnterrichtOnline { unterricht: number; online: boolean; onlineLink: string; fach: string; lehrer: string; klassen: string }

const useStile = makeStyles({
  inhalt: { display: 'flex', flexDirection: 'column', gap: '14px' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export const linkGueltig = (l: string) => !l.trim() || /^https?:\/\/\S+$/i.test(l.trim());

function Inhalt({ stand, schliessen }: { stand: UnterrichtOnline; schliessen: (w: { online: boolean; link: string } | null) => void }) {
  const s = useStile();
  const [online, setOnline] = useState(stand.online);
  const [link, setLink] = useState(stand.onlineLink || '');
  const schreiben = darfSchreiben();
  const fehler = linkGueltig(link) ? undefined : 'Bitte eine Adresse mit http:// oder https:// angeben.';
  return (
    <StandardDialog<boolean> titel={`Unterricht Nr. ${stand.unterricht} – online`} breite="520px"
      knoepfe={schreiben ? [{ text: 'Speichern', wert: true, primaer: true, deaktiviert: !!fehler }, { text: 'Abbrechen', wert: null }] : [{ text: 'Schließen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? { online, link } : null)}>
      <div className={s.inhalt}>
        <Text>{[stand.fach, stand.klassen, stand.lehrer].filter(Boolean).join(' · ')}</Text>
        <Switch label="Findet online statt" checked={online} disabled={!schreiben} onChange={(_, d) => setOnline(d.checked)} />
        <Field label="Link zur Online-Stunde" hint="z. B. Adresse des Videoraums; wird in EduOrga Web angezeigt, solange der Unterricht online stattfindet." validationMessage={fehler}>
          <Input value={link} disabled={!schreiben} onChange={(_, d) => setLink(d.value)} placeholder="https://" type="url" />
        </Field>
        <span className={s.leise}>Gilt für alle Stunden des Unterrichts in der aktiven Periode. Abweichungen an einzelnen Tagen legt die Vertretungsplanung fest.</span>
      </div>
    </StandardDialog>
  );
}

/** Dialog „Findet online statt“ für einen Unterricht; liefert den neuen Stand oder null. */
export async function onlineDialog(uid: number, quelle?: string): Promise<UnterrichtOnline | null> {
  const stand = await api.get<UnterrichtOnline>(api.dok(`/unterricht/${uid}/online`));
  const w = await dialogZeigen<{ online: boolean; link: string }>((schliessen) => <Inhalt stand={stand} schliessen={schliessen} />);
  if (!w) return null;
  const neu = await api.put<UnterrichtOnline>(api.dok(`/unterricht/${uid}/online`), { online: w.online, onlineLink: w.link.trim() }, { quelle });
  hinweis(neu.online ? `Unterricht Nr. ${uid} findet online statt.` : `Unterricht Nr. ${uid} findet nicht online statt.`, 'ok', 2500);
  return neu;
}
