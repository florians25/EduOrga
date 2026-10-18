// Kurze Hinweise (Fluent Toast) unten rechts und Fehlermeldungen. hinweis() ist von überall aufrufbar.
import { Toast, ToastTitle, Toaster, useToastController, type ToastIntent } from '@fluentui/react-components';
import type { ReactNode } from 'react';
import { melden, type MeldungArt } from '@/kern/ereignisse';

const TOASTER = 'studio-hinweise';
let ausgeben: ((inhalt: ReactNode, intent: ToastIntent, dauer: number) => void) | null = null;

const INTENT: Record<MeldungArt, ToastIntent> = { info: 'info', ok: 'success', warnung: 'warning', fehler: 'error' };

/** Kurzer Hinweis unten rechts (art: 'info' | 'ok' | 'warnung' | 'fehler'). */
export function hinweis(text: string, art: MeldungArt = 'info', dauer = 3500): void {
  melden('meldung', { text, art, angezeigt: true });
  ausgeben?.(<Toast><ToastTitle>{text}</ToastTitle></Toast>, INTENT[art], dauer);
}

/** Fehler (ApiFehler oder Exception) als Hinweis zeigen. */
export function fehlerMelden(f: unknown): void {
  console.error(f);
  if ((f as { status?: number })?.status === 401) return;
  hinweis((f as Error)?.message || String(f), 'fehler', 6000);
}

export function HinweisHost() {
  const { dispatchToast } = useToastController(TOASTER);
  ausgeben = (inhalt, intent, dauer) => dispatchToast(inhalt, { intent, timeout: dauer, position: 'bottom-end' });
  return <Toaster toasterId={TOASTER} position="bottom-end" limit={4} />;
}
