import { test } from "node:test";
import assert from "node:assert/strict";
import { gruppiereFehler, quoteJeTyp, quoteJeAusstattung, quoteJeKW } from "../stats.js";

function anlage(datum, fehler = [], extra = {}) {
  return { id: "a" + Math.random(), datum, typ: "ASD", nummer: "40", ausstattung: [],
    status: "abgeschlossen", sucheSekunden: 0, fehler, ...extra };
}
function fehler(bauteil, befund, zeitSekunden = 0, extra = {}) {
  return { id: "f" + Math.random(), art: "Mechanisch", verantwortlich: "Montage",
    bauteil, befund, status: "behoben", zeitSekunden, ...extra };
}

test("gruppiereFehler zählt je Feld und sortiert absteigend", () => {
  const r = gruppiereFehler([
    anlage("2026-11-17", [fehler("Ventil", "undicht"), fehler("Ventil", "defekt"), fehler("Motor", "defekt")])
  ], "bauteil");
  assert.deepEqual(r.map(x => [x.label, x.anzahl]), [["Ventil", 2], ["Motor", 1]]);
  assert.equal(r[0].wert, 2);
  assert.equal(r[0].grundlage, null);
});

test("gruppiereFehler summiert die Zeit je Gruppe", () => {
  const r = gruppiereFehler([
    anlage("2026-11-17", [fehler("Ventil", "undicht", 300), fehler("Ventil", "undicht", 300), fehler("Ventil", "undicht", 300)]),
    anlage("2026-11-17", [fehler("Motor", "defekt", 2400)])
  ], "bauteil");
  const ventil = r.find(x => x.label === "Ventil");
  const motor = r.find(x => x.label === "Motor");
  assert.equal(ventil.zeitSekunden, 900);
  assert.equal(ventil.anzahl, 3);
  assert.equal(motor.zeitSekunden, 2400);
  assert.equal(motor.anzahl, 1);
});

test("gruppiereFehler mit paar verbindet Bauteil und Befund", () => {
  const r = gruppiereFehler([anlage("2026-11-17", [fehler("Ventil", "undicht")])], "paar");
  assert.equal(r[0].label, "Ventil undicht");
});

test("quoteJeTyp rechnet je Typ und zählt die Grundlage mit", () => {
  const r = quoteJeTyp([
    anlage("2026-11-17", [fehler("Ventil", "undicht")]),
    anlage("2026-11-17", []),
    anlage("2026-11-17", [], { typ: "BSD", nummer: "75" })
  ], false);
  const asd = r.find(x => x.label === "ASD");
  assert.equal(asd.wert, 0.5);
  assert.equal(asd.grundlage, 2);
  assert.equal(r.find(x => x.label === "BSD").wert, 0);
});

test("quoteJeTyp mit Nummer trennt die Baugrößen", () => {
  const r = quoteJeTyp([
    anlage("2026-11-17", [fehler("Ventil", "undicht")]),
    anlage("2026-11-17", [], { nummer: "60" })
  ], true);
  assert.deepEqual(r.map(x => x.label).sort(), ["ASD 40", "ASD 60"]);
});

test("quoteJeAusstattung zählt jede Anlage bei jedem ihrer Merkmale", () => {
  const r = quoteJeAusstattung([
    anlage("2026-11-17", [fehler("Ventil", "undicht")], { ausstattung: ["SFC", "Trockner"] }),
    anlage("2026-11-17", [], { ausstattung: ["SFC"] }),
    anlage("2026-11-17", [], { ausstattung: [] })
  ]);
  const sfc = r.find(x => x.label === "SFC");
  assert.equal(sfc.grundlage, 2);
  assert.equal(sfc.wert, 0.5);
  assert.equal(r.find(x => x.label === "Trockner").grundlage, 1);
  assert.equal(r.find(x => x.label === "ohne"), undefined);
});

test("quoteJeKW sortiert chronologisch und kürzt auf die letzten Wochen", () => {
  const r = quoteJeKW([
    anlage("2026-11-02"), anlage("2026-11-09"), anlage("2026-11-17", [fehler("Ventil", "undicht")])
  ], 2);
  assert.deepEqual(r.map(x => x.label), ["2026-KW46", "2026-KW47"]);
  assert.equal(r[1].wert, 1);
});

test("leere Eingabe ergibt überall eine leere Liste", () => {
  assert.deepEqual(gruppiereFehler([], "art"), []);
  assert.deepEqual(quoteJeTyp([], false), []);
  assert.deepEqual(quoteJeAusstattung([]), []);
  assert.deepEqual(quoteJeKW([], 12), []);
});

test("ein doppeltes Ausstattungsmerkmal zählt die Anlage trotzdem nur einmal", () => {
  const r = quoteJeAusstattung([
    anlage("2026-11-17", [], { ausstattung: ["SFC", "SFC"] }),
    anlage("2026-11-17", [fehler("Ventil", "undicht")], { ausstattung: ["SFC"] })
  ]);
  const sfc = r.find(x => x.label === "SFC");
  assert.equal(sfc.grundlage, 2);
  assert.equal(sfc.wert, 0.5);
});

test("eine Anlage ohne Nummer erzeugt kein Label mit undefined", () => {
  const r = quoteJeTyp([anlage("2026-11-17", [], { nummer: undefined })], true);
  assert.equal(r[0].label, "ASD");
});
