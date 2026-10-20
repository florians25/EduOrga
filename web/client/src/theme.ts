// MUI-Thema nach dem EduOrga-Designsystem (design/MARKE.md, design/tokens.css): Petrol #164c55 als Primärfarbe (Logo, Navigation, Knöpfe),
// Akzent #28747a (aktive Bereiche, Links, Fokus), Hintergrund #f5f7f8, Text #24363b; fachliche Statusfarben (Entfall rot, jede Änderung grün,
// Prüfung bernstein, Termin magenta, frei blau). Sachlich wie ein Schulsystem: Radius höchstens 6 px (Knöpfe, Felder, Karten, Dialoge),
// Segmentschalter mit 1-px-Rahmen, Linien statt Schatten (Schatten nur für schwebende Ebenen), neutrale Grautöne für Köpfe und Flächen,
// Petrol nur für Bedienung und Auswahl; sx-Radien rechnen mit 4 px je Einheit. Hell und dunkel. Prüfliste: design/DESIGN.md, „Keine KI-Anmutung“.
import { createTheme, alpha } from '@mui/material/styles';

export const farben = {
  // EduOrga-Petrol (design/MARKE.md): 700 = Primärfarbe #164c55 (Logo, Navigation, Knöpfe), 500 = Akzentfarbe #28747a (aktive Bereiche, Links).
  // Der Name „marine“ ist historisch (Palette des Themas, Variablen --up-marine-* in design/tokens.css).
  marine: { 50: '#eef5f6', 100: '#d6e8ea', 200: '#aed1d4', 300: '#7fb3b8', 400: '#4f9298', 500: '#28747a', 600: '#1d5f66', 700: '#164c55', 800: '#113c43', 900: '#0c2c31' },
  schiefer: { 0: '#ffffff', 25: '#fafbfc', 50: '#f5f7f8', 100: '#ebeff1', 200: '#d9e1e4', 300: '#c1cdd1', 400: '#93a3a8', 500: '#66787d', 600: '#4b5d62', 700: '#36474c', 800: '#24363b', 900: '#152226' },
  primaer: '#164c55', akzent: '#28747a', hintergrund: '#f5f7f8', text: '#24363b', logoAkzent: '#7fc9c9',
  // Stundenkarte (design/DESIGN.md, Abschnitt 10): Entfall rot mit allem durchgestrichen, jede Änderung grün (Feld „+neu (bisher)“)
  entfall: '#b42318', entfallFlaeche: '#fdecea', entfallText: '#8f1d14', entfallFeld: '#f7d3cf',
  aenderung: '#2f855a', aenderungFlaeche: '#e6f4ea', aenderungText: '#267349', aenderungFeld: '#c9e8d4',
  pruefung: '#a15c07', pruefungFlaeche: '#fdf4e3',
  termin: '#a3347c', terminFlaeche: '#faeef5',
  frei: '#2f6f9f', freiFlaeche: '#edf4fa',
  ok: '#1d7a46', okFlaeche: '#e9f6ee',
} as const;

/** Statusfarbe: Linie/Schrift, helle Fläche; Entfall und Änderung zusätzlich Schrift und Fläche des Felds (Chip) auf der Stundenkarte. */
export interface StatusFarbe { main: string; flaeche: string; text?: string; feld?: string }
/** Flächen des Stundenplans: Kachel, kräftigere Kachellinie, Kopf/Zeitspalte, Überfahren, Pausenband. */
export interface KachelFarben { flaeche: string; rand: string; /** Kontur der Stundenkarte (1,5 px, Stundenkarte v6). */ linie: string; kopf: string; hover: string; pause: string; raster: string; /** Balken links ohne Fachfarbe (grau, hell und dunkel deutlich sichtbar). */ balken: string;
  /** Mitteilung im Plan: helle gelbe Notiz (Fläche, Linie, Schrift). */ notiz: string; notizRand: string; notizText: string;
  /** Veranstaltung/Termin als Block im Raster: warmes Neutral (Fläche, Linie, Titel). */ ereignis: string; ereignisRand: string; ereignisText: string }
