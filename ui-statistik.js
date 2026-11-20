import { el, karte, raster, feld, abschnitt, svgBlock } from "./ui.js";
import { abgeschlossene, kennzahlen, gruppiereFehler, quoteJeTyp, quoteJeAusstattung, quoteJeKW } from "./stats.js";
import { balkenWaagerecht, balkenSenkrecht } from "./charts.js";
import { wochenstart, monatsstart, vorperiode, heute, formatDauer } from "./datum.js";

const ZEITRAEUME = [
  { schluessel: "woche", text: "Diese Woche" },
  { schluessel: "monat", text: "Dieser Monat" },
  { schluessel: "alles", text: "Alles" },
  { schluessel: "eigen", text: "Eigener" }
];

const BLOECKE = [
  { feld: "art", anzahl: "Fehler je Fehlerart", zeit: "Behebungszeit je Fehlerart" },
  { feld: "verantwortlich", anzahl: "Fehler je Verantwortlichem", zeit: "Behebungszeit je Verantwortlichem" },
  { feld: "bauteil", anzahl: "Fehler je Bauteil", zeit: "Behebungszeit je Bauteil" },
  { feld: "paar", anzahl: "Häufigste Bauteil-Befund-Paare", zeit: "Zeitfresser nach Bauteil und Befund" }
];

function prozent(anteil) {
  return anteil === null ? "–" : `${Math.round(anteil * 100)} %`;
}

function zahl(wert, stellen = 2) {
  return wert === null ? "–" : wert.toFixed(stellen).replace(".", ",");
}

function grenzen(v) {
  if (v.zeitraum === "woche") return { von: wochenstart(heute()), bis: heute() };
  if (v.zeitraum === "monat") return { von: monatsstart(heute()), bis: heute() };
  if (v.zeitraum === "eigen") return { von: v.von || null, bis: v.bis || null };
  return { von: null, bis: null };
}

export function rendern(ctx) {
  const v = ctx.ansicht;
  const { von, bis } = grenzen(v);
  const liste = abgeschlossene(ctx.daten.anlagen, von, bis);
  const k = kennzahlen(liste);
  const vor = vorperiode(von, bis);
  const kVor = vor ? kennzahlen(abgeschlossene(ctx.daten.anlagen, vor.von, vor.bis)) : null;

  return el("div", {}, [
    el("h1", { text: "Statistik" }),
    zeitraumWahl(ctx, v),
    heldenZahl(k, kVor),
    kachelGitter(k),
    mengenDiagramme(ctx, v, liste),
    quotenDiagramme(v, liste, ctx)
  ]);
}

function zeitraumWahl(ctx, v) {
  const aktiv = ZEITRAEUME.find(z => z.schluessel === v.zeitraum)?.text ?? "Dieser Monat";
  const eigen = v.zeitraum === "eigen" ? karte([
    feld("Von", el("input", {
      type: "date", value: v.von ?? "",
      onchange: e => { v.von = e.target.value || null; ctx.zeichne(); }
    })),
    feld("Bis", el("input", {
      type: "date", value: v.bis ?? "",
      onchange: e => { v.bis = e.target.value || null; ctx.zeichne(); }
    }))
  ]) : null;
  return el("div", { class: "mt" }, [
    raster(ZEITRAEUME.map(z => z.text), aktiv, text => {
      v.zeitraum = ZEITRAEUME.find(z => z.text === text).schluessel;
      ctx.zeichne();
    }, "breit"),
    eigen
  ]);
}

function heldenZahl(k, kVor) {
  const kinder = [
    el("div", { class: "marke", text: "Fehlerquote" }),
    el("div", { class: "held", text: prozent(k.fehlerquote) }),
    el("div", { class: "neben", text: `${k.anlagen} Anlagen geprüft` })
  ];
  if (k.fehlerquote !== null && kVor && kVor.fehlerquote !== null) {
    const d = (k.fehlerquote - kVor.fehlerquote) * 100;
    const richtung = d > 0.5 ? "hoch" : d < -0.5 ? "runter" : "";
    kinder.push(el("div", {
      class: "delta " + richtung,
      text: `${d > 0 ? "+" : ""}${zahl(d, 1)} Prozentpunkte zur Vorperiode`
    }));
  }
  return karte(kinder, "mt");
}

