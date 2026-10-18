// Anmeldeseite.
import { Button, Field, Input, MessageBar, MessageBarBody, makeStyles, tokens } from '@fluentui/react-components';
import { useState, type FormEvent } from 'react';
import logo from '../../../../design/logo/monogramm.svg';
import { api } from '@/api/client';
import type { Benutzer } from '@/api/typen';
import { useStudio } from '@/kern/zustand';

const useStile = makeStyles({
  seite: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colorNeutralBackground2, padding: '16px' },
  karte: {
    width: '360px', maxWidth: '100%', backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge, padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: tokens.shadow4,
  },
  marke: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' },
  logo: { width: '32px', height: '32px' },
  fett: { fontWeight: tokens.fontWeightSemibold },
  zusatz: { color: tokens.colorNeutralForeground3 },
  titel: { margin: '8px 0 0 0', fontSize: '20px', fontWeight: tokens.fontWeightSemibold },
  fuss: { marginTop: '16px', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export function Anmeldung({ fertig }: { fertig: (b: Benutzer) => void }) {
  const s = useStile();
  const system = useStudio((x) => x.system);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
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
      <form className={s.karte} onSubmit={senden} aria-label="Anmelden">
        <div className={s.marke}><img src={logo} alt="" className={s.logo} /><span><span className={s.fett}>UntPlan</span> <span className={s.zusatz}>Studio</span></span></div>
        <h1 className={s.titel}>Anmelden</h1>
        <Field label="Benutzername" required>
          <Input name="benutzer" autoComplete="username" value={name} onChange={(_, d) => setName(d.value)} autoFocus />
        </Field>
        <Field label="Passwort" required>
          <Input name="passwort" type="password" autoComplete="current-password" value={pw} onChange={(_, d) => setPw(d.value)} />
        </Field>
        {fehler ? <MessageBar intent="error"><MessageBarBody>{fehler}</MessageBarBody></MessageBar> : null}
        <Button appearance="primary" type="submit" disabled={laeuft} size="large">Anmelden</Button>
      </form>
      <div className={s.fuss}>{`${(system?.anwendung || 'UntPlan Studio').replace(' (Beta)', '')} ${system?.version || ''}`}</div>
    </div>
  );
}
