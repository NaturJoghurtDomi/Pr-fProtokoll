import { test } from "node:test";
import assert from "node:assert/strict";
import { formatUhr } from "../datum.js";
import { leereDaten, neueAnlage, zeitStart, zeitStopp, zeitOffen, vergesseneLaeufe } from "../store.js";

const T0 = 1_000_000_000_000;

function mitAnlage() {
  const daten = leereDaten();
  const a = neueAnlage("ASD", "40", "2026-11-17");
  daten.anlagen.push(a);
  return { daten, a };
}

test("formatUhr zeigt Minuten und Sekunden, ab einer Stunde auch Stunden", () => {
  assert.equal(formatUhr(0), "0:00");
  assert.equal(formatUhr(65), "1:05");
  assert.equal(formatUhr(600), "10:00");
  assert.equal(formatUhr(3661), "1:01:01");
});

test("Start merkt sich den Zeitpunkt, Stopp schreibt die Dauer in den Topf", () => {
  const { daten, a } = mitAnlage();
  zeitStart(daten, a, T0);
  assert.equal(a.laufStart, T0);
  assert.equal(zeitStopp(a, T0 + 300_000), 300);
  assert.equal(a.offeneZeitSekunden, 300);
  assert.equal(a.laufStart, null);
});

test("mehrmals Starten und Stoppen summiert sich", () => {
  const { daten, a } = mitAnlage();
  zeitStart(daten, a, T0);
  zeitStopp(a, T0 + 120_000);
  zeitStart(daten, a, T0 + 600_000);
  zeitStopp(a, T0 + 660_000);
  assert.equal(a.offeneZeitSekunden, 180, "die Pause dazwischen zählt nicht mit");
});

test("Stopp ohne laufenden Timer ändert nichts", () => {
  const { a } = mitAnlage();
  assert.equal(zeitStopp(a, T0), 0);
  assert.equal(a.offeneZeitSekunden, 0);
});

test("ein zweiter Start stoppt die erste Anlage", () => {
  const { daten, a } = mitAnlage();
  const b = neueAnlage("BSD", "75", "2026-11-17");
  daten.anlagen.push(b);
  zeitStart(daten, a, T0);
  zeitStart(daten, b, T0 + 60_000);
  assert.equal(a.laufStart, null);
  assert.equal(a.offeneZeitSekunden, 60);
  assert.equal(b.laufStart, T0 + 60_000);
});

test("zeitOffen rechnet den laufenden Abschnitt dazu, ohne ihn zu speichern", () => {
  const { daten, a } = mitAnlage();
  a.offeneZeitSekunden = 120;
  zeitStart(daten, a, T0);
  assert.equal(zeitOffen(a, T0 + 60_000), 180);
  assert.equal(a.offeneZeitSekunden, 120, "zeitOffen darf nichts verändern");
});

test("ein erneuter Start bei laufendem Timer setzt den Anfang nicht zurück", () => {
  const { daten, a } = mitAnlage();
  zeitStart(daten, a, T0);
  zeitStart(daten, a, T0 + 60_000);
  assert.equal(a.laufStart, T0);
});

test("vergesseneLaeufe findet nur Timer über acht Stunden", () => {
  const { daten, a } = mitAnlage();
  zeitStart(daten, a, T0);
  assert.equal(vergesseneLaeufe(daten, T0 + 7 * 3600_000).length, 0);
  assert.equal(vergesseneLaeufe(daten, T0 + 9 * 3600_000).length, 1);
});
