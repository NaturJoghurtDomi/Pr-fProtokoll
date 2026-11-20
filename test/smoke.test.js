import { test } from "node:test";
import assert from "node:assert/strict";

// Minimales DOM, damit die echte App in Node laufen kann.
class Knoten {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attribute = {};
    this.kinder = [];
    this.eigenerText = "";
    this.rohHtml = "";
    this.hoerer = {};
    this.value = "";
    this.files = [];
  }
  setAttribute(k, v) {
    this.attribute[k] = String(v);
    if (k === "value") this.value = String(v);
  }
  getAttribute(k) { return this.attribute[k] ?? null; }
  get dataset() {
    const d = {};
    for (const [k, v] of Object.entries(this.attribute)) {
      if (k.startsWith("data-")) d[k.slice(5).replace(/-(.)/g, (_, c) => c.toUpperCase())] = v;
    }
    return d;
  }
  set className(v) { this.attribute.class = v; }
  get className() { return this.attribute.class ?? ""; }
  set textContent(v) { this.eigenerText = String(v); this.kinder = []; }
  get textContent() { return this.eigenerText + this.kinder.map(k => k.textContent ?? "").join(""); }
  set innerHTML(v) { this.rohHtml = String(v); }
  get innerHTML() { return this.rohHtml; }
  append(...n) { for (const k of n) if (k) this.kinder.push(k); }
  replaceChildren(...n) { this.kinder = []; this.eigenerText = ""; this.append(...n); }
  addEventListener(typ, fn) { (this.hoerer[typ] ??= []).push(fn); }
  focus() {}
  remove() {}
  click() { for (const fn of this.hoerer.click ?? []) fn({ target: this }); }
  aendern(wert) {
    this.value = wert;
    for (const typ of ["input", "change"]) for (const fn of this.hoerer[typ] ?? []) fn({ target: this });
  }
}

function alleKnoten(wurzel, treffer = []) {
  treffer.push(wurzel);
  for (const k of wurzel.kinder) alleKnoten(k, treffer);
  return treffer;
}

const nachId = {};
for (const id of ["band", "inhalt", "reiter"]) nachId[id] = new Knoten("div");

globalThis.document = {
  createElement: t => new Knoten(t),
  getElementById: id => nachId[id],
  querySelectorAll: sel => {
    const alle = alleKnoten(nachId.inhalt);
    return sel === "[data-timer]" ? alle.filter(k => "data-timer" in k.attribute) : [];
  },
  body: new Knoten("body")
};

const speicher = {};
globalThis.localStorage = {
  getItem: k => (k in speicher ? speicher[k] : null),
  setItem: (k, v) => { speicher[k] = String(v); }
};

globalThis.window = {
  confirm: () => true,
  alert: () => {},
  scrollTo: () => {},
  addEventListener: () => {}
};

const takte = [];
globalThis.setInterval = fn => { takte.push(fn); return takte.length; };

const { ctx } = await import("../app.js");

const sichtbar = () => alleKnoten(nachId.inhalt);
function tippe(text) {
  const t = sichtbar().find(k => k.tagName === "BUTTON" && k.textContent.trim() === text);
  assert.ok(t, `Knopf "${text}" nicht gefunden. Vorhanden: ` +
    JSON.stringify(sichtbar().filter(k => k.tagName === "BUTTON").map(k => k.textContent.trim())));
  t.click();
}
function reiter(name) {
  const t = alleKnoten(nachId.reiter).find(k => k.tagName === "BUTTON" && k.textContent.trim() === name);
  assert.ok(t, `Reiter "${name}" nicht gefunden`);
  t.click();
}
function text() { return nachId.inhalt.textContent + sichtbar().map(k => k.rohHtml).join(""); }
function ersteEingabe() { return sichtbar().find(k => k.tagName === "INPUT"); }

test("App startet und zeichnet den Reiter Erfassen", () => {
  assert.ok(nachId.inhalt.kinder.length > 0, "nichts gezeichnet");
  assert.match(text(), /Erfassen/);
});

test("alle vier Reiter zeichnen ohne Absturz", () => {
  for (const r of ["Protokoll", "Statistik", "Daten", "Erfassen"]) {
    reiter(r);
    assert.ok(nachId.inhalt.kinder.length > 0, `Reiter ${r} bleibt leer`);
  }
});

