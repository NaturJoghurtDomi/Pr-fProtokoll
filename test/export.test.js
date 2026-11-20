import { test } from "node:test";
import assert from "node:assert/strict";
import { CSV_SPALTEN, csvFeld, minuten, csvZeilen, csvText, csvDateiname,
  jsonText, jsonPruefen, zusammenfuehren } from "../export.js";
import { leereDaten, neueAnlage, neuerFehler, merkeNummer } from "../store.js";

function anlage(extra = {}, fehler = []) {
  return { ...neueAnlage("ASD", "40", "2026-11-17"), status: "abgeschlossen", fehler, ...extra };
}

test("csvFeld schützt Semikolon, Anführungszeichen und Zeilenumbruch", () => {
  assert.equal(csvFeld("einfach"), "einfach");
  assert.equal(csvFeld("a;b"), '"a;b"');
  assert.equal(csvFeld('sagt "hallo"'), '"sagt ""hallo"""');
  assert.equal(csvFeld("zwei\nzeilen"), '"zwei\nzeilen"');
  assert.equal(csvFeld(null), "");
});

test("minuten schreibt mit Komma und einer Nachkommastelle", () => {
  assert.equal(minuten(750), "12,5");
  assert.equal(minuten(0), "0,0");
  assert.equal(minuten(3600), "60,0");
});

test("fehlerfreie Anlage ergibt genau eine Zeile mit leeren Fehlerfeldern", () => {
  const zeilen = csvZeilen([anlage({ sucheSekunden: 600 })]);
  assert.equal(zeilen.length, 1);
  const z = Object.fromEntries(CSV_SPALTEN.map((s, i) => [s, zeilen[0][i]]));
  assert.equal(z["Anlagenzähler"], "1");
  assert.equal(z["Fehlerzähler"], "0");
  assert.equal(z["Fehleranzahl Anlage"], "0");
  assert.equal(z["Fehlerart"], "");
  assert.equal(z["Zeit ohne Fehlerbezug Minuten"], "10,0");
  assert.equal(z["Typ und Nummer"], "ASD 40");
  assert.equal(z["KW"], "2026-KW47");
});

test("Anlage mit drei Fehlern ergibt drei Zeilen mit genau einem Anlagenzähler", () => {
  const zeilen = csvZeilen([anlage({ sucheSekunden: 300 }, [
    neuerFehler({ bauteil: "Ventil", befund: "undicht", zeitSekunden: 300 }),
    neuerFehler({ bauteil: "Motor", befund: "defekt", zeitSekunden: 600 }),
    neuerFehler({ bauteil: "Filter", befund: "fehlt" })
  ])]);
  assert.equal(zeilen.length, 3);
  const spalte = name => zeilen.map(z => z[CSV_SPALTEN.indexOf(name)]);
  assert.deepEqual(spalte("Anlagenzähler"), ["1", "0", "0"]);
  assert.deepEqual(spalte("Fehlerzähler"), ["1", "1", "1"]);
  assert.deepEqual(spalte("Zeit ohne Fehlerbezug Minuten"), ["5,0", "", ""]);
  assert.deepEqual(spalte("Behebungszeit Minuten"), ["5,0", "10,0", "0,0"]);
  assert.deepEqual(spalte("Fehleranzahl Anlage"), ["3", "3", "3"]);
});

test("jede Zeile hat so viele Felder wie es Spalten gibt", () => {
  const zeilen = csvZeilen([
    anlage({}, [neuerFehler({ bauteil: "Ventil" })]),
    anlage({ id: "b", ausstattung: ["SFC", "Trockner"] })
  ]);
  for (const z of zeilen) assert.equal(z.length, CSV_SPALTEN.length);
});

test("csvText beginnt mit BOM und der Kopfzeile", () => {
  const text = csvText([anlage()]);
  assert.ok(text.startsWith("﻿"), "BOM fehlt");
  assert.ok(text.split("\r\n")[0].endsWith("Notiz"));
  assert.equal(text.split("\r\n")[0].slice(1), CSV_SPALTEN.join(";"));
});

test("Ausstattung steht als Liste mit Komma in einem Feld", () => {
  const z = csvZeilen([anlage({ ausstattung: ["SFC", "Trockner"] })])[0];
  assert.equal(z[CSV_SPALTEN.indexOf("Ausstattung")], "SFC, Trockner");
});

test("offene Anlagen kommen nicht in den Export", () => {
  assert.deepEqual(csvZeilen([anlage({ status: "offen" })]), []);
});

test("csvDateiname trägt das Datum", () => {
  assert.equal(csvDateiname("2026-11-17"), "pruefprotokoll_2026-11-17.csv");
});

