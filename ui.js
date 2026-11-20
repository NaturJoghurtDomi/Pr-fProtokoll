export function el(tag, attrs = {}, kinder = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kind of [].concat(kinder)) {
    if (kind !== null && kind !== undefined && kind !== false) n.append(kind);
  }
  return n;
}

export function knopf(text, beiKlick, klasse = "") {
  return el("button", { class: ("knopf " + klasse).trim(), type: "button", text, onclick: beiKlick });
}

export function raster(werte, aktiv, beiWahl, klasse = "") {
  const aktive = Array.isArray(aktiv) ? aktiv : [aktiv];
  return el("div", { class: ("raster " + klasse).trim() }, werte.map(w =>
    el("button", {
      class: "wahl" + (aktive.includes(w) ? " an" : ""),
      type: "button", text: w, onclick: () => beiWahl(w)
    })));
}

export function karte(kinder, klasse = "") {
  return el("div", { class: ("karte " + klasse).trim() }, kinder);
}

export function feld(beschriftung, eingabe) {
  return el("label", { class: "feld" }, [el("span", { text: beschriftung }), eingabe]);
}

export function abschnitt(titel, kinder) {
  return el("section", {}, [titel ? el("h2", { text: titel }) : null, ...[].concat(kinder)]);
}

export function posten(titel, neben, marker, beiKlick) {
  return el("button", { class: "posten", type: "button", onclick: beiKlick }, [
    el("div", { class: "haupt" }, [
      el("div", { class: "titel", text: titel }),
      neben ? el("div", { class: "neben", text: neben }) : null
    ]),
    ...marker.filter(Boolean).map(m => el("span", { class: "marker " + m.art, text: m.text }))
  ]);
}

export function svgBlock(svgText) {
  return el("div", { html: svgText });
}

export function frage(text) {
  return window.confirm(text);
}
