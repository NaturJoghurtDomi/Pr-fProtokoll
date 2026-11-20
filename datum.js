export function isoDatum(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

export function heute() {
  return isoDatum(new Date());
}

function alsDate(datum) {
  return new Date(datum + "T00:00:00");
}

export function plusTage(datum, n) {
  const d = alsDate(datum);
  d.setDate(d.getDate() + n);
  return isoDatum(d);
}

export function tageDiff(a, b) {
  return Math.round((alsDate(b) - alsDate(a)) / 86400000);
}

export function isoKW(datum) {
  const d = alsDate(datum);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const tag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - tag);
  const jahr = t.getUTCFullYear();
  const jan1 = new Date(Date.UTC(jahr, 0, 1));
  const kw = Math.ceil(((t - jan1) / 86400000 + 1) / 7);
  return { jahr, kw };
}

export function kwLabel(datum) {
  const { jahr, kw } = isoKW(datum);
  return `${jahr}-KW${String(kw).padStart(2, "0")}`;
}

export function wochenstart(datum) {
  const d = alsDate(datum);
  const tag = d.getDay() || 7;
  d.setDate(d.getDate() - (tag - 1));
  return isoDatum(d);
}

export function monatsstart(datum) {
  return datum.slice(0, 8) + "01";
}

export function vorperiode(von, bis) {
  if (!von || !bis) return null;
  const laenge = tageDiff(von, bis) + 1;
  const bis2 = plusTage(von, -1);
  return { von: plusTage(bis2, -(laenge - 1)), bis: bis2 };
}

export function formatDauer(sekunden) {
  const m = Math.round((sekunden || 0) / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatDatum(datum) {
  const [j, m, t] = datum.split("-");
  return `${t}.${m}.${j}`;
}

export function formatUhr(sekunden) {
  const s = Math.max(0, Math.round(sekunden || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const zwei = n => String(n).padStart(2, "0");
  return h ? `${h}:${zwei(m)}:${zwei(rest)}` : `${m}:${zwei(rest)}`;
}
