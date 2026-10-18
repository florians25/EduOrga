// Drag & Drop (dnd-kit) für die ganze Arbeitsfläche: ein gemeinsamer Kontext, damit zwischen Bereichen eines Arbeitsplatzes
// gezogen werden kann (z. B. Vormerkung in einen Tagesplan, Stunde vom Klassen- in den Lehrkräfteplan).
//
// Ziehbare Elemente tragen ZiehDaten (art + fachliche Angaben, beimStart/beimEnde), Ablagen tragen AblageDaten
// (annehmen, ablegen). Beim Loslassen über einer Ablage, die annimmt, wird ablegen(daten) gerufen.
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useSensor, useSensors,
  type DragEndEvent, type DragMoveEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { makeStyles, tokens } from '@fluentui/react-components';
import { useState, type ReactNode } from 'react';
import { create } from 'zustand';

export interface ZiehDaten {
  art: string;
  /** Vorschau am Mauszeiger */
  vorschau?: () => ReactNode;
  /** Beginn des Ziehens (Ereignis mit Modifikatortasten und Ausgangsposition); darf die Daten ergänzen */
  beimStart?: (e: DragStartEvent) => void;
  beimEnde?: () => void;
  [k: string]: unknown;
}

export interface AblageDaten {
  annehmen: (d: ZiehDaten) => boolean;
  ablegen: (d: ZiehDaten) => void;
}

/** Laufender Ziehvorgang und Mausposition (für Hinweise am Mauszeiger). */
export const useZiehen = create<{ aktiv: ZiehDaten | null; x: number; y: number; ueber: string | null }>(() => ({ aktiv: null, x: 0, y: 0, ueber: null }));

const useStile = makeStyles({
  vorschau: {
    pointerEvents: 'none', opacity: 0.92, boxShadow: tokens.shadow16, borderRadius: '4px', cursor: 'grabbing',
    backgroundColor: tokens.colorNeutralBackground1, maxWidth: '220px',
  },
});

export function ZiehKontext({ children }: { children: ReactNode }) {
  const s = useStile();
  const sensoren = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const [aktiv, setAktiv] = useState<ZiehDaten | null>(null);
  const start = (e: DragStartEvent) => {
    const d = e.active.data.current as ZiehDaten | undefined;
    if (!d) return;
    d.beimStart?.(e);
    setAktiv(d);
    const p = e.activatorEvent as PointerEvent;
    useZiehen.setState({ aktiv: d, x: p.clientX ?? 0, y: p.clientY ?? 0, ueber: null });
  };
  const bewegen = (e: DragMoveEvent) => {
    const p = e.activatorEvent as PointerEvent;
    useZiehen.setState({ x: (p.clientX ?? 0) + e.delta.x, y: (p.clientY ?? 0) + e.delta.y, ueber: e.over ? String(e.over.id) : null });
  };
  const ende = (e: DragEndEvent) => {
    const d = e.active.data.current as ZiehDaten | undefined;
    const ablage = e.over?.data.current as AblageDaten | undefined;
    setAktiv(null);
    useZiehen.setState({ aktiv: null, ueber: null });
    d?.beimEnde?.();
    if (d && ablage?.annehmen(d)) ablage.ablegen(d);
  };
  const abbrechen = () => {
    aktiv?.beimEnde?.();
    setAktiv(null);
    useZiehen.setState({ aktiv: null, ueber: null });
  };
  return (
    <DndContext sensors={sensoren} collisionDetection={pointerWithin} onDragStart={start} onDragMove={bewegen} onDragEnd={ende} onDragCancel={abbrechen}
      accessibility={{ screenReaderInstructions: { draggable: 'Leertaste zum Aufnehmen, Pfeiltasten zum Verschieben, Leertaste zum Ablegen, Esc bricht ab.' } }}>
      {children}
      <DragOverlay dropAnimation={null}>{aktiv?.vorschau ? <div className={s.vorschau}>{aktiv.vorschau()}</div> : null}</DragOverlay>
    </DndContext>
  );
}
