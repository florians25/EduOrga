// Anmeldeseite: links die Marke (Primärfarbe, Slogan), rechts das Formular; im schmalen Fenster untereinander.
import { Button, Field, Input, MessageBar, MessageBarBody, makeStyles, tokens } from '@fluentui/react-components';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/api/client';
import type { Benutzer } from '@/api/typen';
import { useStudio } from '@/kern/zustand';
import { Monogramm, SLOGAN } from '@/komponenten/marke';

const useStile = makeStyles({
  seite: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
    backgroundColor: tokens.colorNeutralBackground2, padding: '16px',
  },
  karte: {
    width: '780px', maxWidth: '100%', display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow8,
    '@media (max-width: 720px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  marke: {
    backgroundColor: 'var(--edo-navi)', color: '#ffffff', padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px',
    '@media (max-width: 720px)': { padding: '20px 24px', gap: '12px' },
  },
  markeKopf: { display: 'flex', alignItems: 'center', gap: '12px' },
  wortmarke: { fontSize: '22px', lineHeight: '28px', whiteSpace: 'nowrap' },
  fett: { fontWeight: tokens.fontWeightSemibold },
  zusatz: { fontWeight: tokens.fontWeightRegular, color: 'rgba(255,255,255,0.72)', marginLeft: '6px' },
  slogan: { margin: 0, fontSize: '20px', lineHeight: '28px', fontWeight: tokens.fontWeightSemibold, marginTop: 'auto', '@media (max-width: 720px)': { marginTop: 0, fontSize: '16px' } },
  beschreibung: { margin: 0, fontSize: tokens.fontSizeBase300, lineHeight: '20px', color: 'rgba(255,255,255,0.78)', '@media (max-width: 720px)': { display: 'none' } },
  formular: { padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: '16px', '@media (max-width: 720px)': { padding: '24px' } },
  titel: { margin: 0, fontSize: '20px', lineHeight: '28px', fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 },
  hinweis: { margin: '-8px 0 4px 0', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase300 },
  fuss: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export function Anmeldung({ fertig }: { fertig: (b: Benutzer) => void }) {
  const s = useStile();
  const system = useStudio((x) => x.system);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { document.title = 'Anmelden – EduOrga Studio'; }, []);
  const senden = async (e: FormEvent) => {
    e.preventDefault();
    setLaeuft(true);
    setFehler('');
    try {
      fertig(await api.post<Benutzer>('/api/anmeldung', { benutzer: name, passwort: pw }));
    } catch (f) {
      setFehler((f as Error).message);
    } finally { setLaeuft(false); }
  };
  return (
    <div className={s.seite}>
      <div className={s.karte}>
        <div className={s.marke}>
          <div className={s.markeKopf}>
            <Monogramm groesse={40} invers />
            <span className={s.wortmarke}><span className={s.fett}>Edu</span>Orga<span className={s.zusatz}>Studio</span></span>
          </div>
          <p className={s.beschreibung}>Stundenplanung und Vertretungsplanung für die ganze Schule – im Browser, gemeinsam im Kollegium.</p>
          <p className={s.slogan}>{SLOGAN}</p>
        </div>
        <form className={s.formular} onSubmit={senden} aria-label="Anmelden">
          <h1 className={s.titel}>Anmelden</h1>
          <p className={s.hinweis}>Mit dem Konto, das die Administration Ihrer Schule angelegt hat.</p>
          <Field label="Benutzername" required>
            <Input name="benutzer" autoComplete="username" value={name} onChange={(_, d) => setName(d.value)} autoFocus />
          </Field>
          <Field label="Passwort" required>
            <Input name="passwort" type="password" autoComplete="current-password" value={pw} onChange={(_, d) => setPw(d.value)} />
          </Field>
          {fehler ? <MessageBar intent="error"><MessageBarBody>{fehler}</MessageBarBody></MessageBar> : null}
          <Button appearance="primary" type="submit" disabled={laeuft} size="large">Anmelden</Button>
        </form>
      </div>
      <div className={s.fuss}>{`${(system?.anwendung || 'EduOrga Studio').replace(' (Beta)', '')} ${system?.version || ''}`}</div>
    </div>
  );
}
