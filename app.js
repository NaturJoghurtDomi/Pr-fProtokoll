import { laden, speichern, zeitStopp, zeitOffen, vergesseneLaeufe } from "./store.js";
import { heute, isoDatum, tageDiff, formatUhr } from "./datum.js";
import { el } from "./ui.js";
import { rendern as erfassen } from "./ui-erfassen.js";
import { rendern as protokoll } from "./ui-protokoll.js";
import { rendern as statistik } from "./ui-statistik.js";
import { rendern as daten } from "./ui-daten.js";

const REITER = [
  { name: "erfassen", titel: "Erfassen", rendern: erfassen },
  { name: "protokoll", titel: "Protokoll", rendern: protokoll },
  { name: "statistik", titel: "Statistik", rendern: statistik },
  { name: "daten", titel: "Daten", rendern: daten }
];

// Liefert den echten Seitenspeicher, oder einen Ersatz im Arbeitsspeicher,
// falls schon der Zugriff auf localStorage wirft (z. B. bei gesperrtem
// Seitenspeicher in Chrome). Ohne diese Absicherung bleibt der Schirm weiß.
export function nutzbarerSpeicher() {
  try {
    return { speicher: localStorage, ersatz: false };
  } catch {
    const merker = new Map();
    return {
      speicher: {
        getItem: k => (merker.has(k) ? merker.get(k) : null),
        setItem: (k, v) => merker.set(k, String(v))
      },
      ersatz: true
    };
  }
}

const { speicher, ersatz } = nutzbarerSpeicher();
const ERSATZ_HINWEIS = "Der Seitenspeicher ist gesperrt. Du kannst weiterarbeiten, aber ohne Export sind die Daten nach dem Schließen weg.";

export const ctx = {
  daten: laden(speicher),
  speicherfehler: ersatz ? ERSATZ_HINWEIS : null,
  ansicht: {
    reiter: "erfassen",
    neu: null,
    anlageId: null,
    fehlerFluss: null,
    zeitraum: "monat",
    von: null,
    bis: null,
    mass: "anzahl",
    mitNummer: false,
    nurOffene: false,
    nurMitFehlern: false,
    protokollZeitraum: "alles",
    typFilter: ""
  },
  anlage() {
    return ctx.daten.anlagen.find(a => a.id === ctx.ansicht.anlageId) ?? null;
  },
  sichern(neuZeichnen = true) {
    const r = speichern(speicher, ctx.daten);
    ctx.speicherfehler = ersatz ? ERSATZ_HINWEIS : (r.ok ? null : (r.grund === "voll"
      ? "Der Speicher ist voll. Exportiere jetzt eine Sicherung im Reiter Daten."
      : "Der Browser lässt kein Speichern zu. Exportiere jetzt eine Sicherung im Reiter Daten."));
    if (neuZeichnen || ctx.speicherfehler) ctx.zeichne();
  },
  reiter(name) {
    if (ctx.ansicht.fehlerFluss && !window.confirm("Die begonnene Fehlererfassung verwerfen?")) return;
    ctx.ansicht.reiter = name;
    ctx.ansicht.neu = null;
    ctx.ansicht.fehlerFluss = null;
    ctx.ansicht.anlageId = null;
    ctx.zeichne(true);
  },
  zeichne(nachOben = false) {
    const reiter = REITER.find(r => r.name === ctx.ansicht.reiter) ?? REITER[0];
    document.getElementById("inhalt").replaceChildren(reiter.rendern(ctx));
    zeichneBand();
    zeichneLeiste();
    if (nachOben) window.scrollTo(0, 0);
  }
};

function hinweis() {
  const knopfDaten = { text: "Zu Daten", beiKlick: () => ctx.reiter("daten") };
  if (ctx.speicherfehler) return { art: "hart", text: ctx.speicherfehler, knopf: knopfDaten };
  if (ctx.daten.anlagen.length === 0) return null;
  if (!ctx.daten.letzterExport) {
    return { art: "sanft", text: "Noch keine Sicherung exportiert.", knopf: knopfDaten };
  }
  const tage = tageDiff(isoDatum(new Date(ctx.daten.letzterExport)), heute());
  if (tage >= 7) {
    return { art: "sanft", text: `Letzter Export vor ${tage} Tagen.`, knopf: knopfDaten };
  }
  return null;
}

function zeichneBand() {
  const band = document.getElementById("band");
  const h = hinweis();
  band.className = h?.art === "sanft" ? "sanft" : "";
  band.replaceChildren();
  if (!h) return;
  band.append(el("span", { text: h.text }));
  if (h.knopf) band.append(el("button", { type: "button", text: h.knopf.text, onclick: h.knopf.beiKlick }));
}

function zeichneLeiste() {
  document.getElementById("reiter").replaceChildren(...REITER.map(r =>
    el("button", {
      class: ctx.ansicht.reiter === r.name ? "an" : "",
      type: "button", text: r.titel, onclick: () => ctx.reiter(r.name)
    })));
}

for (const a of vergesseneLaeufe(ctx.daten)) {
  const uebernehmen = window.confirm(
    `Bei ${a.typ} ${a.nummer} läuft die Fehlersuche seit über acht Stunden. ` +
    `Mit OK wird die Zeit übernommen, mit Abbrechen verworfen.`);
  if (uebernehmen) zeitStopp(a);
  else a.laufStart = null;
}
ctx.sichern(false);

setInterval(() => {
  for (const n of document.querySelectorAll("[data-timer]")) {
    const a = ctx.daten.anlagen.find(x => x.id === n.dataset.timer);
    if (a?.laufStart) n.textContent = formatUhr(zeitOffen(a, Date.now()));
  }
}, 1000);

ctx.zeichne();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
