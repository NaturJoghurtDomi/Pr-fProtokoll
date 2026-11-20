import { el, knopf, karte, feld, abschnitt, frage } from "./ui.js";
import { csvText, csvDateiname, jsonText, jsonPruefen, zusammenfuehren } from "./export.js";
import { leereDaten } from "./store.js";
import { heute, formatDatum } from "./datum.js";

const LISTEN = [
  ["bauteil", "Bauteile"],
  ["befund", "Befunde"],
  ["art", "Fehlerarten"],
  ["verantwortlich", "Verantwortlich"],
  ["ausstattung", "Ausstattung"],
  ["typ", "Anlagentypen"]
];

function herunterladen(dateiname, text, typ) {
  const url = URL.createObjectURL(new Blob([text], { type: typ }));
  const verweis = el("a", { href: url, download: dateiname });
  document.body.append(verweis);
  verweis.click();
  verweis.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function rendern(ctx) {
  return el("div", {}, [
    el("h1", { text: "Daten" }),
    exportBlock(ctx),
    importBlock(ctx),
    listenBlock(ctx),
    nummernBlock(ctx),
    loeschBlock(ctx)
  ]);
}

function exportBlock(ctx) {
  const anzahl = ctx.daten.anlagen.filter(a => a.status === "abgeschlossen").length;
  const letzter = ctx.daten.letzterExport
    ? `Letzter Export am ${formatDatum(new Date(ctx.daten.letzterExport).toLocaleDateString("sv-SE"))}`
    : "Noch nie exportiert";
  return karte([
    el("div", { class: "marke", text: "Export" }),
    el("p", { class: "neben", text: `${anzahl} abgeschlossene Anlagen · ${letzter}` }),
    knopf("CSV für Excel", () => {
      herunterladen(csvDateiname(heute()), csvText(ctx.daten.anlagen), "text/csv;charset=utf-8");
      ctx.daten.letzterExport = Date.now();
      ctx.sichern();
    }, "haupt"),
    knopf("Sicherung als JSON", () => {
      herunterladen(`pruefprotokoll_sicherung_${heute()}.json`, jsonText(ctx.daten), "application/json");
      ctx.daten.letzterExport = Date.now();
      ctx.sichern();
    })
  ], "mt");
}

function importBlock(ctx) {
  const eingabe = el("input", {
    type: "file", accept: ".json,application/json",
    onchange: e => {
      const datei = e.target.files?.[0];
      if (!datei) return;
      const leser = new FileReader();
      leser.onload = () => {
        const geprueft = jsonPruefen(String(leser.result));
        if (!geprueft.ok) { window.alert(geprueft.grund); return; }
        const anzahl = geprueft.daten.anlagen.length;
        if (!frage(`${anzahl} Anlagen einlesen? Einträge mit gleicher Kennung werden ersetzt, alles andere bleibt.`)) return;
        ctx.daten = zusammenfuehren(ctx.daten, geprueft.daten);
        ctx.sichern();
      };
      leser.onerror = () => window.alert("Die Datei konnte nicht gelesen werden.");
      leser.readAsText(datei);
    }
  });
  return karte([
    el("div", { class: "marke", text: "Sicherung einlesen" }),
    feld("JSON-Datei wählen", eingabe)
  ]);
}

function listenBlock(ctx) {
  const v = ctx.ansicht;
  const schluessel = v.listeOffen ?? "bauteil";
  const auswahl = el("select", {
    onchange: e => { v.listeOffen = e.target.value; ctx.zeichne(); }
  }, LISTEN.map(([k, t]) => el("option", { value: k, text: t, selected: schluessel === k })));

  const neuesFeld = el("input", { type: "text", placeholder: "Neuer Eintrag" });
  const zeilen = ctx.daten.listen[schluessel].map(wert =>
    el("div", { class: "reihe" }, [
      el("div", { class: "haupt", text: wert }),
      el("button", {
        class: "weg-klein", type: "button", text: "✕", title: "entfernen",
        onclick: () => {
          if (!frage(`"${wert}" aus der Liste nehmen? Bereits erfasste Einträge behalten den Wert.`)) return;
          ctx.daten.listen[schluessel] = ctx.daten.listen[schluessel].filter(x => x !== wert);
          ctx.sichern();
        }
      })
    ]));

  return abschnitt("Listen pflegen", karte([
    feld("Liste", auswahl),
    ...zeilen,
    feld("Hinzufügen", neuesFeld),
    knopf("Eintrag hinzufügen", () => {
      const wert = neuesFeld.value.trim();
      if (!wert || ctx.daten.listen[schluessel].includes(wert)) return;
      ctx.daten.listen[schluessel].push(wert);
      ctx.sichern();
    })
  ]));
}

function nummernBlock(ctx) {
  const eintraege = Object.entries(ctx.daten.listen.nummern)
    .filter(([, liste]) => liste.length > 0);
  if (!eintraege.length) {
    return abschnitt("Nummern je Typ", el("p", { class: "leer", text: "Noch keine Nummern gelernt." }));
  }
  return abschnitt("Nummern je Typ", karte(eintraege.map(([typ, liste]) =>
    el("div", { class: "reihe" }, [
      el("div", { class: "haupt", text: `${typ}: ${liste.join(", ")}` }),
      el("button", {
        class: "weg-klein", type: "button", text: "✕", title: "alle Nummern dieses Typs vergessen",
        onclick: () => {
          if (!frage(`Alle gelernten Nummern für ${typ} vergessen?`)) return;
          delete ctx.daten.listen.nummern[typ];
          ctx.sichern();
        }
      })
    ]))));
}

function loeschBlock(ctx) {
  return abschnitt("Gefahrenzone", knopf("Alle Daten löschen", () => {
    if (!frage("Wirklich alle Anlagen und Fehler löschen?")) return;
    if (!frage("Letzte Warnung. Ohne Sicherung sind die Daten weg. Jetzt löschen?")) return;
    ctx.daten = leereDaten();
    ctx.ansicht.anlageId = null;
    ctx.ansicht.fehlerFluss = null;
    ctx.sichern();
  }, "weg"));
}
