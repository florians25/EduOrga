// Formatierte Tagestexte: nur b, i, u, br, p und span mit Farbe; alles andere wird Text (zusätzlich zur Bereinigung auf dem Server).
const ERLAUBT = new Set(['B', 'I', 'U', 'BR', 'P', 'SPAN']);

export function htmlBereinigt(html: string): string {
  const vorlage = document.createElement('template');
  vorlage.innerHTML = html;
  const reinigen = (knoten: Node) => {
    for (const k of [...knoten.childNodes]) {
      if (k.nodeType === Node.TEXT_NODE) continue;
      const el = k as HTMLElement;
      if (k.nodeType !== Node.ELEMENT_NODE || !ERLAUBT.has(el.tagName)) { k.replaceWith(document.createTextNode(k.textContent ?? '')); continue; }
      const farbe = el.tagName === 'SPAN' ? (el.getAttribute('style') ?? '').match(/^\s*color\s*:\s*(#[0-9a-f]{3,6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})\s*;?\s*$/i)?.[1] : null;
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
      if (farbe) el.style.color = farbe;
      reinigen(el);
    }
  };
  reinigen(vorlage.content);
  const div = document.createElement('div');
  div.append(vorlage.content);
  return div.innerHTML;
}
