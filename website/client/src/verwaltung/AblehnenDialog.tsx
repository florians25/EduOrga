import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Textarea } from "@fluentui/react-components";
import type { AdminEintrag } from "../api";

/** Ablehnen braucht eine Begründung (wird intern im Verlauf festgehalten). */
export function AblehnenDialog({ eintrag, onAbbrechen, onAblehnen }: { eintrag: AdminEintrag | null; onAbbrechen: () => void; onAblehnen: (grund: string) => void }) {
  const [grund, setGrund] = useState("");
  useEffect(() => setGrund(""), [eintrag?.id]);
  return (
    <Dialog open={eintrag !== null} onOpenChange={(_, d) => !d.open && onAbbrechen()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>#{eintrag?.id} ablehnen</DialogTitle>
          <DialogContent className="dialog-felder">
            <p className="dialog-text">{eintrag?.titel}</p>
            <Field label="Begründung" required hint="Wird im Verlauf festgehalten. Für die Einreichenden bei Bedarf zusätzlich eine öffentliche Antwort hinterlegen.">
              <Textarea value={grund} onChange={(_, d) => setGrund(d.value)} rows={4} autoFocus />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={onAbbrechen}>Abbrechen</Button>
            <Button appearance="primary" disabled={grund.trim().length === 0} onClick={() => onAblehnen(grund.trim())}>
              Ablehnen
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
