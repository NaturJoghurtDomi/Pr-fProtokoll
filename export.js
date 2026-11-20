import { kwLabel } from "./datum.js";
import { normalisiereAnlage, vereinigeNummern } from "./store.js";

export const CSV_SPALTEN = [
  "Datum", "KW", "Typ", "Nummer", "Typ und Nummer", "Auftrag", "Ausstattung",
  "Fehleranzahl Anlage", "Anlagenzähler", "Anlage mit Fehler", "Zeit ohne Fehlerbezug Minuten",
  "Fehlerzähler", "Fehlerart", "Verantwortlich", "Bauteil", "Befund", "Detail",
  "Status", "Behebungszeit Minuten", "Notiz"
];

export function csvFeld(wert) {
  const s = wert === null || wert === undefined ? "" : String(wert);
  return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function minuten(sekunden) {
  return ((sekunden || 0) / 60).toFixed(1).replace(".", ",");
}

export function csvZeilen(anlagen) {
  const zeilen = [];
  for (const a of anlagen.filter(x => x.status === "abgeschlossen")) {
    const mitFehler = a.fehler.length > 0 ? "1" : "0";
    const kopf = [
      a.datum, kwLabel(a.datum), a.typ, a.nummer, `${a.typ} ${a.nummer}`.trim(),
      a.auftrag ?? "", (a.ausstattung ?? []).join(", "), String(a.fehler.length)
    ];
    if (a.fehler.length === 0) {
      zeilen.push([...kopf, "1", mitFehler, minuten(a.sucheSekunden), "0", "", "", "", "", "", "", "", a.notiz ?? ""]);
      continue;
    }
    a.fehler.forEach((f, i) => {
      zeilen.push([
        ...kopf,
        i === 0 ? "1" : "0",
        i === 0 ? mitFehler : "0",
        i === 0 ? minuten(a.sucheSekunden) : "",
        "1", f.art, f.verantwortlich, f.bauteil, f.befund, f.detail ?? "",
        f.status, minuten(f.zeitSekunden), i === 0 ? (a.notiz ?? "") : ""
      ]);
    });
  }
  return zeilen;
}

export function csvText(anlagen) {
  const zeilen = [CSV_SPALTEN.join(";")];
  for (const z of csvZeilen(anlagen)) zeilen.push(z.map(csvFeld).join(";"));
  return "﻿" + zeilen.join("\r\n") + "\r\n";
}

export function csvDateiname(datum) {
  return `pruefprotokoll_${datum}.csv`;
}

export function jsonText(daten) {
  return JSON.stringify(daten, null, 2);
}

export function jsonPruefen(text) {
  let roh;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, grund: "Die Datei ist kein gültiges JSON." };
  }
  if (!roh || typeof roh !== "object" || Array.isArray(roh) || !Array.isArray(roh.anlagen)) {
    return { ok: false, grund: "Die Datei enthält keine Prüfprotokoll-Sicherung." };
  }
  if (typeof roh.version !== "number") {
    return { ok: false, grund: "Die Datei nennt keine gültige Version und wird nicht eingelesen." };
  }
  return { ok: true, daten: { ...roh, anlagen: roh.anlagen.map(normalisiereAnlage) } };
}

const LISTEN_SCHLUESSEL = ["typ", "ausstattung", "art", "verantwortlich", "bauteil", "befund"];

function vereinigeListe(a = [], b = []) {
  return [...a, ...b.filter(w => !a.includes(w))];
}

function vereinigeListen(bestand = {}, neu = {}) {
  const ergebnis = {};
  for (const schluessel of LISTEN_SCHLUESSEL) {
    ergebnis[schluessel] = vereinigeListe(bestand[schluessel], neu[schluessel]);
  }
  ergebnis.nummern = vereinigeNummern(bestand.nummern, neu.nummern);
  return ergebnis;
}

export function zusammenfuehren(bestand, neu) {
  const nachId = new Map(bestand.anlagen.map(a => [a.id, a]));
  for (const a of neu.anlagen) nachId.set(a.id, a);
  return {
    ...bestand,
    anlagen: [...nachId.values()].sort((a, b) => a.datum.localeCompare(b.datum) || a.erstellt - b.erstellt),
    listen: vereinigeListen(bestand.listen, neu.listen)
  };
}