test("Statistik ohne Daten zeigt einen Strich, kein NaN", () => {
  reiter("Statistik");
  const t = text();
  for (const schlecht of ["NaN", "undefined", "null"]) {
    assert.ok(!t.includes(schlecht), `"${schlecht}" steht sichtbar auf der Seite`);
  }
  reiter("Erfassen");
});

test("Anlage in zwei Schritten anlegen, Nummer wird gelernt", () => {
  tippe("Neue Anlage");
  tippe("ASD");
  ersteEingabe().aendern("40");
  tippe("Anlegen");
  assert.match(text(), /ASD 40/);
  assert.equal(ctx.daten.anlagen.length, 1);
  assert.ok(ctx.daten.listen.nummern.ASD.includes("40"), "Nummer nicht gemerkt");
});

test("Timer sammelt die Zeit im Topf", () => {
  tippe("Fehlersuche starten");
  const a = ctx.daten.anlagen[0];
  assert.ok(a.laufStart, "laufStart nicht gesetzt");
  a.laufStart = Date.now() - 600_000;
  tippe("Stopp");
  assert.ok(a.offeneZeitSekunden >= 595, `Topf hat nur ${a.offeneZeitSekunden} s`);
});

test("Fehler in vier Schritten erfassen, gemessene Zeit landet am Fehler", () => {
  tippe("Fehler erfassen");
  tippe("Mechanisch");
  tippe("Montage");
  tippe("Ventil");
  tippe("undicht");
  assert.match(text(), /Ventil undicht/);
  const minutenfeld = sichtbar().find(k => k.tagName === "INPUT" && k.value === "10");
  assert.ok(minutenfeld, "gemessene Zeit steht nicht im Zeitfeld");
  tippe("Fehler speichern");
  const f = ctx.daten.anlagen[0].fehler[0];
  assert.equal(f.zeitSekunden, 600);
  assert.equal(ctx.daten.anlagen[0].offeneZeitSekunden, 0, "Topf nicht geleert");
});

test("zweiter Fehler ohne gemessene Zeit ist erlaubt", () => {
  tippe("Fehler erfassen");
  tippe("Elektrisch");
  tippe("Vormontage");
  tippe("Verkabelung");
  tippe("falsch verkabelt");
  tippe("Fehler speichern");
  assert.equal(ctx.daten.anlagen[0].fehler.length, 2);
  assert.equal(ctx.daten.anlagen[0].fehler[1].zeitSekunden, 0);
});

test("Anlage abschliessen und fehlerfreie Anlage anlegen", () => {
  tippe("Abschließen");
  assert.equal(ctx.daten.anlagen[0].status, "abgeschlossen");
  tippe("Neue Anlage");
  tippe("BSD");
  ersteEingabe().aendern("75");
  tippe("Anlegen");
  tippe("Fehlerfrei abschließen");
  assert.equal(ctx.daten.anlagen.length, 2);
  assert.equal(ctx.daten.anlagen[1].fehler.length, 0);
});

test("Protokoll listet beide Anlagen", () => {
  reiter("Protokoll");
  const t = text();
  assert.match(t, /ASD 40/);
  assert.match(t, /BSD 75/);
  assert.match(t, /2 von 2 Anlagen/);
});

test("Statistik rechnet die Fehlerquote aus echten Daten", () => {
  reiter("Statistik");
  const t = text();
  assert.match(t, /50 %/, "Fehlerquote stimmt nicht");
  assert.match(t, /Ventil/, "Bauteil-Diagramm fehlt");
  for (const schlecht of ["NaN", "undefined"]) {
    assert.ok(!t.includes(schlecht), `"${schlecht}" steht sichtbar auf der Seite`);
  }
});

test("Umschalter Anzahl gegen Zeit wechselt die Messgroesse", () => {
  reiter("Statistik");
  tippe("Zeit");
  assert.match(text(), /10 min/, "Zeitansicht zeigt keine Dauer");
  tippe("Anzahl");
});

test("Reiter Daten zeichnet mit Daten", () => {
  reiter("Daten");
  assert.match(text(), /abgeschlossene Anlagen/);
});

test("Sekundentakt laeuft ohne Absturz", () => {
  reiter("Erfassen");
  for (const fn of takte) fn();
});

test("alles liegt im Speicher und uebersteht einen Neustart", () => {
  const roh = JSON.parse(speicher["pruefprotokoll.v1"]);
  assert.equal(roh.anlagen.length, 2);
  assert.equal(roh.anlagen[0].fehler.length, 2);
  assert.equal(roh.anlagen[0].fehler[0].zeitSekunden, 600);
});

