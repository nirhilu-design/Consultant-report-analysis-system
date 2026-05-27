// Path: src/unified/issuerAliases.js
// Stability 05:
//   1. Expanded issuer aliases for common Israeli pension/insurance/managing bodies.
//   2. Safer fuzzy matching: exact match first, then contains-match in both directions.
//   3. Neutral cleanup of legal suffixes so reports with long company names still map.

import { normalizeLooseText } from "./normalizers.js";

export const DEFAULT_ISSUER_ALIASES = {
  "הפניקס": [
    "הפניקס",
    "פניקס",
    "הפניקס חברה לביטוח",
    "הפניקס פנסיה",
    "הפניקס פנסיה וגמל",
    "הפניקס פנסיה וגמל בעמ",
    "הפניקס אקסלנס",
    "אקסלנס",
    "אקסלנס נשואה",
    "אקסלנס הפניקס",
  ],

  "הראל": [
    "הראל",
    "הראל פנסיה",
    "הראל פנסיה וגמל",
    "הראל חברה לביטוח",
    "הראל ביטוח",
  ],

  "כלל": [
    "כלל",
    "כלל ביטוח",
    "כלל חברה לביטוח",
    "כלל פנסיה",
    "כלל פנסיה וגמל",
    "כלל גמל",
  ],

  "מגדל": [
    "מגדל",
    "מגדל חברה לביטוח",
    "מגדל ביטוח",
    "מגדל מקפת",
    "מקפת",
    "מקפת אישית",
  ],

  "מנורה מבטחים": [
    "מנורה",
    "מבטחים",
    "מנורה מבטחים",
    "מנורה מבטחים פנסיה",
    "מנורה מבטחים פנסיה וגמל",
    "מנורה מבטחים ביטוח",
    "מנורה חברה לביטוח",
  ],

  "מיטב": [
    "מיטב",
    "מיטב דש",
    "מיטב גמל",
    "מיטב פנסיה",
    "מיטב בית השקעות",
  ],

  "אלטשולר שחם": [
    "אלטשולר",
    "אלטשולר שחם",
    "אלטשולר שחם גמל",
    "אלטשולר שחם פנסיה",
    "אלטשולר שחם גמל ופנסיה",
  ],

  "מור": [
    "מור",
    "מור גמל",
    "מור פנסיה",
    "מור גמל ופנסיה",
    "מור השקעות",
  ],

  "ילין לפידות": [
    "ילין",
    "ילין לפידות",
    "ילין לפידות גמל",
    "ילין לפידות קופות גמל",
  ],

  "אנליסט": [
    "אנליסט",
    "אנליסט גמל",
    "אנליסט קופות גמל",
  ],

  "איילון": [
    "איילון",
    "איילון חברה לביטוח",
    "איילון ביטוח",
  ],

  "הכשרה": [
    "הכשרה",
    "הכשרה חברה לביטוח",
    "הכשרה ביטוח",
  ],

  "פסגות": [
    "פסגות",
    "פסגות גמל",
    "פסגות פנסיה",
  ],

  "אינפיניטי": [
    "אינפיניטי",
    "אינפיניטי גמל",
    "אינפיניטי פנסיה",
  ],
};

function cleanupIssuerText(value) {
  return normalizeLooseText(value)
    .replace(/\bבעמ\b/g, "")
    .replace(/\bבע מ\b/g, "")
    .replace(/חברה לביטוח/g, "")
    .replace(/פנסיה וגמל/g, "")
    .replace(/קופות גמל/g, "")
    .replace(/גמל ופנסיה/g, "")
    .replace(/בית השקעות/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildIssuerAliasLookup(customAliases = {}) {
  const merged = {
    ...DEFAULT_ISSUER_ALIASES,
    ...customAliases,
  };

  const lookup = {};

  Object.entries(merged).forEach(([canonical, aliases]) => {
    [canonical, ...(aliases || [])].forEach((alias) => {
      const clean = cleanupIssuerText(alias);

      if (clean) {
        lookup[clean] = canonical;
      }
    });
  });

  return lookup;
}

export function canonicalIssuer(value, lookup = buildIssuerAliasLookup()) {
  const clean = cleanupIssuerText(value);

  if (!clean) return "יצרן לא צוין";

  if (lookup[clean]) return lookup[clean];

  const fuzzy = Object.entries(lookup)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([alias]) => {
      if (!alias || alias.length < 2) return false;
      return clean.includes(alias) || alias.includes(clean);
    });

  if (fuzzy) return fuzzy[1];

  return `יצרן לא מוכר - ${clean}`;
}
