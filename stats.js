import { kwLabel } from "./datum.js";

export function abgeschlossene(anlagen, von, bis) {
  return anlagen.filter(a =>
    a.status === "abgeschlossen" &&
    (!von || a.datum >= von) &&
    (!bis || a.datum <= bis));
}

function teile(zaehler, nenner) {
  return nenner > 0 ? zaehler / nenner : null;
}

export function kennzahlen(anlagen) {
  const alleFehler = anlagen.flatMap(a => a.fehler);
  const mitZeit = alleFehler.filter(f => f.zeitSekunden > 0);
  const zeitFehler = alleFehler.reduce((s, f) => s + (f.zeitSekunden || 0), 0);
  const zeitOhneBezug = anlagen.reduce((s, a) => s + (a.sucheSekunden || 0), 0);
  const fehlerfrei = anlagen.filter(a => a.fehler.length === 0).length;
  return {
    anlagen: anlagen.length,
    fehlerfrei,
    fehlerfreiQuote: teile(fehlerfrei, anlagen.length),
    fehlerquote: teile(anlagen.length - fehlerfrei, anlagen.length),
    fehlerGesamt: alleFehler.length,
    fehlerJeAnlage: teile(alleFehler.length, anlagen.length),
    offeneFehler: alleFehler.filter(f => f.status === "offen").length,
    zeitGesamt: zeitFehler + zeitOhneBezug,
    zeitJeFehler: teile(mitZeit.reduce((s, f) => s + f.zeitSekunden, 0), mitZeit.length),
    fehlerOhneZeit: alleFehler.length - mitZeit.length,
    zeitJeAnlage: teile(zeitFehler + zeitOhneBezug, anlagen.length),
    zeitOhneBezug
  };
}

function absteigend(eintraege) {
  return eintraege.sort((a, b) => b.wert - a.wert || a.label.localeCompare(b.label));
}

export function gruppiereFehler(anlagen, feld) {
  const topf = new Map();
  for (const a of anlagen) {
    for (const f of a.fehler) {
      const label = feld === "paar" ? `${f.bauteil} ${f.befund}`.trim() : (f[feld] || "ohne Angabe");
      const e = topf.get(label) ?? { label, wert: 0, anzahl: 0, zeitSekunden: 0, grundlage: null };
      e.anzahl += 1;
      e.wert += 1;
      e.zeitSekunden += f.zeitSekunden || 0;
      topf.set(label, e);
    }
  }
  return absteigend([...topf.values()]);
}

function quoteAus(gruppen) {
  return absteigend([...gruppen.values()].map(g => ({
    label: g.label,
    wert: g.anlagen > 0 ? g.mitFehler / g.anlagen : 0,
    anzahl: g.mitFehler,
    zeitSekunden: g.zeitSekunden,
    grundlage: g.anlagen
  })));
}

function sammle(topf, label, anlage) {
  const g = topf.get(label) ?? { label, anlagen: 0, mitFehler: 0, zeitSekunden: 0 };
  g.anlagen += 1;
  if (anlage.fehler.length > 0) g.mitFehler += 1;
  g.zeitSekunden += anlage.fehler.reduce((s, f) => s + (f.zeitSekunden || 0), 0) + (anlage.sucheSekunden || 0);
  topf.set(label, g);
  return g;
}

export function quoteJeTyp(anlagen, mitNummer) {
  const topf = new Map();
  for (const a of anlagen) {
    const label = mitNummer ? [a.typ, a.nummer].filter(Boolean).join(" ") : a.typ;
    sammle(topf, label || "ohne Angabe", a);
  }
  return quoteAus(topf);
}

export function quoteJeAusstattung(anlagen) {
  const topf = new Map();
  for (const a of anlagen) {
    for (const merkmal of new Set(a.ausstattung ?? [])) sammle(topf, merkmal, a);
  }
  return quoteAus(topf);
}

export function quoteJeKW(anlagen, maxWochen = 12) {
  const topf = new Map();
  for (const a of anlagen) sammle(topf, kwLabel(a.datum), a);
  const alle = [...topf.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(g => ({
      label: g.label,
      wert: g.anlagen > 0 ? g.mitFehler / g.anlagen : 0,
      anzahl: g.mitFehler,
      zeitSekunden: g.zeitSekunden,
      grundlage: g.anlagen
    }));
  return alle.slice(-maxWochen);
}