test("abgeschlossene Anlage zeigt keinen Startknopf mehr für die Fehlersuche", () => {
  ctx.ansicht.reiter = "erfassen";
  ctx.ansicht.anlageId = ctx.daten.anlagen[0].id;
  ctx.zeichne(true);
  const knoepfe = sichtbar().filter(k => k.tagName === "BUTTON").map(k => k.textContent.trim());
  assert.ok(!knoepfe.includes("Fehlersuche starten"), "Startknopf trotz abgeschlossener Anlage sichtbar");
  assert.ok(!knoepfe.includes("Stopp"), "Stoppknopf trotz abgeschlossener Anlage sichtbar");
  ctx.ansicht.anlageId = null;
  ctx.zeichne(true);
});

test("ein entfernter Anlagentyp setzt den Protokoll-Filter zurück", () => {
  ctx.ansicht.typFilter = "ASD";
  ctx.daten.listen.typ = ctx.daten.listen.typ.filter(t => t !== "ASD");
  reiter("Protokoll");
  assert.equal(ctx.ansicht.typFilter, "", "Filter wurde nicht zurückgesetzt");
  assert.match(text(), /2 von 2 Anlagen/, "nach dem Zurücksetzen fehlen Anlagen");
  ctx.daten.listen.typ.push("ASD");
  reiter("Erfassen");
});

test("der harte Speicherhinweis zeigt einen Knopf zu Daten", () => {
  ctx.speicherfehler = "Der Browser lässt kein Speichern zu.";
  ctx.zeichne();
  const knopfVorhanden = alleKnoten(nachId.band).some(k => k.tagName === "BUTTON" && k.textContent.trim() === "Zu Daten");
  assert.ok(knopfVorhanden, "Knopf fehlt im harten Hinweisband");
  ctx.speicherfehler = null;
  ctx.zeichne();
});

test("Reiterwechsel mit offenem Fehlerfluss fragt nach und bricht bei Nein ab", () => {
  ctx.ansicht.reiter = "erfassen";
  ctx.ansicht.fehlerFluss = { anlageId: ctx.daten.anlagen[0].id, schritt: 0, felder: {}, bearbeitet: null };
  const alt = window.confirm;
  window.confirm = () => false;
  ctx.reiter("protokoll");
  window.confirm = alt;
  assert.equal(ctx.ansicht.reiter, "erfassen", "Reiter hat trotz verneinter Rückfrage gewechselt");
  assert.ok(ctx.ansicht.fehlerFluss, "Fehlerfluss wurde trotzdem verworfen");
  ctx.ansicht.fehlerFluss = null;
  ctx.zeichne(true);
});

test("Protokollfilter nur mit Fehlern blendet die fehlerfreie Anlage aus", () => {
  reiter("Protokoll");
  tippe("Auch fehlerfreie");
  const t = text();
  assert.match(t, /ASD 40/);
  assert.ok(!t.includes("BSD 75"), "fehlerfreie Anlage wird nicht ausgeblendet");
  assert.match(t, /1 von 2 Anlagen/);
  tippe("Nur mit Fehlern");
});

test("Protokollfilter Zeitraum greift und meldet sich", () => {
  reiter("Protokoll");
  tippe("Diese Woche");
  assert.match(text(), /Gefiltert ab/);
  tippe("Alles");
  assert.match(text(), /2 von 2 Anlagen/);
});

test("Nur offene Fehler zeigt auch alte Anlagen, trotz Zeitraumfilter", () => {
  const alt = ctx.daten.anlagen[0];
  ctx.daten.anlagen.push({
    ...alt,
    id: "alt_1",
    datum: "2026-01-05",
    fehler: [{ ...alt.fehler[0], id: "altf_1", status: "offen" }]
  });
  ctx.sichern();
  reiter("Protokoll");
  tippe("Diese Woche");
  tippe("Alle Anlagen");
  const t = text();
  assert.match(t, /ASD 40/, "alte Anlage mit offenem Fehler fehlt in der Arbeitsliste");
  assert.match(t, /Der Zeitraum gilt hier nicht/, "Hinweis zum übersteuerten Zeitraum fehlt");
  tippe("Nur offene Fehler");
  tippe("Alles");
});
