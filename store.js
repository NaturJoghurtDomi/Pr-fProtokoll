import { heute } from "./datum.js";
import { STARTLISTEN } from "./listen.js";

export const SCHLUESSEL = "pruefprotokoll.v1";
export const VERSION = 1;

export function leereDaten() {
  return {
    version: VERSION,
    anlagen: [],
    listen: structuredClone(STARTLISTEN),
    letzterExport: null
  };
}

export function laden(speicher) {
  let roh = null;
  try {
    roh = JSON.parse(speicher.getItem(SCHLUESSEL) ?? "null");
  } catch {
    roh = null;
  }
  if (!roh || typeof roh !== "object" || !Array.isArray(roh.anlagen)) return leereDaten();
  const daten = { ...leereDaten(), ...roh };
  daten.version = VERSION;
  daten.listen = { ...structuredClone(STARTLISTEN), ...(roh.listen ?? {}) };
  daten.listen.nummern = roh.listen?.nummern ?? {};
  daten.anlagen = roh.anlagen.map(normalisiereAnlage);
  return daten;
}

export function speichern(speicher, daten) {
  try {
    speicher.setItem(SCHLUESSEL, JSON.stringify(daten));
    return { ok: true };
  } catch (fehler) {
    const voll = fehler?.name === "QuotaExceededError" || /quota|voll/i.test(fehler?.message ?? "");
    return { ok: false, grund: voll ? "voll" : "gesperrt" };
  }
}

export function neueId(praefix) {
  return `${praefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function neueAnlage(typ, nummer, datum = heute()) {
  return {
    id: neueId("a"),
    datum,
    typ,
    nummer,
    auftrag: "",
    ausstattung: [],
    notiz: "",
    status: "offen",
    offeneZeitSekunden: 0,
    laufStart: null,
    sucheSekunden: 0,
    erstellt: Date.now(),
    abgeschlossenAm: null,
    fehler: []
  };
}

export function neuerFehler(felder = {}) {
  return {
    id: neueId("f"),
    art: felder.art ?? "",
    verantwortlich: felder.verantwortlich ?? "",
    bauteil: felder.bauteil ?? "",
    befund: felder.befund ?? "",
    detail: felder.detail ?? "",
    status: felder.status ?? "behoben",
    zeitSekunden: felder.zeitSekunden ?? 0,
    zeit: Date.now()
  };
}

function nummerVergleich(a, b) {
  return (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b));
}

export function merkeNummer(daten, typ, nummer) {
  const liste = daten.listen.nummern[typ] ?? [];
  if (!liste.includes(nummer)) liste.push(nummer);
  liste.sort(nummerVergleich);
  daten.listen.nummern[typ] = liste;
}

export function vereinigeNummern(a = {}, b = {}) {
  const ergebnis = {};
  for (const typ of new Set([...Object.keys(a), ...Object.keys(b)])) {
    ergebnis[typ] = [...new Set([...(a[typ] ?? []), ...(b[typ] ?? [])])].sort(nummerVergleich);
  }
  return ergebnis;
}

function normalisierterFehler(f) {
  const basis = f && typeof f === "object" ? f : {};
  return {
    ...basis,
    zeitSekunden: Number(basis.zeitSekunden) || 0,
    status: basis.status === "offen" ? "offen" : "behoben"
  };
}

// Bringt eine eingelesene oder von Hand verbogene Anlage auf das vollständige
// Datenmodell, damit fehlende oder falsche Felder Protokoll und Statistik
// nicht mit einem Absturz lahmlegen (z. B. a.fehler.some(...) auf undefined).
export function normalisiereAnlage(roh) {
  const basis = roh && typeof roh === "object" ? roh : {};
  return {
    ...basis,
    datum: basis.datum ?? heute(),
    ausstattung: Array.isArray(basis.ausstattung) ? basis.ausstattung : [],
    offeneZeitSekunden: Number(basis.offeneZeitSekunden) || 0,
    sucheSekunden: Number(basis.sucheSekunden) || 0,
    erstellt: Number(basis.erstellt) || Date.now(),
    status: basis.status === "abgeschlossen" ? "abgeschlossen" : "offen",
    fehler: (Array.isArray(basis.fehler) ? basis.fehler : []).map(normalisierterFehler)
  };
}

export const ACHT_STUNDEN = 8 * 3600;

export function zeitStopp(anlage, jetzt = Date.now()) {
  if (!anlage.laufStart) return 0;
  const dauer = Math.max(0, Math.round((jetzt - anlage.laufStart) / 1000));
  anlage.offeneZeitSekunden += dauer;
  anlage.laufStart = null;
  return dauer;
}

export function zeitStart(daten, anlage, jetzt = Date.now()) {
  for (const andere of daten.anlagen) {
    if (andere.id !== anlage.id && andere.laufStart) zeitStopp(andere, jetzt);
  }
  if (!anlage.laufStart) anlage.laufStart = jetzt;
}

export function zeitOffen(anlage, jetzt = Date.now()) {
  const laufend = anlage.laufStart ? Math.max(0, Math.round((jetzt - anlage.laufStart) / 1000)) : 0;
  return (anlage.offeneZeitSekunden || 0) + laufend;
}

export function vergesseneLaeufe(daten, jetzt = Date.now()) {
  return daten.anlagen.filter(a => a.laufStart && (jetzt - a.laufStart) / 1000 > ACHT_STUNDEN);
}
