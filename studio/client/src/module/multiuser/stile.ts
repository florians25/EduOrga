import { makeStyles, tokens } from '@fluentui/react-components';

export const useMuStile = makeStyles({
  flaeche: { flex: 1, overflowY: 'auto', padding: '16px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '24px' },
  abschnitt: { display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '1100px' },
  kopf: { display: 'flex', alignItems: 'center', gap: '12px', minHeight: '32px' },
  h3: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, flex: 1 },
  kopfinfo: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  text: { margin: 0, color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300 },
  leise: { color: tokens.colorNeutralForeground3 },
  warnung: { color: tokens.colorPaletteDarkOrangeForeground1 },
  inaktiv: { color: tokens.colorNeutralForeground3 },
  gesperrt: { backgroundColor: tokens.colorPaletteYellowBackground1 },
  zahl: { fontVariantNumeric: 'tabular-nums' },
  aktion: { textAlign: 'right', whiteSpace: 'nowrap' },
  nachrichten: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: tokens.fontSizeBase300 },
  nachricht: { display: 'grid', gridTemplateColumns: '72px 180px minmax(0, 1fr)', gap: '8px', padding: '4px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  spalten: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' },
  formular: { display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '8px 12px', alignItems: 'center' },
  rechte: { display: 'flex', flexDirection: 'column', maxHeight: '360px', overflowY: 'auto' },
});
