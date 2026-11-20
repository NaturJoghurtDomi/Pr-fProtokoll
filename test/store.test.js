import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCHLUESSEL, VERSION, leereDaten, laden, speichern,
  neueAnlage, neuerFehler, neueId, merkeNummer
} from "../store.js";

function speicherAttrappe(inhalt = {}, fehler = null) {
  return {
    daten: inhalt,
    getItem(k) { return k in this.daten ? this.daten[k] : null; },
    setItem(k, v) { if (fehler) throw fehler; this.daten[k] = v; }
  };
}

test("leereDaten bringt alle Listen mit", () => {
  const d = leereDaten();
  assert.equal(d.version, VERSION);
  assert.deepEqual(d.anlagen, []);
  assert.equal(d.letzterExport, null);
  for (const k of ["typ", "nummern", "ausstattung", "art", "verantwortlich", "bauteil", "befund"]) {
    assert.ok(k in d.listen, `Liste ${k} fehlt`);
  }
  assert.ok(d.listen.typ.includes("CSDX"));
  assert.deepEqual(d.listen.nummern, {});
});

test("laden gibt bei leerem Speicher die Vorgabe zurück", () => {
  assert.deepEqual(laden(speicherAttrappe()).anlagen, []);
});

test("laden übersteht kaputten Inhalt ohne Absturz", () => {
  const s = speicherAttrappe({ [SCHLUESSEL]: "{kein json" });
  assert.deepEqual(laden(s).anlagen, []);
});

test("laden ergänzt fehlende Listen aus den Startwerten", () => {
  const s = speicherAttrappe({
    [SCHLUESSEL]: JSON.stringify({ version: VERSION, anlagen: [], listen: { typ: ["ASD"] } })
  });
  const d = laden(s);
  assert.deepEqual(d.listen.typ, ["ASD"], "vorhandene Liste bleibt unverändert");
  assert.ok(d.listen.befund.length > 0, "fehlende Liste wird ergänzt");
});

test("laden normalisiert eine gespeicherte Anlage ohne Fehler-Feld", () => {
  const s = speicherAttrappe({
    [SCHLUESSEL]: JSON.stringify({
      version: VERSION,
      anlagen: [{ id: "a1", typ: "ASD", nummer: "40", datum: "2026-11-17" }]
    })
  });
  const d = laden(s);
  assert.deepEqual(d.anlagen[0].fehler, [], "fehlendes Feld fehler wird nicht ergänzt");
  assert.deepEqual(d.anlagen[0].ausstattung, [], "fehlendes Feld ausstattung wird nicht ergänzt");
});

test("speichern und laden ergeben dieselben Daten", () => {
  const s = speicherAttrappe();
  const d = leereDaten();
  d.anlagen.push(neueAnlage("ASD", "40", "2026-11-17"));
  assert.deepEqual(speichern(s, d), { ok: true });
  assert.deepEqual(laden(s).anlagen[0].typ, "ASD");
});

test("speichern meldet einen vollen Speicher, statt zu werfen", () => {
  const fehler = new Error("voll");
  fehler.name = "QuotaExceededError";
  const s = speicherAttrappe({}, fehler);
  assert.deepEqual(speichern(s, leereDaten()), { ok: false, grund: "voll" });
});

test("neueAnlage startet offen, ohne Fehler und ohne Zeit", () => {
  const a = neueAnlage("BSD", "75", "2026-11-17");
  assert.equal(a.status, "offen");
  assert.equal(a.datum, "2026-11-17");
  assert.deepEqual(a.fehler, []);
  assert.deepEqual(a.ausstattung, []);
  assert.equal(a.offeneZeitSekunden, 0);
  assert.equal(a.sucheSekunden, 0);
  assert.equal(a.laufStart, null);
  assert.equal(a.abgeschlossenAm, null);
  assert.equal(a.auftrag, "");
});

test("neuerFehler setzt behoben als Vorgabe und übernimmt die Zeit", () => {
  const f = neuerFehler({ art: "Mechanisch", verantwortlich: "Montage", bauteil: "Ventil", befund: "undicht" });
  assert.equal(f.status, "behoben");
  assert.equal(f.detail, "");
  assert.equal(f.zeitSekunden, 0);
  assert.equal(neuerFehler({ zeitSekunden: 300 }).zeitSekunden, 300);
});

test("neueId vergibt verschiedene Werte", () => {
  assert.notEqual(neueId("a"), neueId("a"));
  assert.ok(neueId("a").startsWith("a_"));
});

test("merkeNummer legt neue Nummern ab und sortiert sie als Zahl", () => {
  const d = leereDaten();
  merkeNummer(d, "ASD", "60");
  merkeNummer(d, "ASD", "40");
  merkeNummer(d, "ASD", "60");
  assert.deepEqual(d.listen.nummern.ASD, ["40", "60"]);
});

test("merkeNummer übersteht gemischte Typen ohne Absturz", () => {
  const d = leereDaten();
  merkeNummer(d, "ASD", "5");
  merkeNummer(d, "ASD", 5);
  merkeNummer(d, "ASD", "40");
  assert.equal(d.listen.nummern.ASD.length, 3);
  assert.equal(d.listen.nummern.ASD.at(-1), "40");
});
