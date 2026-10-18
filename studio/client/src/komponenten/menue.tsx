// Menüs (Fluent Menu): Kontextmenü an einer Mausposition (menue(x, y, eintraege)) und Menüknöpfe in Werkzeugleisten.
// Einträge: { text, aktion, deaktiviert, haken, taste, menue } | { titel } | null (Trenner).
// menue kann eine Liste oder eine Funktion sein, die die Liste (auch asynchron) liefert.
import {
  Menu, MenuDivider, MenuGroupHeader, MenuItem, MenuList, MenuPopover, MenuTrigger, ToolbarButton, MenuButton, Spinner,
  type PositioningVirtualElement,
} from '@fluentui/react-components';
import { Checkmark16Regular, ChevronDown16Regular } from '@fluentui/react-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { fehlerMelden } from './hinweise';

export interface MenuePunkt {
  text: string;
  aktion?: () => unknown;
  deaktiviert?: boolean;
  /** Haken-Eintrag: true/false zeigt bzw. reserviert den Haken. */
  haken?: boolean;
  taste?: string;
  menue?: MenueListe | (() => MenueListe | Promise<MenueListe>);
  hinweis?: string;
}
export interface MenueTitel { titel: string }
export type MenueEintrag = MenuePunkt | MenueTitel | null | undefined | false;
export type MenueListe = MenueEintrag[];

/** Trenner am Anfang, am Ende und doppelte Trenner entfernen; leere Einträge entfernen. */
export function bereinigen(liste: MenueListe): (MenuePunkt | MenueTitel | null)[] {
  const l = liste.filter((e) => e !== undefined && e !== false) as (MenuePunkt | MenueTitel | null)[];
  const erg: (MenuePunkt | MenueTitel | null)[] = [];
  for (const e of l) {
    if (e === null && (erg.length === 0 || erg[erg.length - 1] === null)) continue;
    erg.push(e);
  }
  while (erg.length && erg[erg.length - 1] === null) erg.pop();
  return erg;
}

function ausfuehren(p: MenuePunkt) {
  Promise.resolve().then(() => p.aktion?.()).catch(fehlerMelden);
}

function Untermenue({ p }: { p: MenuePunkt }) {
  const [liste, setListe] = useState<MenueListe | null>(Array.isArray(p.menue) ? p.menue : null);
  useEffect(() => {
    if (Array.isArray(p.menue) || !p.menue) return;
    let aktiv = true;
    Promise.resolve(p.menue()).then((l) => { if (aktiv) setListe(l); }).catch(() => { if (aktiv) setListe([{ text: 'Nicht verfügbar', deaktiviert: true }]); });
    return () => { aktiv = false; };
  }, [p]);
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <MenuItem disabled={p.deaktiviert}>{p.text}</MenuItem>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>{liste ? eintraegeRendern(liste) : <MenuItem disabled icon={<Spinner size="extra-tiny" />}>wird berechnet …</MenuItem>}</MenuList>
      </MenuPopover>
    </Menu>
  );
}

/** Einträge als Fluent-Menüelemente. */
export function eintraegeRendern(liste: MenueListe): ReactNode[] {
  const l = bereinigen(liste);
  const mitHaken = l.some((e) => e && 'text' in e && e.haken !== undefined);
  return l.map((e, i) => {
    if (e === null) return <MenuDivider key={`t${i}`} />;
    if ('titel' in e) return <MenuGroupHeader key={`g${i}`}>{e.titel}</MenuGroupHeader>;
    if (e.menue) return <Untermenue key={`u${i}`} p={e} />;
    return (
      <MenuItem key={`e${i}`} disabled={e.deaktiviert} title={e.hinweis}
        icon={mitHaken ? (e.haken ? <Checkmark16Regular /> : <span style={{ width: 16, display: 'inline-block' }} />) : undefined}
        secondaryContent={e.taste} onClick={() => ausfuehren(e)}>
        {e.text}
      </MenuItem>
    );
  });
}

// ---------------------------------------------------------------------------------------------
// Kontextmenü an einer Position

const useKontext = create<{ offen: boolean; x: number; y: number; liste: MenueListe; nr: number }>(() => ({ offen: false, x: 0, y: 0, liste: [], nr: 0 }));

/** Zeigt ein Menü an Position (x, y). */
export function menue(x: number, y: number, liste: MenueListe): void {
  if (!bereinigen(liste).length) return;
  useKontext.setState((s) => ({ offen: true, x, y, liste, nr: s.nr + 1 }));
}

export function menueSchliessen() { useKontext.setState({ offen: false }); }

export function KontextmenueHost() {
  const { offen, x, y, liste, nr } = useKontext();
  const ziel: PositioningVirtualElement = { getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 } as DOMRect) };
  return (
    <Menu key={nr} open={offen} onOpenChange={(_, d) => { if (!d.open) menueSchliessen(); }} positioning={{ target: ziel, position: 'below', align: 'start', offset: 2 }}>
      <MenuPopover>
        <MenuList>{eintraegeRendern(liste)}</MenuList>
      </MenuPopover>
    </Menu>
  );
}

// ---------------------------------------------------------------------------------------------
// Menüknopf (Werkzeugleiste)

export interface MenueKnopfProps {
  text: string;
  eintraege: MenueListe | (() => MenueListe | Promise<MenueListe>);
  titel?: string;
  /** In einer Fluent-Toolbar (ToolbarButton) oder als normaler Knopf. */
  art?: 'toolbar' | 'knopf';
  icon?: JSX.Element;
  appearance?: 'subtle' | 'secondary' | 'transparent' | 'primary';
  deaktiviert?: boolean;
}

export function MenueKnopf({ text, eintraege, titel, art = 'toolbar', icon, appearance, deaktiviert }: MenueKnopfProps) {
  const [liste, setListe] = useState<MenueListe>([]);
  const oeffnen = async (offen: boolean) => {
    if (!offen) return;
    setListe(typeof eintraege === 'function' ? await eintraege() : eintraege);
  };
  const knopf = art === 'toolbar'
    ? <ToolbarButton title={titel || text} icon={icon} disabled={deaktiviert}>{text}<ChevronDown16Regular style={{ marginLeft: 4 }} /></ToolbarButton>
    : <MenuButton title={titel || text} icon={icon} appearance={appearance} disabled={deaktiviert} menuIcon={<ChevronDown16Regular />}>{text}</MenuButton>;
  return (
    <Menu onOpenChange={(_, d) => { void oeffnen(d.open); }}>
      <MenuTrigger disableButtonEnhancement={art === 'toolbar'}>{knopf}</MenuTrigger>
      <MenuPopover>
        <MenuList>{eintraegeRendern(liste)}</MenuList>
      </MenuPopover>
    </Menu>
  );
}
