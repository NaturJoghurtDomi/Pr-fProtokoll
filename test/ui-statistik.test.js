import { test } from "node:test";
import assert from "node:assert/strict";
import { kwKurz, mengenReihe } from "../ui-statistik.js";

test("kwKurz entfernt das Jahr aus der Kalenderwochen-Beschriftung", () => {
  assert.equal(kwKurz("2026-KW47"), "KW47");
  assert.equal(kwKurz("2027-KW01"), "KW01");
});

test("mengenReihe kürzt nur, wenn begrenzen gesetzt ist", () => {
  const gruppen = Array.from({ length: 15 }, (_, i) => ({ label: `Bauteil ${i}`, anzahl: i + 1, zeitSekunden: 0 }));
  assert.equal(mengenReihe(gruppen, "anzahl", true).length, 10);
  assert.equal(mengenReihe(gruppen, "anzahl", false).length, 15);
  assert.equal(mengenReihe(gruppen, "anzahl").length, 15, "ohne Angabe darf nicht gekürzt werden");
});

test("mengenReihe sortiert absteigend nach Wert, unabhängig von der Kürzung", () => {
  const gruppen = [
    { label: "A", anzahl: 1, zeitSekunden: 10 },
    { label: "B", anzahl: 5, zeitSekunden: 50 }
  ];
  assert.deepEqual(mengenReihe(gruppen, "anzahl", false).map(e => e.label), ["B", "A"]);
});
