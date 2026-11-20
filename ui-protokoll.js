import { el, knopf, karte, feld, raster } from "./ui.js";
import { detailAnsicht, postenFuer } from "./ui-erfassen.js";
import { wochenstart, monatsstart, heute, formatDatum } from "./datum.js";

const GRENZE = 200;

const ZEITRAEUME = [
  { schluessel: "alles", text: "Alles" },
  { schluessel: "woche", text: "Diese Woche" },
  { schluessel: "monat", text: "Dieser Monat" }
];

function seitWann(schluessel) {
  if (schluessel === "woche") return wochenstart(heute());
  if (schluessel === "monat") return monatsstart(heute());
  return null;
}

export function rendern(ctx) {
  const detail = detailAnsicht(ctx);
  if (detail) return detail;

  const v = ctx.ansicht;
  if (v.typFilter && !ctx.daten.listen.typ.includes(v.typFilter)) v.typFilter = "";
  let liste = [...ctx.daten.anlagen]
    .sort((x, y) => y.datum.localeCompare(x.datum) || y.erstellt - x.erstellt);
  // "Nur offene Fehler" ist eine Arbeitsliste und gewinnt gegen den Zeitraum.
  // Ein offener Punkt aus einem aelteren Monat darf nicht unsichtbar werden,
  // nur weil der Zeitraum gerade auf dieser Woche steht.
  const von = v.nurOffene ? null : seitWann(v.protokollZeitraum);
  if (von) liste = liste.filter(a => a.datum >= von);
  if (v.typFilter) liste = liste.filter(a => a.typ === v.typFilter);
  if (v.nurMitFehlern) liste = liste.filter(a => a.fehler.length > 0);
  if (v.nurOffene) liste = liste.filter(a => a.fehler.some(f => f.status === "offen"));

  const gezeigt = liste.slice(0, GRENZE);
  const auswahl = el("select", {
    onchange: e => { v.typFilter = e.target.value; ctx.zeichne(); }
  }, ["", ...ctx.daten.listen.typ].map(t =>
    el("option", { value: t, text: t || "alle Typen", selected: v.typFilter === t })));

  return el("div", {}, [
    el("h1", { text: "Protokoll" }),
    karte([
      el("div", { class: "marke", text: "Zeitraum" }),
      raster(ZEITRAEUME.map(z => z.text),
        ZEITRAEUME.find(z => z.schluessel === v.protokollZeitraum)?.text ?? "Alles",
        text => {
          v.protokollZeitraum = ZEITRAEUME.find(z => z.text === text).schluessel;
          ctx.zeichne();
        }, "breit"),
      feld("Anlagentyp", auswahl),
      knopf(v.nurMitFehlern ? "Nur mit Fehlern" : "Auch fehlerfreie", () => {
        v.nurMitFehlern = !v.nurMitFehlern;
        ctx.zeichne();
      }, v.nurMitFehlern ? "haupt" : ""),
      knopf(v.nurOffene ? "Nur offene Fehler" : "Alle Anlagen", () => {
        v.nurOffene = !v.nurOffene;
        ctx.zeichne();
      }, v.nurOffene ? "haupt" : "")
    ], "mt"),
    el("p", { class: "neben", text: `${liste.length} von ${ctx.daten.anlagen.length} Anlagen` }),
    von ? el("p", { class: "neben", text: `Gefiltert ab ${formatDatum(von)}` }) : null,
    v.nurOffene && v.protokollZeitraum !== "alles"
      ? el("p", { class: "neben", text: "Der Zeitraum gilt hier nicht, offene Fehler werden immer vollständig gezeigt." })
      : null,
    ...gezeigt.map(a => postenFuer(ctx, a)),
    liste.length === 0
      ? el("p", { class: "leer", text: "Keine Anlage passt zu diesem Filter." })
      : null,
    liste.length > GRENZE
      ? el("p", { class: "leer", text: `Es werden die neuesten ${GRENZE} gezeigt. Für die vollständige Auswertung den CSV-Export nutzen.` })
      : null
  ]);
}
