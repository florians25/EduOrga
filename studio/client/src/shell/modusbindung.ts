// Seiten, die zu einem Arbeitsmodus gehören (z. B. Tagesplanung → Vertretungsplanung): Beim Öffnen wird der Modus
// eingestellt; wechselt der Benutzer danach den Modus (Kopfleiste), führt die Shell zur Übersicht des neuen Modus.
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { modusSetzen, useStudio, zustand, type Modus } from '@/kern/zustand';

export function useModusBindung(seitenModus: Modus | undefined, kennung: string | undefined) {
  const modus = useStudio((x) => x.modus);
  const navigate = useNavigate();
  const vorher = useRef(modus);
  // beim Öffnen der Seite: passenden Modus einstellen
  useEffect(() => {
    if (seitenModus && seitenModus !== zustand().modus) modusSetzen(seitenModus);
    vorher.current = zustand().modus;
  }, [seitenModus, kennung]);
  // Moduswechsel durch den Benutzer: Seite gehört nicht zum neuen Modus → Übersicht
  useEffect(() => {
    // veralteter Wert aus dieser Darstellung (z. B. gerade beim Öffnen umgestellt): nicht als Wechsel des Benutzers werten
    if (modus !== zustand().modus || vorher.current === modus) return;
    vorher.current = modus;
    if (seitenModus && seitenModus !== modus) navigate('/');
  }, [modus]); // eslint-disable-line react-hooks/exhaustive-deps
}
