import { createLightTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

// EduOrga-Petrol als Fluent-Markenreihe (80 = Primärfarbe #164C55, 100 = Akzent #28747A), siehe design/MARKE.md
const petrol: BrandVariants = {
  10: "#021215",
  20: "#051c20",
  30: "#08262b",
  40: "#0b3036",
  50: "#0d363c",
  60: "#103f46",
  70: "#12434b",
  80: "#164c55",
  90: "#1d5f66",
  100: "#28747a",
  110: "#4f9298",
  120: "#7fb3b8",
  130: "#aed1d4",
  140: "#d6e8ea",
  150: "#eef5f6",
  160: "#f7fbfb",
};

const schrift = '"IBM Plex Sans", -apple-system, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';

export const thema: Theme = {
  ...createLightTheme(petrol),
  fontFamilyBase: schrift,
  colorNeutralForeground1: "#24363b",
  colorBrandForegroundLink: "#28747a",
  colorBrandForegroundLinkHover: "#164c55",
  colorStrokeFocus2: "#28747a",
  borderRadiusMedium: "4px",
  borderRadiusLarge: "6px",
};
