import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isoDatum, plusTage, tageDiff, isoKW, kwLabel,
  wochenstart, monatsstart, vorperiode, formatDauer, formatDatum
} from "../datum.js";

test("isoDatum nimmt die lokalen Teile, nicht UTC", () => {
  assert.equal(isoDatum(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(isoDatum(new Date(2026, 11, 31)), "2026-12-31");
});

test("plusTage rechnet über Monats- und Jahresgrenzen", () => {
  assert.equal(plusTage("2026-01-31", 1), "2026-02-01");
  assert.equal(plusTage("2026-12-31", 1), "2027-01-01");
  assert.equal(plusTage("2026-01-08", -1), "2026-01-07");
});

test("tageDiff zählt auch über die Sommerzeitumstellung richtig", () => {
  assert.equal(tageDiff("2026-11-16", "2026-11-17"), 1);
  assert.equal(tageDiff("2026-03-28", "2026-03-30"), 2);
  assert.equal(tageDiff("2026-11-17", "2026-11-17"), 0);
});

test("isoKW folgt der ISO-Regel, auch am Jahreswechsel", () => {
  assert.deepEqual(isoKW("2026-01-01"), { jahr: 2026, kw: 1 });
  assert.deepEqual(isoKW("2025-12-29"), { jahr: 2026, kw: 1 });
  assert.deepEqual(isoKW("2026-12-31"), { jahr: 2026, kw: 53 });
  assert.deepEqual(isoKW("2027-01-01"), { jahr: 2026, kw: 53 });
  assert.deepEqual(isoKW("2026-11-17"), { jahr: 2026, kw: 47 });
});

test("kwLabel schreibt Jahr und Woche sortierbar", () => {
  assert.equal(kwLabel("2026-11-17"), "2026-KW47");
  assert.equal(kwLabel("2026-01-05"), "2026-KW02");
});

test("wochenstart liefert den Montag", () => {
  assert.equal(wochenstart("2026-11-17"), "2026-11-16");
  assert.equal(wochenstart("2026-11-22"), "2026-11-16");
  assert.equal(wochenstart("2026-11-16"), "2026-11-16");
});

test("monatsstart liefert den Ersten", () => {
  assert.equal(monatsstart("2026-11-17"), "2026-11-01");
});

test("vorperiode ist gleich lang und endet einen Tag vorher", () => {
  assert.deepEqual(vorperiode("2026-01-08", "2026-01-14"), { von: "2026-01-01", bis: "2026-01-07" });
  assert.deepEqual(vorperiode("2026-11-17", "2026-11-17"), { von: "2026-11-16", bis: "2026-11-16" });
  assert.equal(vorperiode(null, "2026-11-17"), null);
  assert.equal(vorperiode("2026-11-17", null), null);
});

test("formatDauer rundet auf Minuten und lässt die glatte Stunde ohne Rest", () => {
  assert.equal(formatDauer(0), "0 min");
  assert.equal(formatDauer(60), "1 min");
  assert.equal(formatDauer(750), "13 min");
  assert.equal(formatDauer(3600), "1 h");
  assert.equal(formatDauer(5700), "1 h 35 min");
  assert.equal(formatDauer(28800), "8 h");
});

test("formatDatum schreibt deutsch", () => {
  assert.equal(formatDatum("2026-11-17"), "17.11.2026");
});
