// Fluent-Themes von UntPlan Studio: Markenfarbe Marine (#234f96) als BrandVariants-Rampe (Stufe 80 = Primärfarbe),
// Schrift IBM Plex Sans (design/fonts), helles und dunkles Thema. Abgeleitet aus design/tokens.css (--up-marine-*).
import { createDarkTheme, createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';

export const marine: BrandVariants = {
  10: '#03080f',
  20: '#07111f',
  30: '#0b1a31',
  40: '#11264a', // --up-marine-900
  50: '#142c55',
  60: '#173261', // --up-marine-800
  70: '#1c3f7a', // --up-marine-700 (Hover)
  80: '#234f96', // --up-marine-600 (Primär)
  90: '#3364b0', // --up-marine-500
  100: '#4473bc',
  110: '#5582c8', // --up-marine-400
  120: '#6d94d2',
  130: '#86a7dc', // --up-marine-300
  140: '#b6cbec', // --up-marine-200
  150: '#dce6f6', // --up-marine-100
  160: '#eef3fb', // --up-marine-50
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

export const hellesThema: Theme = anpassen(createLightTheme(marine));

const dunkel = createDarkTheme(marine);
export const dunklesThema: Theme = anpassen({
  ...dunkel,
  colorBrandForeground1: marine[110],
  colorBrandForeground2: marine[120],
  colorBrandForegroundLink: marine[120],
});
