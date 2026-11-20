import { el, knopf, raster, karte, feld, abschnitt, posten, frage } from "./ui.js";
import { neueAnlage, merkeNummer, neuerFehler, zeitStart, zeitStopp, zeitOffen } from "./store.js";
import { formatDatum, formatDauer, formatUhr, heute } from "./datum.js";

export function rendern(ctx) {
  const detail = detailAnsicht(ctx);
  if (detail) return detail;
  if (ctx.ansicht.neu) return neuFluss(ctx);
  return startseite(ctx);
}

export function detailAnsicht(ctx) {
  if (ctx.ansicht.fehlerFluss) return fehlerFluss(ctx);
  const a = ctx.anlage();
  return a ? anlagenKarte(ctx, a) : null;
}

function startseite(ctx) {
  const offene = ctx.daten.anlagen.filter(a => a.status === "offen");
  return el("div", {}, [
    el("h1", { text: "Erfassen" }),
    el("p", { class: "neben", text: formatDatum(heute()) }),
    knopf("Neue Anlage", () => { ctx.ansicht.neu = { typ: null }; ctx.zeichne(true); }, "haupt mt"),
    abschnitt("In Arbeit", offene.length
      ? offene.map(a => postenFuer(ctx, a))
      : el("p", { class: "leer", text: "Keine Anlage in Arbeit." }))
  ]);
}

export function postenFuer(ctx, a) {
  const marker = [];
  if (a.laufStart) marker.push({ art: "laeuft", text: "läuft" });
  if (a.fehler.some(f => f.status === "offen")) marker.push({ art: "offen", text: "offen" });
  marker.push(a.fehler.length
    ? { art: "", text: `${a.fehler.length} Fehler` }
    : { art: "gut", text: "fehlerfrei" });
  const gesamt = a.fehler.reduce((s, f) => s + (f.zeitSekunden || 0), 0)
    + (a.sucheSekunden || 0) + (a.offeneZeitSekunden || 0);
  const neben = [
    formatDatum(a.datum),
    a.auftrag ? "FA " + a.auftrag : null,
    gesamt ? formatDauer(gesamt) : null
  ].filter(Boolean).join(" · ");
  return posten(`${a.typ} ${a.nummer}`, neben, marker, () => {
    ctx.ansicht.anlageId = a.id;
    ctx.zeichne(true);
  });
}

function neuFluss(ctx) {
  const { typ } = ctx.ansicht.neu;
  if (!typ) {
    return el("div", {}, [
      el("h1", { text: "Anlagentyp" }),
      el("p", { class: "neben", text: "Schritt 1 von 2" }),
      el("div", { class: "mt" }, raster(ctx.daten.listen.typ, null, w => {
        ctx.ansicht.neu.typ = w;
        ctx.zeichne(true);
      })),
      knopf("Abbrechen", () => { ctx.ansicht.neu = null; ctx.zeichne(); }, "mt")
    ]);
  }
  const bekannt = ctx.daten.listen.nummern[typ] ?? [];
  const eingabe = el("input", { type: "text", inputmode: "numeric", placeholder: "z. B. 40" });
  return el("div", {}, [
    el("h1", { text: typ }),
    el("p", { class: "neben", text: "Schritt 2 von 2, Nummer wählen" }),
    bekannt.length
      ? el("div", { class: "mt" }, raster(bekannt, null, w => anlegen(ctx, typ, w)))
      : el("p", { class: "leer", text: "Für diesen Typ ist noch keine Nummer bekannt. Einmal eintippen, danach steht sie hier als Knopf." }),
    karte([
      feld("Neue Nummer", eingabe),
      knopf("Anlegen", () => {
        const wert = eingabe.value.trim();
        if (!wert) { eingabe.focus(); return; }
        anlegen(ctx, typ, wert);
      }, "haupt")
    ], "mt"),
    knopf("Typ ändern", () => { ctx.ansicht.neu.typ = null; ctx.zeichne(); }),
    knopf("Abbrechen", () => { ctx.ansicht.neu = null; ctx.zeichne(); })
  ]);
}

function anlegen(ctx, typ, nummer) {
  const a = neueAnlage(typ, nummer, heute());
  ctx.daten.anlagen.push(a);
  merkeNummer(ctx.daten, typ, nummer);
  ctx.ansicht.neu = null;
  ctx.ansicht.anlageId = a.id;
  ctx.sichern();
}

