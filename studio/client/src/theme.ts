// Fluent-Themen von EduOrga Studio (Marke: design/MARKE.md, Werte: design/tokens.css).
// Markenrampe Petrol als BrandVariants (Stufe 80 = Primärfarbe #164C55 für Knöpfe und Auswahl, Stufe 100 = Akzent #28747A
// für Links und aktive Bereiche), Neutraltöne Schiefer mit kräftigeren Linien und Kopfflächen (Kontrast), eigenes dunkles
// Thema auf Schiefer-Petrol statt Fluent-Grau. Schrift IBM Plex Sans (design/fonts).
import { createDarkTheme, createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';

export const petrol: BrandVariants = {
  10: '#040d0f',
  20: '#071619',
  30: '#0a1f23',
  40: '#0c2c31', // --up-marine-900
  50: '#0e3339',
  60: '#113c43', // --up-marine-800 (Hover)
  70: '#134249',
  80: '#164c55', // --up-marine-700 (Primärfarbe)
  90: '#1d5f66', // --up-marine-600
  100: '#28747a', // --up-marine-500 (Akzentfarbe)
  110: '#4f9298', // --up-marine-400
  120: '#66a3a8',
  130: '#7fb3b8', // --up-marine-300
  140: '#aed1d4', // --up-marine-200
  150: '#d6e8ea', // --up-marine-100
  160: '#eef5f6', // --up-marine-50
};

const schrift = '"IBM Plex Sans", -apple-system, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';

function anpassen(t: Theme): Theme {
  return {
    ...t,
    fontFamilyBase: schrift,
    fontFamilyNumeric: schrift,
    borderRadiusMedium: '6px',
    borderRadiusLarge: '8px',
    borderRadiusXLarge: '8px',
  };
}

// Hell: Seite #F5F7F8, Flächen weiß, Kopfflächen und Tabellenköpfe deutlich grau, Linien #c9d1db statt Fluent-Hellgrau.
const hell = createLightTheme(petrol);
export const hellesThema: Theme = anpassen({
  ...hell,
  colorNeutralForeground1: '#24363b',
  colorNeutralForeground1Hover: '#15262b',
  colorNeutralForeground1Pressed: '#15262b',
  colorNeutralForeground1Selected: '#15262b',
  colorNeutralForeground2: '#3d4c55',
  colorNeutralForeground2Hover: '#24363b',
  colorNeutralForeground2Pressed: '#24363b',
  colorNeutralForeground2Selected: '#24363b',
  colorNeutralForeground3: '#5a6772',
  colorNeutralForeground4: '#6e7a85',
  colorNeutralForegroundDisabled: '#9aa4ad',
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground1Hover: '#f0f4f5',
  colorNeutralBackground1Pressed: '#e4ebed',
  colorNeutralBackground1Selected: '#e8eef0',
  colorNeutralBackground2: '#f5f7f8',
  colorNeutralBackground2Hover: '#eaeef1',
  colorNeutralBackground2Pressed: '#dfe5e9',
  colorNeutralBackground2Selected: '#e4e9ed',
  colorNeutralBackground3: '#e9edf0',
  colorNeutralBackground3Hover: '#dfe4e8',
  colorNeutralBackground3Pressed: '#d4dbe0',
  colorNeutralBackground3Selected: '#dae0e5',
  colorNeutralBackground4: '#e3e8ec',
  colorNeutralBackground4Hover: '#d8dfe4',
  colorNeutralBackground4Pressed: '#cdd5db',
  colorNeutralBackground4Selected: '#d3dadf',
  colorNeutralBackground5: '#dbe1e6',
  colorNeutralBackground6: '#d2d9df',
  colorSubtleBackgroundHover: '#e1e7ea',
  colorSubtleBackgroundPressed: '#d3dcdf',
  colorSubtleBackgroundSelected: '#e3e9ec',
  colorNeutralStroke1: '#b4bec8',
  colorNeutralStroke1Hover: '#98a4af',
  colorNeutralStroke1Pressed: '#8794a0',
  colorNeutralStroke1Selected: '#98a4af',
  colorNeutralStroke2: '#c9d1db',
  colorNeutralStroke3: '#dde3e9',
  colorNeutralStrokeAccessible: '#6b7684',
  colorNeutralStrokeAccessibleHover: '#4d5866',
  colorBrandBackground: petrol[80],
  colorBrandBackgroundHover: petrol[60],
  colorBrandBackgroundPressed: petrol[40],
  colorBrandBackgroundSelected: petrol[70],
  colorBrandBackground2: '#e3eff0',
  colorBrandBackground2Hover: '#d3e6e8',
  colorBrandBackground2Pressed: '#bfdadd',
  colorBrandForeground1: petrol[80],
  colorBrandForeground2: petrol[90],
  colorBrandForegroundLink: petrol[100],
  colorBrandForegroundLinkHover: petrol[80],
  colorBrandForegroundLinkPressed: petrol[60],
  colorBrandStroke1: petrol[100],
  colorBrandStroke2: petrol[140],
  colorCompoundBrandForeground1: petrol[100],
  colorCompoundBrandBackground: petrol[100],
  colorCompoundBrandStroke: petrol[100],
  colorStrokeFocus2: petrol[80],
});

// Dunkel: Schiefer mit leichtem Petrolstich, Flächen klar gestuft (Seite < Fläche < Kopf), Linien sichtbar, Text hell genug.
const dunkel = createDarkTheme(petrol);
export const dunklesThema: Theme = anpassen({
  ...dunkel,
  colorNeutralForeground1: '#e7ecee',
  colorNeutralForeground1Hover: '#ffffff',
  colorNeutralForeground1Pressed: '#ffffff',
  colorNeutralForeground1Selected: '#ffffff',
  colorNeutralForeground2: '#c4cdd2',
  colorNeutralForeground2Hover: '#e7ecee',
  colorNeutralForeground2Pressed: '#e7ecee',
  colorNeutralForeground2Selected: '#e7ecee',
  colorNeutralForeground3: '#9ba8b0',
  colorNeutralForeground4: '#86939b',
  colorNeutralForegroundDisabled: '#5f6b73',
  colorNeutralBackground1: '#182126',
  colorNeutralBackground1Hover: '#202b31',
  colorNeutralBackground1Pressed: '#1c262c',
  colorNeutralBackground1Selected: '#243037',
  colorNeutralBackground2: '#141b1f',
  colorNeutralBackground2Hover: '#1c252a',
  colorNeutralBackground2Pressed: '#182024',
  colorNeutralBackground2Selected: '#1e282d',
  colorNeutralBackground3: '#202a30',
  colorNeutralBackground3Hover: '#27333a',
  colorNeutralBackground3Pressed: '#1d262b',
  colorNeutralBackground3Selected: '#26323a',
  colorNeutralBackground4: '#11171b',
  colorNeutralBackground4Hover: '#1a2227',
  colorNeutralBackground4Pressed: '#151c20',
  colorNeutralBackground4Selected: '#1b2429',
  colorNeutralBackground5: '#0d1215',
  colorNeutralBackground6: '#263138',
  colorNeutralBackgroundInverted: '#e7ecee',
  colorSubtleBackgroundHover: '#243036',
  colorSubtleBackgroundPressed: '#1d272c',
  colorSubtleBackgroundSelected: '#26323a',
  colorNeutralStroke1: '#4b5962',
  colorNeutralStroke1Hover: '#5f6e78',
  colorNeutralStroke1Pressed: '#6b7a84',
  colorNeutralStroke1Selected: '#5f6e78',
  colorNeutralStroke2: '#37434b',
  colorNeutralStroke3: '#2a343a',
  colorNeutralStrokeAccessible: '#9ba8b0',
  colorBrandBackground: petrol[100],
  colorBrandBackgroundHover: petrol[90],
  colorBrandBackgroundPressed: petrol[80],
  colorBrandBackgroundSelected: petrol[90],
  colorBrandBackground2: '#173338',
  colorBrandBackground2Hover: '#1c3c42',
  colorBrandBackground2Pressed: '#132b2f',
  colorBrandForeground1: petrol[130],
  colorBrandForeground2: petrol[140],
  colorBrandForegroundLink: petrol[130],
  colorBrandForegroundLinkHover: petrol[140],
  colorBrandForegroundLinkPressed: petrol[120],
  colorBrandStroke1: petrol[120],
  colorBrandStroke2: petrol[90],
  colorCompoundBrandForeground1: petrol[130],
  colorCompoundBrandForeground1Hover: petrol[140],
  colorCompoundBrandBackground: petrol[110],
  colorCompoundBrandBackgroundHover: petrol[120],
  colorCompoundBrandStroke: petrol[110],
  colorStrokeFocus2: '#cfe7e9',
});
