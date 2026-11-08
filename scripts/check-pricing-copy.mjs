#!/usr/bin/env node
/**
 * Asserts promo copy in index.html and README.md matches pricing.config.json.
 * The config mirrors the live cheba-man Worker checkout catalog. It is not billing logic.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "pricing.config.json"), "utf8"));
const files = ["index.html", "README.md"].map((name) => ({
  name,
  text: readFileSync(join(root, name), "utf8"),
}));

const failures = [];

function money(usd) {
  return `$${usd.toFixed(2)}`;
}

function packPhrase(pack) {
  return `${pack.credits} credits · ${pack.videos}×${pack.resolution}`;
}

function markdownRow(pack) {
  return `| ${pack.name} | ${money(pack.priceUsd)} | ${packPhrase(pack)} |`;
}

function htmlRow(pack) {
  return `<td>${pack.name}</td><td>${money(pack.priceUsd)}</td><td>${packPhrase(pack)}</td>`;
}

function fail(message) {
  failures.push(message);
}

const expectedCredits = { "480p": 50, "720p": 100 };
for (const [resolution, credits] of Object.entries(expectedCredits)) {
  if (config.resolutionCredits[resolution] !== credits) {
    fail(`resolutionCredits.${resolution} is ${config.resolutionCredits[resolution]}, expected ${credits}`);
  }
}

let creditsSumCheck = 0;
for (const pack of config.packs) {
  const cost = config.resolutionCredits[pack.resolution];
  if (cost == null) fail(`${pack.id} uses unknown resolution ${pack.resolution}`);
  if (pack.credits !== cost * pack.videos) {
    fail(
      `${pack.id} grants ${pack.credits} credits but ${pack.videos}×${pack.resolution} costs ${cost * pack.videos}`,
    );
  }
  creditsSumCheck += pack.credits;
  const html = files.find((file) => file.name === "index.html");
  const readme = files.find((file) => file.name === "README.md");
  const htmlLine = htmlRow(pack);
  const readmeLine = markdownRow(pack);
  if (!html.text.includes(htmlLine)) fail(`index.html is missing catalog row: ${htmlLine}`);
  if (!readme.text.includes(readmeLine)) fail(`README.md is missing catalog row: ${readmeLine}`);
}

if (!Number.isFinite(creditsSumCheck) || config.packs.length !== 5) {
  fail(`expected 5 packs, found ${config.packs.length}`);
}

const renderRule = "A 480p render costs 50 credits. A 720p render costs 100 credits.";
const banned = [
  "$8.88",
  "$16.99",
  "$39.90",
  "$39.9",
  "1100",
  "1500",
  "5000",
  "500 credits",
  "100 credits ≈ one 720p",
  "100 积分 ≈",
];

for (const file of files) {
  if (!file.text.includes(renderRule)) fail(`${file.name} is missing: ${renderRule}`);
  for (const phrase of banned) {
    if (file.text.includes(phrase)) fail(`${file.name} still contains stale pricing copy: ${phrase}`);
  }
}

if (failures.length) {
  console.error("pricing copy check failed:");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`pricing copy check ok (${config.packs.length} packs, ${files.map((f) => f.name).join(", ")})`);
for (const pack of config.packs) console.log(`  ${markdownRow(pack)}`);
