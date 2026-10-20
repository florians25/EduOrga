/* =====================================================================
   api-db.js — Anbindung an api/mobile (Daten aus UntPlanWeb)
   ---------------------------------------------------------------------
   Der Endpunkt liefert bereits fertige Kacheln. Hier passiert nur noch
   Transport, Zwischenspeicher und ein sauberer Rückfall auf die zuletzt
   geladene Woche, wenn das Netz fehlt.
   ===================================================================== */

const TT_DB = (() => {
  let BASE = 'api/mobile';
  let live = false;

  const configure = o => { if (o && o.base) BASE = o.base; };
  const isLive    = () => live;

  const url = params => {
    const u = new URL(BASE, location.href);
    Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined) u.searchParams.set(k, v); });
    return u.toString();
  };

  async function call(params){
    /* Immer frisch vom Server (kein HTTP-Cache). Ohne Netz antwortet der
       Service Worker mit der zuletzt geladenen Kopie und dem Kopf
       „X-EduOrga-Stand“ (Zeitpunkt des Abrufs) – die App zeigt dann
       „Offline — Stand hh:mm“. */
    const res = await fetch(url(params), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (res.status === 401) { const e = new Error('not_authenticated'); e.auth = true; throw e; }

    /* Antwort auch im Fehlerfall lesen — sonst steht am Ende nur „offline“,
       obwohl der Server einen konkreten Fehler gemeldet hat. */
    let data = null;
    try { data = await res.json(); } catch (e){ /* keine JSON-Antwort */ }

    if (!res.ok || !data || data.ok !== true){
      const err = new Error((data && (data.detail || data.error)) || ('HTTP ' + res.status));
      err.server = true;
      err.status = res.status;
      throw err;
    }
    const stand = res.headers.get('X-EduOrga-Stand');
    if (stand){
      const t = new Date(stand);
      data._stand = isNaN(t) ? stand : t.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
    }
    return data;
  }

  /* Stammdaten. Gelingt der Aufruf, läuft die App ab jetzt auf echten Daten. */
  async function meta(){
    const d = await call({ action: 'meta' });
    live = true;
    return d;
  }

  async function week(entity, weekStart){
    return call({
      action: 'week',
      date:   weekStart,
      type:   entity.type,
      id:     entity.type === 'mine' ? null : entity.id
    });
  }

  return { configure, isLive, meta, week };
})();

window.TT_DB = TT_DB;

/* Ein zweiter Datenweg (Auslesen einer Desktopseite) gibt es in UntPlan
   Mobile nicht. app.js fragt ihn trotzdem ab; der Platzhalter sagt
   „nicht aktiv“. */
window.TT_API = {
  configure(){}, isLive: () => false,
  fetchWeek: async () => { throw new Error('nicht verfügbar'); },
  fetchEntities: async () => []
};
