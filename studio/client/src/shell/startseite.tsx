// Startseite: mit geöffneter Schuldatei die Übersicht, sonst „Keine Schuldatei geöffnet“ mit den wichtigsten Aktionen.
import { makeStyles, tokens } from '@fluentui/react-components';
import { ChevronRight20Regular } from '@fluentui/react-icons';
import { Navigate } from 'react-router-dom';
import { befehl } from '@/kern/befehle';
import { useStudio } from '@/kern/zustand';

const useStile = makeStyles({
  seite: { padding: '48px 40px', maxWidth: '720px' },
  titel: { margin: 0, fontSize: '24px', fontWeight: tokens.fontWeightSemibold },
  leise: { color: tokens.colorNeutralForeground3, marginTop: '6px' },
  aktionen: { display: 'flex', flexDirection: 'column', marginTop: '28px', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, overflow: 'hidden' },
  aktion: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', border: 'none', background: tokens.colorNeutralBackground1,
    textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground1,
    ':last-child': { borderBottom: 'none' },
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  texte: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' },
  aktionTitel: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase300 },
  aktionText: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export function Startseite() {
  const s = useStile();
  const d = useStudio((x) => x.dokument);
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  if (d) return <Navigate to="/uebersicht" replace />;
  const aktionen: [string, string, () => unknown, boolean][] = [
    ['Schuldatei öffnen', 'Dateien auf dem Server', () => befehl('datei.backstage', { seite: 'oeffnen' }), true],
    ['Neue Schuldatei', 'Leere Datei oder Beispielschule', () => befehl('datei.backstage', { seite: 'neu' }), schreiben],
    ['Datei hochladen', 'Schuldatei (.up) oder BAL-Datei', () => befehl('datei.hochladen'), schreiben],
  ];
  return (
    <div className={s.seite}>
      <h1 className={s.titel}>Keine Schuldatei geöffnet</h1>
      <div className={s.leise}>Öffnen Sie eine Schuldatei oder legen Sie eine neue an.</div>
      <div className={s.aktionen}>
        {aktionen.filter((a) => a[3]).map(([t, x, f]) => (
          <button key={t} type="button" className={s.aktion} onClick={() => void f()}>
            <span className={s.texte}><span className={s.aktionTitel}>{t}</span><span className={s.aktionText}>{x}</span></span>
            <ChevronRight20Regular />
          </button>
        ))}
      </div>
    </div>
  );
}