function anlagenKarte(ctx, a) {
  const offen = a.status === "offen";
  return el("div", {}, [
    el("h1", { text: `${a.typ} ${a.nummer}` }),
    el("p", { class: "neben", text: formatDatum(a.datum) + (offen ? "" : " · abgeschlossen") }),
    karte([
      feld("Fertigungsauftrag, optional", el("input", {
        type: "text", inputmode: "numeric", value: a.auftrag,
        oninput: e => { a.auftrag = e.target.value.trim(); ctx.sichern(false); }
      })),
      el("div", { class: "marke", text: "Ausstattung" }),
      raster(ctx.daten.listen.ausstattung, a.ausstattung, w => {
        const i = a.ausstattung.indexOf(w);
        if (i >= 0) a.ausstattung.splice(i, 1); else a.ausstattung.push(w);
        ctx.sichern();
      }, "breit")
    ], "mt"),
    offen ? zeitBlock(ctx, a) : zeitZeile(a),
    fehlerBlock(ctx, a),
    karte([feld("Notiz", el("textarea", {
      text: a.notiz,
      oninput: e => { a.notiz = e.target.value; ctx.sichern(false); }
    }))]),
    ...abschlussKnoepfe(ctx, a),
    knopf("Zurück", () => { ctx.ansicht.anlageId = null; ctx.zeichne(true); }),
    knopf("Anlage löschen", () => {
      if (!frage(`${a.typ} ${a.nummer} mit ${a.fehler.length} Fehlern wirklich löschen?`)) return;
      ctx.daten.anlagen = ctx.daten.anlagen.filter(x => x.id !== a.id);
      ctx.ansicht.anlageId = null;
      ctx.sichern();
    }, "weg mt")
  ]);
}

function zeitZeile(a) {
  return karte([
    el("div", { class: "marke", text: "Fehlersuche" }),
    el("div", { class: "neben", text: `der Anlage zugeschrieben: ${formatDauer(a.sucheSekunden)}` })
  ]);
}

function zeitBlock(ctx, a) {
  const laeuft = Boolean(a.laufStart);
  const zugeschrieben = a.sucheSekunden
    ? `der Anlage zugeschrieben: ${formatDauer(a.sucheSekunden)}`
    : "wird beim Speichern eines Fehlers übernommen";
  return karte([
    el("div", { class: "marke", text: "Fehlersuche" }),
    el("div", { class: "uhr", "data-timer": a.id, text: formatUhr(zeitOffen(a, Date.now())) }),
    el("div", { class: "neben", text: zugeschrieben }),
    knopf(laeuft ? "Stopp" : "Fehlersuche starten", () => {
      if (laeuft) zeitStopp(a); else zeitStart(ctx.daten, a);
      ctx.sichern();
    }, (laeuft ? "weg" : "haupt") + " mt")
  ]);
}

function abschlussKnoepfe(ctx, a) {
  if (a.status !== "offen") {
    return [knopf("Wieder öffnen", () => {
      a.status = "offen";
      a.abgeschlossenAm = null;
      ctx.sichern();
    }, "mt")];
  }
  return [knopf(a.fehler.length ? "Abschließen" : "Fehlerfrei abschließen",
    () => abschliessen(ctx, a),
    (a.fehler.length ? "haupt" : "gut") + " mt")];
}

function abschliessen(ctx, a) {
  if (!a.typ || !a.nummer) return;
  zeitStopp(a, Date.now());
  a.sucheSekunden += a.offeneZeitSekunden;
  a.offeneZeitSekunden = 0;
  a.status = "abgeschlossen";
  a.abgeschlossenAm = Date.now();
  ctx.ansicht.anlageId = null;
  ctx.sichern();
}

const SCHRITTE = [
  { schluessel: "art", titel: "Fehlerart", liste: "art" },
  { schluessel: "verantwortlich", titel: "Verantwortlich", liste: "verantwortlich" },
  { schluessel: "bauteil", titel: "Bauteil", liste: "bauteil" },
  { schluessel: "befund", titel: "Was genau", liste: "befund" }
];

function fehlerBlock(ctx, a) {
  return karte([
    el("div", { class: "marke", text: `Fehler (${a.fehler.length})` }),
    ...a.fehler.map(f => fehlerZeile(ctx, a, f)),
    knopf("Fehler erfassen", () => {
      zeitStopp(a, Date.now());
      ctx.ansicht.fehlerFluss = { anlageId: a.id, schritt: 0, felder: {}, bearbeitet: null };
      ctx.sichern(false);
      ctx.zeichne(true);
    }, "mt")
  ]);
}

function fehlerZeile(ctx, a, f) {
  const neben = [f.art, f.verantwortlich, f.zeitSekunden ? formatDauer(f.zeitSekunden) : null, f.detail || null]
    .filter(Boolean).join(" · ");
  return posten(`${f.bauteil} ${f.befund}`.trim(), neben,
    [f.status === "offen" ? { art: "offen", text: "offen" } : null],
    () => {
      ctx.ansicht.fehlerFluss = { anlageId: a.id, schritt: 4, felder: { ...f }, bearbeitet: f.id };
      ctx.zeichne(true);
    });
}