/** Seitenleiste in der Primärfarbe: Fläche, Text, Zweittext, Überfahren, aktive Zeile (leichte Tönung), 3-px-Kante der aktiven Zeile, Linie. */
export interface NavFarben { flaeche: string; text: string; text2: string; hover: string; aktiv: string; marke: string; linie: string }
/** Tabellenköpfe und leicht abgesetzte Flächen (neutrales Grau, keine Pastelltönung). */
export interface FlaechenFarben { kopf: string; band: string; rand: string }
declare module '@mui/material/styles' {
  interface Palette {
    status: { entfall: StatusFarbe; aenderung: StatusFarbe; offen: StatusFarbe; pruefung: StatusFarbe; termin: StatusFarbe; frei: StatusFarbe; ok: StatusFarbe };
    marine: typeof farben.marine;
    kachel: KachelFarben;
    nav: NavFarben;
    flaechen: FlaechenFarben;
  }
  interface PaletteOptions {
    status?: Palette['status'];
    marine?: typeof farben.marine;
    kachel?: KachelFarben;
    nav?: NavFarben;
    flaechen?: FlaechenFarben;
  }
}

export const SCHRIFT = '"IBM Plex Sans", -apple-system, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';

const status = (dunkel: boolean) => ({
  entfall: { main: dunkel ? '#f07167' : farben.entfall, flaeche: dunkel ? '#2e1916' : farben.entfallFlaeche, text: dunkel ? '#ffc9c3' : farben.entfallText, feld: dunkel ? '#4a2420' : farben.entfallFeld },
  aenderung: { main: dunkel ? '#5cbf86' : farben.aenderung, flaeche: dunkel ? '#15281d' : farben.aenderungFlaeche, text: dunkel ? '#b5e6c8' : farben.aenderungText, feld: dunkel ? '#1f4630' : farben.aenderungFeld },
  // offene Vertretung: neutral grau (nie rot), Kante gestrichelt, Feld „(Abr)“ bzw. „Vertretung folgt“
  offen: { main: dunkel ? '#8a9aa0' : '#7d8b90', flaeche: dunkel ? '#26363b' : '#ebeef2', text: dunkel ? '#d3dde0' : '#4d5866', feld: dunkel ? '#26363b' : '#ebeef2' },
  pruefung: { main: dunkel ? '#e9a640' : farben.pruefung, flaeche: dunkel ? '#2b2111' : farben.pruefungFlaeche },
  termin: { main: dunkel ? '#e27bbd' : farben.termin, flaeche: dunkel ? '#331a2b' : farben.terminFlaeche },
  frei: { main: dunkel ? '#78b3e0' : farben.frei, flaeche: dunkel ? '#132331' : farben.freiFlaeche },
  ok: { main: dunkel ? '#5ccf8c' : farben.ok, flaeche: dunkel ? '#12271b' : farben.okFlaeche },
});

