// MUI-Thema nach dem UntPlan-Designsystem (design/tokens.css): Marine als einzige Akzentfarbe, Schiefer für Flächen und Linien,
// fachliche Statusfarben (Entfall, Änderung, Prüfung, Termin, frei). Sachlicher Stil: Knöpfe und Felder Radius 6, Karten 8, Plaketten 3,
// Segmentschalter mit 1-px-Rahmen; sx-Radien rechnen mit 4 px je Einheit.
import { createTheme, alpha } from '@mui/material/styles';

export const farben = {
  marine: { 50: '#eef3fb', 100: '#dce6f6', 200: '#b6cbec', 300: '#86a7dc', 400: '#5582c8', 500: '#3364b0', 600: '#234f96', 700: '#1c3f7a', 800: '#173261', 900: '#11264a' },
  schiefer: { 0: '#ffffff', 25: '#fafbfc', 50: '#f4f6f8', 100: '#ebeef2', 200: '#dce1e7', 300: '#c3cad3', 400: '#98a2af', 500: '#6b7684', 600: '#4d5866', 700: '#37404c', 800: '#232a33', 900: '#151a21' },
  entfall: '#b42318', entfallFlaeche: '#fdf0ef',
  aenderung: '#0b7a75', aenderungFlaeche: '#e7f5f4',
  pruefung: '#a15c07', pruefungFlaeche: '#fdf4e3',
  termin: '#5a4fb3', terminFlaeche: '#f1effb',
  frei: '#2f6f9f', freiFlaeche: '#edf4fa',
  ok: '#1d7a46', okFlaeche: '#e9f6ee',
} as const;

export interface StatusFarbe { main: string; flaeche: string }
/** Flächen des Stundenplans: Kachel, kräftigere Kachellinie, Kopf/Zeitspalte, Überfahren, Pausenband. */
export interface KachelFarben { flaeche: string; rand: string; kopf: string; hover: string; pause: string }
declare module '@mui/material/styles' {
  interface Palette {
    status: { entfall: StatusFarbe; aenderung: StatusFarbe; pruefung: StatusFarbe; termin: StatusFarbe; frei: StatusFarbe; ok: StatusFarbe };
    marine: typeof farben.marine;
    kachel: KachelFarben;
  }
  interface PaletteOptions {
    status?: Palette['status'];
    marine?: typeof farben.marine;
    kachel?: KachelFarben;
  }
}

export const SCHRIFT = '"IBM Plex Sans", -apple-system, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';

const status = (dunkel: boolean) => ({
  entfall: { main: dunkel ? '#f07167' : farben.entfall, flaeche: dunkel ? '#2c1715' : farben.entfallFlaeche },
  aenderung: { main: dunkel ? '#3cc2b9' : farben.aenderung, flaeche: dunkel ? '#0f2826' : farben.aenderungFlaeche },
  pruefung: { main: dunkel ? '#e9a640' : farben.pruefung, flaeche: dunkel ? '#2a2010' : farben.pruefungFlaeche },
  termin: { main: dunkel ? '#9f95f0' : farben.termin, flaeche: dunkel ? '#1f1c35' : farben.terminFlaeche },
  frei: { main: dunkel ? '#78b3e0' : farben.frei, flaeche: dunkel ? '#132231' : farben.freiFlaeche },
  ok: { main: dunkel ? '#5ccf8c' : farben.ok, flaeche: dunkel ? '#11261a' : farben.okFlaeche },
});

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-thema' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: farben.marine[600], dark: farben.marine[700], light: farben.marine[400], contrastText: '#fff' },
        secondary: { main: farben.schiefer[600], contrastText: '#fff' },
        error: { main: farben.entfall },
        warning: { main: farben.pruefung },
        success: { main: farben.ok },
        info: { main: farben.frei },
        background: { default: '#eef1f4', paper: '#ffffff' },
        text: { primary: farben.schiefer[800], secondary: farben.schiefer[600], disabled: farben.schiefer[400] },
        divider: farben.schiefer[200],
        action: { hover: alpha(farben.schiefer[500], 0.08), selected: farben.marine[50] },
        status: status(false),
        kachel: { flaeche: '#f6f8fa', rand: '#c9d1db', kopf: '#f6f8fa', hover: '#edf0f4', pause: '#eef1f4' },
        marine: farben.marine,
      },
    },
    dark: {
      palette: {
        primary: { main: '#6f9be0', dark: '#8fb4ea', light: '#5582c8', contrastText: '#0f1318' },
        secondary: { main: '#b3bbc6' },
        error: { main: '#f07167' },
        warning: { main: '#e9a640' },
        success: { main: '#5ccf8c' },
        info: { main: '#78b3e0' },
        background: { default: '#0f1318', paper: '#161b22' },
        text: { primary: '#e6e9ee', secondary: '#b3bbc6', disabled: '#6b7684' },
        divider: '#2a323d',
        action: { hover: 'rgba(255,255,255,.06)', selected: '#17243a' },
        status: status(true),
        kachel: { flaeche: '#1b212a', rand: '#3a4452', kopf: '#1a2028', hover: '#232a35', pause: '#11161c' },
        marine: farben.marine,
      },
    },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: SCHRIFT,
    fontSize: 14,
    htmlFontSize: 16,
    h1: { fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.005em' },
    h3: { fontSize: 18, fontWeight: 600 },
    h4: { fontSize: 16, fontWeight: 600 },
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
        outlined: ({ theme }) => ({ borderColor: theme.vars.palette.divider, color: theme.vars.palette.text.primary, background: theme.vars.palette.background.paper,
          '&:hover': { borderColor: theme.vars.palette.text.disabled, background: theme.vars.palette.action.hover } }),
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
      styleOverrides: { rounded: { borderRadius: 8 }, outlined: ({ theme }) => ({ borderColor: theme.vars.palette.divider }) },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiCardHeader: {
      styleOverrides: { root: { paddingBottom: 8 }, title: { fontSize: 15, fontWeight: 600 }, subheader: { fontSize: 13 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({ borderRadius: 6, background: theme.vars.palette.background.paper,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.divider },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.vars.palette.text.disabled } }),
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
        root: ({ theme }) => ({ borderColor: theme.vars.palette.divider, paddingBlock: 8 }),
        head: ({ theme }) => ({ fontSize: 12, fontWeight: 600, color: theme.vars.palette.text.secondary, background: theme.vars.palette.background.default, whiteSpace: 'nowrap' }),
      },
    },
    MuiTableRow: { styleOverrides: { root: ({ theme }) => ({ '&.MuiTableRow-hover:hover': { background: theme.vars.palette.action.hover } }) } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500, minHeight: 44 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44 } } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 6 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 6 } } },
    MuiBadge: { styleOverrides: { badge: { fontWeight: 600 } } },
    MuiLink: { defaultProps: { underline: 'hover' } },
  },
});
