import { test } from "node:test";
import assert from "node:assert/strict";
import { balkenWaagerecht, balkenSenkrecht, leerHinweis } from "../charts.js";

const reihe = [
  { label: "Ventil", wert: 8, anzeige: "8", zusatz: "", schwach: false },
  { label: "Motor", wert: 4, anzeige: "4", zusatz: "", schwach: false },
  { label: "Filter", wert: 0, anzeige: "0", zusatz: "", schwach: true }
];

test("leere Reihe ergibt einen Hinweis statt einer leeren Fläche", () => {
  assert.ok(balkenWaagerecht([], {}).includes("Noch keine Daten"));
  assert.ok(balkenSenkrecht([], {}).includes("Noch keine Daten"));
  assert.ok(leerHinweis("Nichts da").includes("Nichts da"));
});

test("waagerechte Balken zeigen jede Zeile mit Beschriftung und Wert", () => {
  const svg = balkenWaagerecht(reihe, {});
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes(">Ventil<") && svg.includes(">Motor<") && svg.includes(">Filter<"));
  assert.ok(svg.includes(">8<") && svg.includes(">4<"));
  assert.equal(svg.match(/class="balkenname"/g).length, 3);
});

test("die Balkenlänge folgt dem Wert", () => {
  const svg = balkenWaagerecht(reihe, {});
  const breiten = [...svg.matchAll(/data-breite="([\d.]+)"/g)].map(m => Number(m[1]));
  assert.equal(breiten.length, 3);
  assert.ok(breiten[0] > breiten[1], "der größere Wert ist nicht länger");
  assert.equal(breiten[2], 0, "der Wert null hat keine Länge");
});

test("ein Wert von null erzeugt keinen Balken, aber eine Zeile", () => {
  const svg = balkenWaagerecht([{ label: "Leer", wert: 0, anzeige: "0 %", zusatz: "n=1", schwach: true }], {});
  assert.ok(svg.includes("Leer"));
  assert.ok(svg.includes("n=1"));
});

test("eine dünne Grundlage wird als schwach gekennzeichnet", () => {
  assert.ok(balkenWaagerecht(reihe, {}).includes("balken schwach"));
  assert.ok(!balkenWaagerecht([reihe[0]], {}).includes("schwach"));
});

test("alle Werte gleich null ergeben keine Balken, aber alle Zeilen", () => {
  const svg = balkenWaagerecht([
    { label: "A", wert: 0, anzeige: "0", zusatz: "", schwach: false },
    { label: "B", wert: 0, anzeige: "0", zusatz: "", schwach: false }
  ], {});
  assert.ok(svg.includes("A") && svg.includes("B"));
  assert.ok(!svg.includes("NaN"), "Division durch null ist durchgeschlagen");
});

test("senkrechte Balken beschriften nur den höchsten und den letzten Wert", () => {
  const svg = balkenSenkrecht([
    { label: "KW45", wert: 0.5, anzeige: "50 %", zusatz: "", schwach: false },
    { label: "KW46", wert: 0.9, anzeige: "90 %", zusatz: "", schwach: false },
    { label: "KW47", wert: 0.2, anzeige: "20 %", zusatz: "", schwach: false }
  ], {});
  assert.ok(svg.includes("90 %"), "der höchste Wert fehlt");
  assert.ok(svg.includes("20 %"), "der letzte Wert fehlt");
  assert.ok(!svg.includes("50 %"), "ein mittlerer Wert wurde beschriftet");
});

test("eine sehr lange Beschriftung wird gekürzt, eine kurze bleibt unverändert", () => {
  const lang = "Ölabscheidebehälter Funktion fehlerhaft";
  const svg = balkenWaagerecht([
    { label: lang, wert: 1, anzeige: "1", zusatz: "", schwach: false },
    { label: "Ventil", wert: 1, anzeige: "1", zusatz: "", schwach: false }
  ], {});
  assert.ok(!svg.includes(lang), "lange Beschriftung wurde nicht gekürzt");
  assert.ok(svg.includes("…"), "kein Auslassungszeichen im SVG");
  assert.ok(svg.includes(">Ventil<"), "kurze Beschriftung wurde unnötig verändert");
});

test("spitze Klammern in Beschriftungen werden entschärft", () => {
  const svg = balkenWaagerecht([{ label: "a<b>c", wert: 1, anzeige: "1", zusatz: "", schwach: false }], {});
  assert.ok(!svg.includes("<b>"), "unmaskiertes Markup im SVG");
  assert.ok(svg.includes("a&lt;b&gt;c"));
});

test("ein negativer Wert erzeugt keine Saeule und kein Label ausserhalb der Flaeche", () => {
  const svg = balkenSenkrecht([
    { label: "KW45", wert: 10, anzeige: "10", zusatz: "", schwach: false },
    { label: "KW46", wert: -5, anzeige: "-5", zusatz: "", schwach: false }
  ], {});
  const hoehen = [...svg.matchAll(/data-breite="(-?[\d.]+)"/g)].map(m => Number(m[1]));
  assert.ok(hoehen.every(h => h >= 0), "negative Hoehe im Pfad");
  const yWerte = [...svg.matchAll(/<text class="balkenwert"[^>]*y="(-?[\d.]+)"/g)].map(m => Number(m[1]));
  assert.ok(yWerte.every(y => y >= 0 && y <= 150), "Beschriftung ausserhalb der Zeichenflaeche");
});
