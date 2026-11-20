const BREITE = 320;
const ZEILE = 44;
const BALKEN = 10;
const RADIUS = 4;
const LABEL_GRENZE = 32;

function sicher(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Kürzt lange Beschriftungen mit Auslassungszeichen, damit links Platz für
// den Namen und rechts Platz für den Wert bleibt. Der volle Wert steht
// weiterhin im Protokoll und im CSV-Export, hier geht es nur um das Diagramm.
function kuerzeLabel(text) {
  const s = String(text ?? "");
  return s.length > LABEL_GRENZE ? s.slice(0, LABEL_GRENZE - 1).trimEnd() + "…" : s;
}

export function leerHinweis(text = "Noch keine Daten für diesen Zeitraum") {
  return `<p class="leer">${sicher(text)}</p>`;
}

// Waagerecht: rundet das rechte Ende, bleibt am Nullpunkt links eckig.
function balkenPfad(x, y, breite, hoehe, radius) {
  if (breite <= 0) return "";
  const r = Math.min(radius, breite, hoehe / 2);
  return `M${x},${y} H${x + breite - r} a${r},${r} 0 0 1 ${r},${r}` +
    ` V${y + hoehe - r} a${r},${r} 0 0 1 ${-r},${r} H${x} Z`;
}

// Senkrecht: rundet das obere Ende, bleibt auf der Grundlinie unten eckig.
function saeulenPfad(x, y, breite, hoehe, radius) {
  if (hoehe <= 0) return "";
  const r = Math.min(radius, breite / 2, hoehe);
  return `M${x},${y + hoehe} V${y + r} a${r},${r} 0 0 1 ${r},${-r}` +
    ` H${x + breite - r} a${r},${r} 0 0 1 ${r},${r} V${y + hoehe} Z`;
}

export function balkenWaagerecht(reihe, { breite = BREITE } = {}) {
  if (!reihe.length) return leerHinweis();
  const max = Math.max(...reihe.map(e => e.wert), 0);
  const hoehe = reihe.length * ZEILE;
  const teile = reihe.map((e, i) => {
    const y = i * ZEILE;
    const laenge = max > 0 ? Math.max(0, (e.wert / max) * breite) : 0;
    const zusatz = e.zusatz ? ` <tspan class="zusatz">${sicher(e.zusatz)}</tspan>` : "";
    return `
  <text class="balkenname" x="0" y="${y + 13}">${sicher(kuerzeLabel(e.label))}</text>
  <text class="balkenwert" x="${breite}" y="${y + 13}" text-anchor="end">${sicher(e.anzeige)}${zusatz}</text>
  <rect class="spur" x="0" y="${y + 20}" width="${breite}" height="${BALKEN}" rx="${RADIUS}"/>
  <path class="balken${e.schwach ? " schwach" : ""}" data-breite="${laenge.toFixed(1)}" d="${balkenPfad(0, y + 20, laenge, BALKEN, RADIUS)}"/>`;
  }).join("");
  return `<svg class="diagramm" viewBox="0 0 ${breite} ${hoehe}" width="100%" height="${hoehe}" role="img">${teile}
</svg>`;
}

export function balkenSenkrecht(reihe, { breite = BREITE, hoehe = 150 } = {}) {
  if (!reihe.length) return leerHinweis();
  const max = Math.max(...reihe.map(e => e.wert), 0);
  const boden = hoehe - 26;
  const schritt = breite / reihe.length;
  const dicke = Math.min(24, schritt - 6);
  const hoechsterIndex = reihe.reduce((best, e, i) => (e.wert > reihe[best].wert ? i : best), 0);
  const teile = reihe.map((e, i) => {
    const h = max > 0 ? Math.max(0, (e.wert / max) * (boden - 18)) : 0;
    const x = i * schritt + (schritt - dicke) / 2;
    const y = boden - h;
    const beschriften = i === hoechsterIndex || i === reihe.length - 1;
    const wert = beschriften
      ? `<text class="balkenwert" x="${x + dicke / 2}" y="${y - 5}" text-anchor="middle">${sicher(e.anzeige)}</text>`
      : "";
    return `
  <path class="balken${e.schwach ? " schwach" : ""}" data-breite="${h.toFixed(1)}" d="${saeulenPfad(x, y, dicke, h, RADIUS)}"/>
  ${wert}
  <text class="balkenname" x="${x + dicke / 2}" y="${hoehe - 6}" text-anchor="middle">${sicher(e.label)}</text>`;
  }).join("");
  return `<svg class="diagramm" viewBox="0 0 ${breite} ${hoehe}" width="100%" height="${hoehe}" role="img">
  <line class="achse" x1="0" y1="${boden}" x2="${breite}" y2="${boden}"/>${teile}
</svg>`;
}