const M = farben.marine;
const S = farben.schiefer;

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-thema' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: M[700], dark: M[800], light: M[500], contrastText: '#fff' },
        secondary: { main: M[500], dark: M[600], contrastText: '#fff' },
        error: { main: farben.entfall },
        warning: { main: farben.pruefung },
        success: { main: farben.ok },
        info: { main: farben.frei },
        background: { default: farben.hintergrund, paper: '#ffffff' },
        text: { primary: farben.text, secondary: S[600], disabled: S[400] },
        divider: S[200],
        action: { hover: alpha(M[700], 0.06), selected: M[50] },
        status: status(false),
        kachel: { flaeche: '#f7f9fa', rand: '#c3ced2', linie: '#b7c2c8', kopf: '#eef3f4', hover: '#f3f7f8', pause: '#e2e8ea', raster: '#edf1f2', balken: '#b4bec4',
          notiz: '#fdf5c9', notizRand: '#eddc8c', notizText: '#5c4a0f', ereignis: '#f7f1e3', ereignisRand: '#e2d6bb', ereignisText: '#5c4a22' },
        nav: { flaeche: M[700], text: '#ffffff', text2: 'rgba(255,255,255,.72)', hover: 'rgba(255,255,255,.05)', aktiv: 'rgba(255,255,255,.12)', marke: farben.logoAkzent, linie: 'rgba(255,255,255,.14)' },
        flaechen: { kopf: '#f1f3f4', band: '#f7f8f9', rand: '#d3dbde' },
        marine: farben.marine,
      },
    },
    dark: {
      palette: {
        primary: { main: '#5fb0b5', dark: '#7fc4c8', light: '#4f9298', contrastText: '#0b1d20' },
        secondary: { main: '#7fc4c8', contrastText: '#0b1d20' },
        error: { main: '#f07167' },
        warning: { main: '#e9a640' },
        success: { main: '#5ccf8c' },
        info: { main: '#78b3e0' },
        background: { default: '#0d181b', paper: '#132226' },
        text: { primary: '#e3ebed', secondary: '#a7b8bc', disabled: '#6a7d82' },
        divider: '#26393e',
        action: { hover: 'rgba(255,255,255,.06)', selected: '#173a3f' },
        status: status(true),
        kachel: { flaeche: '#172a2e', rand: '#33494e', linie: '#3c4e55', kopf: '#152629', hover: '#1d3337', pause: '#0b1719', raster: '#0f1d20', balken: '#56626c',
          notiz: '#2e2a14', notizRand: '#5a5020', notizText: '#efe2a8', ereignis: '#2a2519', ereignisRand: '#4a4130', ereignisText: '#e6d7b0' },
        nav: { flaeche: '#0c2a2f', text: '#e8f1f2', text2: 'rgba(232,241,242,.66)', hover: 'rgba(255,255,255,.04)', aktiv: 'rgba(255,255,255,.09)', marke: farben.logoAkzent, linie: 'rgba(255,255,255,.10)' },
        flaechen: { kopf: '#17262a', band: '#152327', rand: '#2c3f44' },
        marine: farben.marine,
      },
    },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: SCHRIFT,
    fontSize: 14,
    htmlFontSize: 16,
    h1: { fontSize: 20, fontWeight: 600, lineHeight: 1.3 },
    h2: { fontSize: 18, fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: 15, fontWeight: 600, lineHeight: 1.35 },
    h4: { fontSize: 14, fontWeight: 600 },
    h5: { fontSize: 14, fontWeight: 600 },
    h6: { fontSize: 14, fontWeight: 600 },
    subtitle1: { fontSize: 14, fontWeight: 500 },
    subtitle2: { fontSize: 13, fontWeight: 600 },
    body1: { fontSize: 14 },
    body2: { fontSize: 13 },
    caption: { fontSize: 12 },
    overline: { fontSize: 12, fontWeight: 500, letterSpacing: 0, textTransform: 'none' },
    button: { textTransform: 'none', fontWeight: 500, fontSize: 14 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontVariantNumeric: 'tabular-nums' },
        '@media print': { body: { background: '#fff' } },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 6, paddingInline: 14, paddingBlock: 5, lineHeight: '20px', minHeight: 32 },
        sizeSmall: { minHeight: 28, paddingInline: 10, paddingBlock: 3, fontSize: 13 },
        sizeLarge: { paddingBlock: 9 },
        outlined: ({ theme }) => ({ borderColor: theme.vars.palette.flaechen.rand, color: theme.vars.palette.text.primary, background: theme.vars.palette.background.paper,
          '&:hover': { borderColor: theme.vars.palette.primary.light, background: theme.vars.palette.action.hover } }),
        containedPrimary: ({ theme }) => ({ '&:hover': { background: theme.vars.palette.primary.dark } }),
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: ({ theme }) => ({ textTransform: 'none', fontWeight: 500, paddingBlock: 4, paddingInline: 12, borderColor: theme.vars.palette.divider, color: theme.vars.palette.text.secondary,
          '&:hover': { background: theme.vars.palette.action.hover },
          '&.Mui-selected, &.Mui-selected:hover': { background: theme.vars.palette.action.selected, color: theme.vars.palette.primary.main } }),
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: ({ theme }) => ({ background: theme.vars.palette.background.paper, borderRadius: 6,
          '& .MuiToggleButton-root': { borderColor: theme.vars.palette.divider } }),
        firstButton: { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
        lastButton: { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
      },
    },
    // Symbolknöpfe einfarbig; „Löschen“ (color="error") erst beim Überfahren rot, damit Tabellen nicht voller roter Symbole sind
    MuiIconButton: { styleOverrides: { root: { borderRadius: 6 }, colorError: ({ theme }) => ({ color: theme.vars.palette.text.secondary, '&:hover': { color: theme.vars.palette.error.main } }) } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: 6 }, outlined: ({ theme }) => ({ borderColor: theme.vars.palette.flaechen.rand }) },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiCardHeader: {
      styleOverrides: { root: ({ theme }) => ({ paddingBlock: 10, borderBottom: `1px solid ${theme.vars.palette.divider}` }), title: { fontSize: 14, fontWeight: 600 }, subheader: { fontSize: 13 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({ borderRadius: 6, background: theme.vars.palette.background.paper,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.flaechen.rand },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.text.disabled },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.secondary.main } }),
        input: { paddingBlock: 8 },
        inputSizeSmall: { paddingBlock: 6.5 },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: 14 },
        // mittlere Felder (Anmeldung): Beschriftung mittig im niedrigeren Feld (Eingabe mit 8 px Innenabstand)
        outlined: { '&.MuiInputLabel-sizeMedium:not(.MuiInputLabel-shrink)': { transform: 'translate(14px, 10px) scale(1)' } },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiAutocomplete: { defaultProps: { size: 'small' } },
    MuiChip: {
      // Auswahl-Chips (Filter): gewählt leicht getönt mit Akzentrand statt vollflächig Petrol
      styleOverrides: { root: ({ theme }) => ({ fontWeight: 500, borderRadius: 3,
        '&.MuiChip-filled.MuiChip-colorPrimary': { background: theme.vars.palette.action.selected, color: theme.vars.palette.primary.main, boxShadow: `inset 0 0 0 1px ${theme.vars.palette.secondary.main}` },
        '&.MuiChip-filled.MuiChip-colorPrimary.MuiChip-clickable:hover': { background: theme.vars.palette.action.selected } }), sizeSmall: { height: 22, fontSize: 12 } },
    },
    MuiTooltip: {
      defaultProps: { enterDelay: 250 },
      styleOverrides: { tooltip: { fontSize: 12, background: farben.schiefer[800], borderRadius: 4, padding: '6px 10px' }, arrow: { color: farben.schiefer[800] } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 6, boxShadow: '0 12px 32px rgba(12,28,32,.22)' } },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 16, fontWeight: 600, paddingBlock: 14 } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: theme.vars.palette.divider, paddingBlock: 7 }),
        head: ({ theme }) => ({ fontSize: 12, fontWeight: 600, color: theme.vars.palette.text.primary, background: theme.vars.palette.flaechen.kopf, whiteSpace: 'nowrap', borderBottomColor: theme.vars.palette.flaechen.rand }),
      },
    },
    MuiTableRow: { styleOverrides: { root: ({ theme }) => ({ '&.MuiTableRow-hover:hover': { background: theme.vars.palette.action.hover } }) } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500, minHeight: 44 } } },
    // Listen klassisch: volle Zeilenbreite, eckig; Auswahl = leichte Tönung, 3-px-Kante links in der Akzentfarbe, Schrift 600
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({ borderRadius: 0, '&.Mui-selected': { background: theme.vars.palette.action.selected, boxShadow: `inset 3px 0 0 ${theme.vars.palette.secondary.main}`, fontWeight: 600 },
          '&.Mui-selected:hover': { background: theme.vars.palette.action.selected } }),
      },
    },
    MuiMenuItem: { styleOverrides: { root: ({ theme }) => ({ '&.Mui-selected': { boxShadow: `inset 3px 0 0 ${theme.vars.palette.secondary.main}` } }) } },
    // Schwebende Ebenen (Menüs, Listen von Auswahlfeldern, Popover): eine Schattenstufe mit 1-px-Linie
    MuiMenu: { styleOverrides: { paper: ({ theme }) => ({ borderRadius: 6, border: `1px solid ${theme.vars.palette.divider}`, boxShadow: '0 6px 20px rgba(12,28,32,.12)' }) } },
    MuiPopover: { styleOverrides: { paper: ({ theme }) => ({ border: `1px solid ${theme.vars.palette.divider}`, boxShadow: '0 6px 20px rgba(12,28,32,.12)' }) } },
    // Hinweise sachlich: weiße Fläche, 1-px-Linie, 3-px-Kante links in der Statusfarbe; Text in der Grundfarbe
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 6, paddingBlock: 2, alignItems: 'flex-start' },
        standard: ({ theme }) => ({ background: theme.vars.palette.background.paper, color: theme.vars.palette.text.primary, border: `1px solid ${theme.vars.palette.divider}` }),
        standardInfo: ({ theme }) => ({ boxShadow: `inset 3px 0 0 ${theme.vars.palette.secondary.main}`, '& .MuiAlert-icon': { color: theme.vars.palette.text.secondary } }),
        standardSuccess: ({ theme }) => ({ boxShadow: `inset 3px 0 0 ${theme.vars.palette.status.ok.main}`, '& .MuiAlert-icon': { color: theme.vars.palette.status.ok.main } }),
        standardWarning: ({ theme }) => ({ boxShadow: `inset 3px 0 0 ${theme.vars.palette.status.pruefung.main}`, '& .MuiAlert-icon': { color: theme.vars.palette.status.pruefung.main } }),
        standardError: ({ theme }) => ({ boxShadow: `inset 3px 0 0 ${theme.vars.palette.status.entfall.main}`, '& .MuiAlert-icon': { color: theme.vars.palette.status.entfall.main } }),
        icon: { fontSize: 18, opacity: 1 },
      },
    },
    MuiBadge: { styleOverrides: { badge: { fontWeight: 600 } } },
    MuiLink: { defaultProps: { underline: 'hover', color: 'secondary' } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44 }, indicator: ({ theme }) => ({ background: theme.vars.palette.secondary.main }) } },
  },
});
