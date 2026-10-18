// Rahmen für eine Ansicht: Kontext (useAnsicht), Laden der Ansicht (lazy), Fehlergrenze, Hinweis ohne Schuldatei.
import { Button, Spinner, makeStyles, tokens } from '@fluentui/react-components';
import { Component, Suspense, useMemo, type ErrorInfo, type ReactNode } from 'react';
import { AnsichtKontext, ansichtDef, type AnsichtKontextWert, type Lage } from '@/kern/ansichten';
import { befehl, type Params } from '@/kern/befehle';
import { neueId } from '@/kern/hilfen';
import { useStudio } from '@/kern/zustand';
import { Leer } from '@/komponenten/ansicht';

const useStile = makeStyles({
  laden: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' },
  fehler: { padding: '24px', color: tokens.colorPaletteRedForeground1, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' },
});

class Fehlergrenze extends Component<{ children: ReactNode }, { fehler: Error | null }> {
  state = { fehler: null as Error | null };
  static getDerivedStateFromError(fehler: Error) { return { fehler }; }
  componentDidCatch(f: Error, info: ErrorInfo) { console.error('Fehler in der Ansicht', f, info.componentStack); }
  render() {
    if (this.state.fehler) return <FehlerAnzeige fehler={this.state.fehler} neu={() => this.setState({ fehler: null })} />;
    return this.props.children;
  }
}

function FehlerAnzeige({ fehler, neu }: { fehler: Error; neu: () => void }) {
  const s = useStile();
  return (
    <div className={s.fehler} role="alert">
      <span>Die Ansicht konnte nicht angezeigt werden: {fehler.message}</span>
      <Button onClick={neu}>Erneut versuchen</Button>
    </div>
  );
}

export function KeinDokument() {
  return (
    <Leer text="Es ist keine Schuldatei geöffnet.">
      <Button appearance="primary" onClick={() => void befehl('datei.backstage', { seite: 'oeffnen' })}>Schuldatei öffnen</Button>
    </Leer>
  );
}

export interface AnsichtHostProps {
  typ: string;
  p: Params;
  lage: Lage;
  parameterSetzen: (p: Params) => void;
  oeffnen: (typ: string, p?: Params) => void;
  schliessen?: () => void;
  alsSeite?: () => void;
  /** feste Id (sonst eine neue je Einbindung) */
  id?: string;
}

export function AnsichtHost({ typ, p, lage, parameterSetzen, oeffnen, schliessen, alsSeite, id: festeId }: AnsichtHostProps) {
  const s = useStile();
  const def = ansichtDef(typ);
  const dokument = useStudio((x) => x.dokument?.id);
  const id = useMemo(() => festeId || neueId('ansicht'), [festeId]);
  const wert = useMemo<AnsichtKontextWert>(() => ({ id, typ, lage, p, parameterSetzen, oeffnen, schliessen, alsSeite }),
    [id, typ, lage, p, parameterSetzen, oeffnen, schliessen, alsSeite]);
  if (!def) return <Leer text={`Unbekannte Ansicht „${typ}“.`} />;
  if (!dokument && !def.ohneDokument) return <KeinDokument />;
  const K = def.komponente;
  return (
    <AnsichtKontext.Provider value={wert}>
      <Fehlergrenze>
        <Suspense fallback={<div className={s.laden}><Spinner size="small" label="Wird geladen …" /></div>}>
          <K key={dokument || ''} p={p} />
        </Suspense>
      </Fehlergrenze>
    </AnsichtKontext.Provider>
  );
}
