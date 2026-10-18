// Symbole (Fluent UI Icons) unter fachlichen Namen – für die Bereiche der Navigation und für Funktionen.
import {
  Home20Regular, PeopleSwap20Regular, CalendarStar20Regular, CalendarLtr20Regular, DocumentPrint20Regular, Database20Regular,
  BookOpen20Regular, Wrench20Regular, HatGraduation20Regular, DataBarVertical20Regular, ArrowSwap20Regular, Building20Regular,
  Folder20Regular, type FluentIcon,
} from '@fluentui/react-icons';

export const NAV_SYMBOLE: Record<string, FluentIcon> = {
  uebersicht: Home20Regular,
  vertretung: PeopleSwap20Regular,
  ereignisse: CalendarStar20Regular,
  stundenplan: CalendarLtr20Regular,
  ausgabe: DocumentPrint20Regular,
  stammdaten: Database20Regular,
  unterricht: BookOpen20Regular,
  planung: Wrench20Regular,
  oberstufe: HatGraduation20Regular,
  auswertung: DataBarVertical20Regular,
  austausch: ArrowSwap20Regular,
  schule: Building20Regular,
  dateien: Folder20Regular,
};
