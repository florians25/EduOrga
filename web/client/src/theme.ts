// MUI-Thema nach dem EduOrga-Designsystem (design/MARKE.md, design/tokens.css): Petrol #164c55 als Primärfarbe (Logo, Navigation, Knöpfe),
// Akzent #28747a (aktive Bereiche, Links, Fokus), Hintergrund #f5f7f8, Text #24363b; fachliche Statusfarben (Entfall rot, Änderung violett,
// Prüfung bernstein, Termin magenta, frei blau). Sachlich wie ein Schulsystem: Knöpfe und Felder Radius 6, Karten 8, Plaketten 3,
// Segmentschalter mit 1-px-Rahmen, deutliche Linien statt Schatten; sx-Radien rechnen mit 4 px je Einheit. Hell und dunkel.
import { createTheme, alpha } from '@mui/material/styles';

export const farben = {
  // EduOrga-Petrol (design/MARKE.md): 700 = Primärfarbe #164c55 (Logo, Navigation, Knöpfe), 500 = Akzentfarbe #28747a (aktive Bereiche, Links).
  // Der Name „marine“ ist historisch (Palette des Themas, Variablen --up-marine-* in design/tokens.css).
  marine: { 50: '#eef5f6', 100: '#d6e8ea', 200: '#aed1d4', 300: '#7fb3b8', 400: '#4f9298', 500: '#28747a', 600: '#1d5f66', 700: '#164c55', 800: '#113c43', 900: '#0c2c31' },
  schiefer: { 0: '#ffffff', 25: '#fafbfc', 50: '#f5f7f8', 100: '#ebeff1', 200: '#d9e1e4', 300: '#c1cdd1', 400: '#93a3a8', 500: '#66787d', 600: '#4b5d62', 700: '#36474c', 800: '#24363b', 900: '#152226' },
  primaer: '#164c55', akzent: '#28747a', hintergrund: '#f5f7f8', text: '#24363b', logoAkzent: '#7fc9c9',
  entfall: '#b42318', entfallFlaeche: '#fdf0ef',
  aenderung: '#6d4fc2', aenderungFlaeche: '#f1edfb',
  pruefung: '#a15c07', pruefungFlaeche: '#fdf4e3',
  termin: '#a3347c', terminFlaeche: '#faeef5',
  frei: '#2f6f9f', freiFlaeche: '#edf4fa',
  ok: '#1d7a46', okFlaeche: '#e9f6ee',
} as const;

export interface StatusFarbe { main: string; flaeche: string }
/** Flächen des Stundenplans: Kachel, kräftigere Kachellinie, Kopf/Zeitspalte, Überfahren, Pausenband. */
export interface KachelFarben { flaeche: string; rand: string; kopf: string; hover: string; pause: string }
/** Seitenleiste in der Primärfarbe: Fläche, Text, Zweittext, Überfahren, aktive Zeile, Markierung der aktiven Zeile, Linie. */
export interface NavFarben { flaeche: string; text: string; text2: string; hover: string; aktiv: string; marke: string; linie: string }
/** Kopfbänder von Abschnitten und Tabellen (leichte Petrol-Tönung, damit nicht alles weiß ist). */
export interface FlaechenFarben { kopf: string; band: string; rand: string }
declare module '@mui/material/styles' {
  interface Palette {
    status: { entfall: StatusFarbe; aenderung: StatusFarbe; pruefung: StatusFarbe; termin: StatusFarbe; frei: StatusFarbe; ok: StatusFarbe };
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
  entfall: { main: dunkel ? '#f07167' : farben.entfall, flaeche: dunkel ? '#2e1916' : farben.entfallFlaeche },
  aenderung: { main: dunkel ? '#a993f0' : farben.aenderung, flaeche: dunkel ? '#231d3a' : farben.aenderungFlaeche },
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
        kachel: { flaeche: '#f7f9fa', rand: '#c3ced2', kopf: '#eef3f4', hover: '#e8eff0', pause: '#e9eef0' },
        nav: { flaeche: M[700], text: '#ffffff', text2: 'rgba(255,255,255,.68)', hover: 'rgba(255,255,255,.08)', aktiv: M[500], marke: farben.logoAkzent, linie: 'rgba(255,255,255,.14)' },
        flaechen: { kopf: '#eef3f4', band: '#f2f6f7', rand: '#cfd9dc' },
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
        kachel: { flaeche: '#172a2e', rand: '#33494e', kopf: '#152629', hover: '#1d3337', pause: '#0f1e21' },
        nav: { flaeche: '#0c2a2f', text: '#e8f1f2', text2: 'rgba(232,241,242,.62)', hover: 'rgba(255,255,255,.06)', aktiv: '#1d5f66', marke: farben.logoAkzent, linie: 'rgba(255,255,255,.10)' },
        flaechen: { kopf: '#172a2e', band: '#152629', rand: '#2c4146' },
        marine: farben.marine,
      },
    },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: SCHRIFT,
    fontSize: 14,
    htmlFontSize: 16,
    h1: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.25 },
    h2: { fontSize: 19, fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: 16, fontWeight: 600, lineHeight: 1.35 },
    h4: { fontSize: 15, fontWeight: 600 },
    h5: { fontSize: 15, fontWeight: 600 },
    h6: { fontSize: 14, fontWeight: 600 },
    subtitle1: { fontSize: 14, fontWeight: 500 },
    subtitle2: { fontSize: 13, fontWeight: 600 },
    body1: { fontSize: 14 },
    body2: { fontSize: 13 },
    caption: { fontSize: 12 },
    overline: { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' },
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
    MuiIconButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { rounded: { borderRadius: 8 }, outlined: ({ theme }) => ({ borderColor: theme.vars.palette.flaechen.rand }) },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiCardHeader: {
      styleOverrides: { root: ({ theme }) => ({ paddingBlock: 10, background: theme.vars.palette.flaechen.band, borderBottom: `1px solid ${theme.vars.palette.divider}` }), title: { fontSize: 15, fontWeight: 600 }, subheader: { fontSize: 13 } },
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
    MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiAutocomplete: { defaultProps: { size: 'small' } },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500, borderRadius: 4 }, sizeSmall: { height: 22, fontSize: 12 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 250 },
      styleOverrides: { tooltip: { fontSize: 12, background: farben.schiefer[800], borderRadius: 4, padding: '6px 10px' }, arrow: { color: farben.schiefer[800] } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 8 } },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 18, fontWeight: 600 } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiTableCell: {
      styleOverrides: {
        root: ({ theme }) => ({ borderColor: theme.vars.palette.divider, paddingBlock: 7 }),
        head: ({ theme }) => ({ fontSize: 12, fontWeight: 600, color: theme.vars.palette.text.primary, background: theme.vars.palette.flaechen.kopf, whiteSpace: 'nowrap', borderBottomColor: theme.vars.palette.flaechen.rand }),
      },
    },
    MuiTableRow: { styleOverrides: { root: ({ theme }) => ({ '&.MuiTableRow-hover:hover': { background: theme.vars.palette.action.hover } }) } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500, minHeight: 44 } } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 6 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiBadge: { styleOverrides: { badge: { fontWeight: 600 } } },
    MuiLink: { defaultProps: { underline: 'hover', color: 'secondary' } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44 }, indicator: ({ theme }) => ({ background: theme.vars.palette.secondary.main }) } },
  },
});
