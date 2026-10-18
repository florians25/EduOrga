// Gemeinsame Bausteine des Buchungsmoduls: Texte, Symbole der Ressourcen, Storno-Dialog, Optionen.
import { useState, type ReactElement } from 'react';
import { FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import BackpackOutlined from '@mui/icons-material/BackpackOutlined';
import BuildOutlined from '@mui/icons-material/BuildOutlined';
import CoPresentOutlined from '@mui/icons-material/CoPresentOutlined';
import DesktopWindowsOutlined from '@mui/icons-material/DesktopWindowsOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import LaptopOutlined from '@mui/icons-material/LaptopOutlined';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import MemoryOutlined from '@mui/icons-material/MemoryOutlined';
import MicNoneOutlined from '@mui/icons-material/MicNoneOutlined';
import MusicNoteOutlined from '@mui/icons-material/MusicNoteOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import RouterOutlined from '@mui/icons-material/RouterOutlined';
import ShoppingCartOutlined from '@mui/icons-material/ShoppingCartOutlined';
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined';
import SpeakerOutlined from '@mui/icons-material/SpeakerOutlined';
import SportsEsportsOutlined from '@mui/icons-material/SportsEsportsOutlined';
import TabletMacOutlined from '@mui/icons-material/TabletMacOutlined';
import TvOutlined from '@mui/icons-material/TvOutlined';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import ViewInArOutlined from '@mui/icons-material/ViewInArOutlined';
import WidgetsOutlined from '@mui/icons-material/WidgetsOutlined';
import WifiOutlined from '@mui/icons-material/WifiOutlined';
import { api } from '../../api/client';
import { FormDialog, type Ton } from '../../components/Bausteine';
import { toast } from '../../lib/meldungen';

export const BASIS = '/api/app/buchen';
export const tagKurz = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
export const tagLang = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const stdText = (v: number, b: number) => (v === b ? `${v}. Std.` : `${v}.–${b}. Std.`);
export const tagIndex = (iso: string) => (new Date(iso + 'T12:00').getDay() + 6) % 7;
export const ART_NAME: Record<string, string> = { raum: 'Raumbuchung', ressource: 'Ressourcenbuchung', aktivitaet: 'Aktivität', unterricht: 'Zusätzlicher Unterricht' };
export const ART_TON: Record<string, Ton> = { raum: 'ok', ressource: 'termin', aktivitaet: 'pruefung', unterricht: 'neutral' };
export const WIEDERHOLUNG: [string, string][] = [['einmalig', 'Einmalig'], ['taeglich', 'Täglich'], ['woechentlich', 'Jede Woche'], ['2wochen', 'Jede 2. Woche'], ['3wochen', 'Jede 3. Woche'], ['4wochen', 'Jede 4. Woche']];
export const BELEGT_TEXT: Record<string, string> = { unterricht: 'Unterricht', klausur: 'Prüfung', termin: 'Termin', buchung: 'Buchung', vorgemerkt: 'vorgemerkt', gesperrt: 'gesperrt' };

export interface Zeitraster { nr: number; beginn: string; ende: string }
export interface Optionen {
  zeitraster: Zeitraster[]; tageProWoche: number; naechsterTag?: string; ich?: string; admin: boolean; raumBuchen?: boolean; ressourcenBuchen?: boolean;
  raeume: { kurz: string; name: string; raumart?: string; kapazitaet?: number; kapazitaetUntPlan?: number; buchbar?: boolean; gebaeude: string; abteilung: string; raumgruppe: string; ressourcen: string[] }[];
  ressourcen: { id: number; raum?: string }[]; gebaeude: string[]; raumarten: string[]; abteilungen: string[]; raumgruppen: string[]; ressourcenarten: { id: number; name: string }[];
}

/** Symbole (Namen wie in den Stammdaten) → Linien-Symbole der Oberfläche. */
export const SYMBOLE: Record<string, ReactElement> = {
  projector: <CoPresentOutlined />, laptop: <LaptopOutlined />, tablet: <TabletMacOutlined />, 'camera-video': <VideocamOutlined />, camera: <PhotoCameraOutlined />, speaker: <SpeakerOutlined />,
  mic: <MicNoneOutlined />, headphones: <HeadphonesOutlined />, display: <TvOutlined />, easel: <CoPresentOutlined />, 'pc-display': <DesktopWindowsOutlined />, printer: <PrintOutlined />,
  router: <RouterOutlined />, wifi: <WifiOutlined />, controller: <SportsEsportsOutlined />, 'badge-vr': <ViewInArOutlined />, robot: <SmartToyOutlined />, cpu: <MemoryOutlined />,
  lightbulb: <LightbulbOutlined />, tools: <BuildOutlined />, boxes: <WidgetsOutlined />, 'box-seam': <Inventory2Outlined />, cart3: <ShoppingCartOutlined />, bag: <BackpackOutlined />,
  'music-note-beamed': <MusicNoteOutlined />, globe2: <LanguageOutlined />,
};
const RES_SYMBOLE: [RegExp, string][] = [[/beamer|projektor/i, 'projector'], [/laptop|notebook/i, 'laptop'], [/ipad|tablet/i, 'tablet'], [/dokumentenkamera|visualizer/i, 'camera-video'],
  [/kamera/i, 'camera'], [/lautsprecher|audio|musikanlage/i, 'speaker'], [/mikro/i, 'mic'], [/kopfh/i, 'headphones'], [/\bvr\b|vr-/i, 'badge-vr'],
  [/tafel|display|monitor|bildschirm|fernseh/i, 'display'], [/drucker/i, 'printer'], [/roboter|lego/i, 'robot'], [/internet|wlan/i, 'wifi']];
export const ressourcenSymbolName = (r: { symbol?: string; art?: string; name?: string }) => r.symbol || RES_SYMBOLE.find(([m]) => m.test(`${r.art ?? ''} ${r.name ?? ''}`))?.[1] || 'box-seam';
export const ResSymbol = ({ r }: { r: { symbol?: string; art?: string; name?: string } }) => SYMBOLE[ressourcenSymbolName(r)] ?? <Inventory2Outlined />;
const TOENE: Ton[] = ['primaer', 'termin', 'ok', 'aenderung', 'pruefung', 'entfall', 'frei'];
export const resTon = (r: { artId?: number | null }) => TOENE[(r.artId ?? 0) % TOENE.length];

export interface StornoZiel { id: number; titel?: string; artName?: string; datum: string; stundeVon: number; stundeBis: number; raum?: string | null; serie?: string | null }

/** Storno einer Buchung (einzeln bzw. Serie). fertig(n) mit der Zahl stornierter Termine. */
export function StornoDialog({ b, serienAnzahl = 0, onClose, fertig }: { b: StornoZiel; serienAnzahl?: number; onClose: () => void; fertig: (n: number) => void }) {
  const serie = !!b.serie && serienAnzahl > 1;
  const [umfang, setUmfang] = useState('termin');
  return (
    <FormDialog offen titel={serie ? 'Serie oder Termin stornieren' : 'Buchung stornieren'} onClose={onClose} aktionText="Stornieren" gefahr breite="xs" aktion={async () => {
      const r = await api<{ storniert?: number }>(`${BASIS}/${b.id}${umfang === 'serie' ? '?serie=true' : ''}`, { methode: 'DELETE' });
      const n = r?.storniert || 1;
      toast(n === 1 ? 'Termin storniert.' : `${n} Termine storniert.`);
      fertig(n);
    }}>
      <Typography sx={{ fontWeight: 600 }}>{b.titel || b.artName || 'Buchung'}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{tagLang(b.datum)} · {stdText(b.stundeVon, b.stundeBis)}{b.raum ? ` · ${b.raum}` : ''}</Typography>
      {serie ? (
        <RadioGroup value={umfang} onChange={e => setUmfang(e.target.value)}>
          <FormControlLabel value="termin" control={<Radio />} label={<Stack><b>Nur diesen Termin</b><Typography variant="caption" color="text.secondary">{tagKurz(b.datum)}</Typography></Stack>} />
          <FormControlLabel value="serie" control={<Radio />} label={<Stack><b>Alle kommenden Termine der Serie</b><Typography variant="caption" color="text.secondary">Serie mit {serienAnzahl} Terminen – vergangene bleiben erhalten</Typography></Stack>} />
        </RadioGroup>
      ) : <Typography variant="body2" color="text.secondary">Der Termin wird storniert und aus den Plänen entfernt.</Typography>}
    </FormDialog>
  );
}
