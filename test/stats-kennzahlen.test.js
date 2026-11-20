import { test } from "node:test";
import assert from "node:assert/strict";
import { abgeschlossene, kennzahlen } from "../stats.js";

function anlage(datum, fehler = [], extra = {}) {
  return {
    id: "a" + Math.random(), datum, typ: "ASD", nummer: "40",
    ausstattung: [], status: "abgeschlossen", sucheSekunden: 0,
    offeneZeitSekunden: 0, laufStart: null, fehler, ...extra
  };
}
function fehler(zeitSekunden = 0, status = "behoben", extra = {}) {
  return { id: "f" + Math.random(), art: "Mechanisch", verantwortlich: "Montage",
    bauteil: "Ventil", befund: "undicht", status, zeitSekunden, ...extra };
}

test("abgeschlossene lässt offene Anlagen weg", () => {
  const liste = [anlage("2026-11-17"), anlage("2026-11-17", [], { status: "offen" })];
  assert.equal(abgeschlossene(liste, null, null).length, 1);
});

test("abgeschlossene schließt beide Randtage ein", () => {
  const liste = [anlage("2026-11-15"), anlage("2026-11-16"), anlage("2026-11-17"), anlage("2026-11-18")];
  const treffer = abgeschlossene(liste, "2026-11-16", "2026-11-17").map(a => a.datum);
  assert.deepEqual(treffer, ["2026-11-16", "2026-11-17"]);
});

test("offener Zeitraum lässt alles durch", () => {
  assert.equal(abgeschlossene([anlage("2020-01-01"), anlage("2030-01-01")], null, null).length, 2);
});

test("Kennzahlen bei leerer Grundlage liefern null statt NaN", () => {
  const k = kennzahlen([]);
  assert.equal(k.anlagen, 0);
  assert.equal(k.fehlerquote, null);
  assert.equal(k.fehlerJeAnlage, null);
  assert.equal(k.zeitJeFehler, null);
  assert.equal(k.zeitGesamt, 0);
});

test("Fehlerquote zählt Anlagen mit Fehlern, nicht Fehler", () => {
  const k = kennzahlen([
    anlage("2026-11-17", [fehler(), fehler(), fehler(), fehler()]),
    anlage("2026-11-17", []),
    anlage("2026-11-17", []),
    anlage("2026-11-17", [])
  ]);
  assert.equal(k.anlagen, 4);
  assert.equal(k.fehlerfrei, 3);
  assert.equal(k.fehlerquote, 0.25);
  assert.equal(k.fehlerfreiQuote, 0.75);
  assert.equal(k.fehlerGesamt, 4);
  assert.equal(k.fehlerJeAnlage, 1);
});

test("offene Fehler werden über alle Anlagen gezählt", () => {
  const k = kennzahlen([
    anlage("2026-11-17", [fehler(0, "offen"), fehler(0, "behoben")]),
    anlage("2026-11-17", [fehler(0, "offen")])
  ]);
  assert.equal(k.offeneFehler, 2);
});

test("Zeit gesamt enthält die Fehlerzeiten und die Zeit ohne Fehlerbezug", () => {
  const k = kennzahlen([
    anlage("2026-11-17", [fehler(300), fehler(600)], { sucheSekunden: 900 }),
    anlage("2026-11-17", [], { sucheSekunden: 200 })
  ]);
  assert.equal(k.zeitGesamt, 2000);
  assert.equal(k.zeitOhneBezug, 1100);
  assert.equal(k.zeitJeAnlage, 1000);
});

test("Durchschnittszeit lässt Fehler ohne Zeit aussen vor und meldet ihre Anzahl", () => {
  const k = kennzahlen([anlage("2026-11-17", [fehler(300), fehler(500), fehler(0)])]);
  assert.equal(k.zeitJeFehler, 400);
  assert.equal(k.fehlerOhneZeit, 1);
});

test("hat kein Fehler eine Zeit, ist der Durchschnitt null", () => {
  const k = kennzahlen([anlage("2026-11-17", [fehler(0), fehler(0)])]);
  assert.equal(k.zeitJeFehler, null);
  assert.equal(k.fehlerOhneZeit, 2);
});