function kachelGitter(k) {
  const kacheln = [
    ["Anlagen geprüft", String(k.anlagen), ""],
    ["Davon fehlerfrei", String(k.fehlerfrei), prozent(k.fehlerfreiQuote)],
    ["Fehler gesamt", String(k.fehlerGesamt), ""],
    ["Fehler je Anlage", zahl(k.fehlerJeAnlage), ""],
    ["Offene Fehler", String(k.offeneFehler), ""],
    ["Zeit gesamt", formatDauer(k.zeitGesamt), ""],
    ["Zeit je Fehler", k.zeitJeFehler === null ? "–" : formatDauer(k.zeitJeFehler),
      k.fehlerOhneZeit ? `${k.fehlerOhneZeit} Fehler ohne Zeit` : ""],
    ["Zeit je Anlage", k.zeitJeAnlage === null ? "–" : formatDauer(k.zeitJeAnlage), ""],
    ["Zeit ohne Fehlerbezug", formatDauer(k.zeitOhneBezug), "Suche ohne Befund"]
  ];
  return abschnitt("Überblick", el("div", { class: "kacheln" }, kacheln.map(([marke, wert, fuss]) =>
    el("div", { class: "kachel" }, [
      el("div", { class: "marke", text: marke }),
      el("div", { class: "wert", text: wert }),
      fuss ? el("div", { class: "fuss", text: fuss }) : null
    ]))));
}

// Nur das Diagramm der Bauteil-Befund-Paare wird auf die zehn größten Gruppen
// gekürzt, die anderen drei Mengendiagramme zeigen alle Gruppen vollständig.
export function mengenReihe(gruppen, mass, begrenzen = false) {
  const sortiert = gruppen
    .map(g => mass === "zeit"
      ? { label: g.label, wert: g.zeitSekunden, anzeige: formatDauer(g.zeitSekunden), zusatz: `(${g.anzahl})`, schwach: false }
      : { label: g.label, wert: g.anzahl, anzeige: String(g.anzahl), zusatz: "", schwach: false })
    .sort((a, b) => b.wert - a.wert);
  return begrenzen ? sortiert.slice(0, 10) : sortiert;
}

function mengenDiagramme(ctx, v, liste) {
  const umschalter = raster(["Anzahl", "Zeit"], v.mass === "zeit" ? "Zeit" : "Anzahl", text => {
    v.mass = text === "Zeit" ? "zeit" : "anzahl";
    ctx.zeichne();
  });
  const teile = BLOECKE.map(b => abschnitt(
    v.mass === "zeit" ? b.zeit : b.anzahl,
    svgBlock(balkenWaagerecht(mengenReihe(gruppiereFehler(liste, b.feld), v.mass, b.feld === "paar")))
  ));
  return el("div", {}, [
    el("h2", { text: "Fehler aufschlüsseln" }),
    umschalter,
    el("p", { class: "neben", text: v.mass === "zeit"
      ? "Balken zeigen die summierte Behebungszeit, die Klammer die Zahl der Fehler."
      : "Balken zeigen, wie oft etwas vorkommt." }),
    ...teile
  ]);
}

// Nur für die Anzeige im Säulendiagramm: "2026-KW35" wird zu "KW35", weil
// zwölf Säulen auf 320 Einheiten Breite für das Jahr keinen Platz lassen.
// kwLabel in datum.js bleibt unverändert, der CSV-Export braucht das Jahr.
export function kwKurz(label) {
  return label.replace(/^\d{4}-/, "");
}

function quotenReihe(gruppen) {
  return gruppen.map(g => ({
    label: g.label,
    wert: g.wert,
    anzeige: prozent(g.wert),
    zusatz: `n=${g.grundlage}`,
    schwach: g.grundlage < 3
  }));
}

function quotenDiagramme(v, liste, ctx) {
  const typUmschalter = raster(["Typ", "Typ und Nummer"], v.mitNummer ? "Typ und Nummer" : "Typ", text => {
    v.mitNummer = text === "Typ und Nummer";
    ctx.zeichne();
  }, "breit");
  return el("div", {}, [
    el("h2", { text: "Fehlerquote je Anlagentyp" }),
    typUmschalter,
    svgBlock(balkenWaagerecht(quotenReihe(quoteJeTyp(liste, v.mitNummer)))),
    abschnitt("Fehlerquote je Kalenderwoche", svgBlock(balkenSenkrecht(
      quotenReihe(quoteJeKW(liste, 12)).map(e => ({ ...e, label: kwKurz(e.label) }))
    ))),
    abschnitt("Fehlerquote je Ausstattung", svgBlock(balkenWaagerecht(quotenReihe(quoteJeAusstattung(liste))))),
    el("p", { class: "neben", text: "Blasse Balken beruhen auf weniger als drei Anlagen und sagen wenig aus." })
  ]);
}