function fehlerFluss(ctx) {
  const fluss = ctx.ansicht.fehlerFluss;
  const a = ctx.daten.anlagen.find(x => x.id === fluss.anlageId);
  if (!a) {
    ctx.ansicht.fehlerFluss = null;
    return el("div", { class: "leer", text: "Die Anlage gibt es nicht mehr." });
  }
  if (fluss.schritt < SCHRITTE.length) {
    const s = SCHRITTE[fluss.schritt];
    return el("div", {}, [
      el("h1", { text: s.titel }),
      el("p", { class: "neben", text: `${a.typ} ${a.nummer} · Schritt ${fluss.schritt + 1} von 4` }),
      el("div", { class: "mt" }, raster(ctx.daten.listen[s.liste], fluss.felder[s.schluessel], w => {
        fluss.felder[s.schluessel] = w;
        fluss.schritt += 1;
        ctx.zeichne(true);
      }, "breit")),
      knopf(fluss.schritt === 0 ? "Abbrechen" : "Zurück", () => {
        if (fluss.schritt === 0) ctx.ansicht.fehlerFluss = null;
        else fluss.schritt -= 1;
        ctx.zeichne(true);
      }, "mt")
    ]);
  }
  return zusammenfassung(ctx, a, fluss);
}

function zusammenfassung(ctx, a, fluss) {
  const f = fluss.felder;
  if (f.zeitSekunden === undefined) f.zeitSekunden = a.offeneZeitSekunden;
  if (f.status === undefined) f.status = "behoben";

  const minutenFeld = el("input", {
    type: "text", inputmode: "numeric",
    value: String(Math.round(f.zeitSekunden / 60)),
    onchange: e => {
      const m = Math.max(0, Math.round(Number(String(e.target.value).replace(",", ".")) || 0));
      f.zeitSekunden = m * 60;
      e.target.value = String(m);
    }
  });
  const stelle = n => {
    f.zeitSekunden = Math.max(0, f.zeitSekunden + n * 60);
    minutenFeld.value = String(Math.round(f.zeitSekunden / 60));
  };

  return el("div", {}, [
    el("h1", { text: `${f.bauteil} ${f.befund}`.trim() }),
    el("p", { class: "neben", text: `${a.typ} ${a.nummer} · ${f.art} · ${f.verantwortlich}` }),
    karte([
      feld("Detail, optional", el("input", {
        type: "text", value: f.detail ?? "", placeholder: "z. B. Ventil 3 oben",
        oninput: e => { f.detail = e.target.value; }
      })),
      el("div", { class: "marke", text: "Zeit für Suche und Behebung in Minuten" }),
      el("div", { class: "zeitreihe" }, [
        el("button", { class: "schritt", type: "button", text: "−5", onclick: () => stelle(-5) }),
        minutenFeld,
        el("button", { class: "schritt", type: "button", text: "+5", onclick: () => stelle(5) })
      ]),
      el("div", { class: "marke", text: "Status" }),
      raster(["behoben", "offen"], f.status, w => { f.status = w; ctx.zeichne(); })
    ], "mt"),
    knopf(fluss.bearbeitet ? "Änderung speichern" : "Fehler speichern", () => speichereFehler(ctx, a, fluss), "haupt mt"),
    knopf("Auswahl ändern", () => { fluss.schritt = 0; ctx.zeichne(true); }),
    fluss.bearbeitet
      ? knopf("Fehler löschen", () => {
          if (!frage("Diesen Fehler löschen?")) return;
          a.fehler = a.fehler.filter(x => x.id !== fluss.bearbeitet);
          ctx.ansicht.fehlerFluss = null;
          ctx.sichern();
        }, "weg")
      : knopf("Abbrechen", () => { ctx.ansicht.fehlerFluss = null; ctx.zeichne(true); })
  ]);
}

function speichereFehler(ctx, a, fluss) {
  const f = fluss.felder;
  if (fluss.bearbeitet) {
    const alt = a.fehler.find(x => x.id === fluss.bearbeitet);
    if (alt) {
      Object.assign(alt, {
        art: f.art, verantwortlich: f.verantwortlich, bauteil: f.bauteil, befund: f.befund,
        detail: f.detail ?? "", status: f.status ?? "behoben", zeitSekunden: f.zeitSekunden ?? 0
      });
    }
  } else {
    a.fehler.push(neuerFehler(f));
    a.offeneZeitSekunden = 0;
    a.laufStart = null;
  }
  ctx.ansicht.fehlerFluss = null;
  ctx.sichern();
}