test("JSON hin und zurück ergibt dieselben Daten", () => {
  const daten = leereDaten();
  daten.anlagen.push(anlage({}, [neuerFehler({ bauteil: "Ventil" })]));
  const geprueft = jsonPruefen(jsonText(daten));
  assert.equal(geprueft.ok, true);
  assert.deepEqual(geprueft.daten.anlagen, daten.anlagen);
});

test("jsonPruefen weist Unsinn ab, ohne zu werfen", () => {
  assert.equal(jsonPruefen("{kein json").ok, false);
  assert.equal(jsonPruefen('{"foo":1}').ok, false);
  assert.equal(jsonPruefen("[]").ok, false);
});

test("jsonPruefen lehnt eine Sicherung ohne gültige Version ab", () => {
  const ohneVersion = jsonPruefen(JSON.stringify({ anlagen: [] }));
  assert.equal(ohneVersion.ok, false);
  assert.match(ohneVersion.grund, /[Vv]ersion/);
  const falscheVersion = jsonPruefen(JSON.stringify({ version: "1", anlagen: [] }));
  assert.equal(falscheVersion.ok, false);
});

test("jsonPruefen normalisiert eine Anlage ohne Fehler-Feld statt sie abstürzen zu lassen", () => {
  const roh = { version: 1, anlagen: [{ id: "a1", typ: "ASD", nummer: "40", datum: "2026-11-17" }] };
  const geprueft = jsonPruefen(JSON.stringify(roh));
  assert.equal(geprueft.ok, true);
  assert.deepEqual(geprueft.daten.anlagen[0].fehler, []);
  assert.deepEqual(geprueft.daten.anlagen[0].ausstattung, []);
});

test("eine eingelesene Anlage ohne Datum lässt zusammenfuehren nicht werfen", () => {
  const bestand = leereDaten();
  bestand.anlagen.push(anlage({ id: "a1" }));
  const roh = { version: 1, anlagen: [{ id: "a2", typ: "BSD", nummer: "10" }] };
  const geprueft = jsonPruefen(JSON.stringify(roh));
  assert.equal(geprueft.ok, true);
  assert.doesNotThrow(() => zusammenfuehren(bestand, geprueft.daten));
});

test("zusammenfuehren ersetzt gleiche Kennungen und hängt neue an", () => {
  const bestand = leereDaten();
  bestand.anlagen.push(anlage({ id: "a1", notiz: "alt" }), anlage({ id: "a2" }));
  const neu = leereDaten();
  neu.anlagen.push(anlage({ id: "a1", notiz: "neu" }), anlage({ id: "a3" }));
  const ergebnis = zusammenfuehren(bestand, neu);
  assert.equal(ergebnis.anlagen.length, 3);
  assert.equal(ergebnis.anlagen.find(a => a.id === "a1").notiz, "neu");
  assert.ok(ergebnis.anlagen.some(a => a.id === "a3"));
});

test("zusammenfuehren vereinigt Listen statt sie zu ersetzen", () => {
  const bestand = leereDaten();
  bestand.listen.bauteil.push("Sonderteil");
  merkeNummer(bestand, "ASD", "77");
  const neu = leereDaten();
  const ergebnis = zusammenfuehren(bestand, neu);
  assert.ok(ergebnis.listen.bauteil.includes("Sonderteil"), "eigenes Bauteil verloren");
  assert.ok(ergebnis.listen.nummern.ASD?.includes("77"), "gelernte Nummer verloren");
});

test("Anlage mit Fehler erlaubt die Fehlerquote als Division zweier Summen im Pivot", () => {
  const ohneFehler = anlage({ sucheSekunden: 100 });
  const mitFehler = anlage({ sucheSekunden: 50 }, [
    neuerFehler({ bauteil: "Ventil", befund: "undicht" }),
    neuerFehler({ bauteil: "Motor", befund: "defekt" })
  ]);
  const zeilen = csvZeilen([ohneFehler, mitFehler]);
  const idxAnlage = CSV_SPALTEN.indexOf("Anlagenzähler");
  const idxMitFehler = CSV_SPALTEN.indexOf("Anlage mit Fehler");
  assert.ok(idxMitFehler > idxAnlage, "Spalte steht nicht nach Anlagenzähler");
  const summeAnlagen = zeilen.reduce((s, z) => s + Number(z[idxAnlage]), 0);
  const summeMitFehler = zeilen.reduce((s, z) => s + Number(z[idxMitFehler]), 0);
  assert.equal(summeAnlagen, 2);
  assert.equal(summeMitFehler, 1);
  assert.equal(summeMitFehler / summeAnlagen, 0.5);
});
