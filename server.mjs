import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png"
};

createServer(async (anfrage, antwort) => {
  const pfad = anfrage.url.split("?")[0];
  const datei = join(import.meta.dirname, normalize(pfad === "/" ? "/index.html" : pfad));
  try {
    const inhalt = await readFile(datei);
    antwort.writeHead(200, {
      "content-type": TYPEN[extname(datei)] ?? "application/octet-stream",
      "cache-control": "no-store"
    });
    antwort.end(inhalt);
  } catch {
    antwort.writeHead(404).end("nicht gefunden");
  }
}).listen(8080, () => console.log("http://localhost:8080"));
