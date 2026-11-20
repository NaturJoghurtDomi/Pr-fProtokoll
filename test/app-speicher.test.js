import { test } from "node:test";
import assert from "node:assert/strict";

// Minimales DOM, genug damit app.js beim Import nicht abstürzt.
class Knoten {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attribute = {};
    this.kinder = [];
    this.eigenerText = "";
    this.rohHtml = "";
    this.hoerer = {};
  }
  setAttribute(k, v) { this.attribute[k] = String(v); }
  getAttribute(k) { return this.attribute[k] ?? null; }
  get dataset() { return {}; }
  set className(v) { this.attribute.class = v; }
  get className() { return this.attribute.class ?? ""; }
  set textContent(v) { this.eigenerText = String(v); this.kinder = []; }
  get textContent() { return this.eigenerText + this.kinder.map(k => k.textContent ?? "").join(""); }
  set innerHTML(v) { this.rohHtml = String(v); }
  get innerHTML() { return this.rohHtml; }
  append(...n) { for (const k of n) if (k) this.kinder.push(k); }
  replaceChildren(...n) { this.kinder = []; this.eigenerText = ""; this.append(...n); }
  addEventListener(typ, fn) { (this.hoerer[typ] ??= []).push(fn); }
  remove() {}
}

const nachId = {};
for (const id of ["band", "inhalt", "reiter"]) nachId[id] = new Knoten("div");

globalThis.document = {
  createElement: t => new Knoten(t),
  getElementById: id => nachId[id],
  querySelectorAll: () => [],
  body: new Knoten("body")
};

const speicherAbbildung = {};
globalThis.localStorage = {
  getItem: k => (k in speicherAbbildung ? speicherAbbildung[k] : null),
  setItem: (k, v) => { speicherAbbildung[k] = String(v); }
};
globalThis.window = { confirm: () => true, alert: () => {}, scrollTo: () => {}, addEventListener: () => {} };
globalThis.setInterval = () => 0;

// app.js lädt beim Import mit dem echten (funktionierenden) localStorage oben.
// Die Absicherung selbst wird danach gezielt mit einem gesperrten
// localStorage getestet, ohne die App neu laden zu müssen.
const { nutzbarerSpeicher } = await import("../app.js");

test("nutzbarerSpeicher liefert einen Ersatz im Arbeitsspeicher, wenn der Zugriff auf localStorage wirft", () => {
  const echterSpeicher = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new Error("Der Zugriff auf den Seitenspeicher ist gesperrt."); }
  });
  const { speicher, ersatz } = nutzbarerSpeicher();
  assert.equal(ersatz, true, "Ersatzspeicher wurde nicht erkannt");
  speicher.setItem("test", "1");
  assert.equal(speicher.getItem("test"), "1", "Ersatzspeicher funktioniert nicht wie ein echter Speicher");

  // echten Speicher für nachfolgende Tests im selben Prozess wiederherstellen
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: echterSpeicher
  });
});

test("nutzbarerSpeicher nutzt den echten Speicher, wenn er erreichbar ist", () => {
  const { speicher, ersatz } = nutzbarerSpeicher();
  assert.equal(ersatz, false);
  assert.equal(speicher, globalThis.localStorage);
});
