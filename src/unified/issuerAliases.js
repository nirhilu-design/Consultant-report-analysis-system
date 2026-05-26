// NEW FILE
// Path: src/unified/issuerAliases.js

import { normalizeLooseText } from "./normalizers.js";

export const DEFAULT_ISSUER_ALIASES = {
  "הפניקס": [
    "הפניקס",
    "פניקס",
    "הפניקס חברה לביטוח",
    "הפניקס פנסיה",
    "הפניקס פנסיה וגמל",
    "אקסלנס",
    "אקסלנס הפניקס",
  ],

  "הראל": [
    "הראל",
    "הראל פנסיה",
    "הראל חברה לביטוח",
  ],

  "כלל": [
    "כלל",
    "כלל פנסיה",
    "כלל פנסיה וגמל",
  ],

  "מגדל": [
    "מגדל",
    "מגדל מקפת",
    "מקפת",
  ],

  "מנורה מבטחים": [
    "מנורה",
    "מבטחים",
    "מנורה מבטחים",
  ],

  "מיטב": [
    "מיטב",
    "מיטב דש",
  ],

  "אלטשולר שחם": [
    "אלטשולר",
    "אלטשולר שחם",
  ],

  "מור": [
    "מור",
    "מור גמל",
    "מור גמל ופנסיה",
  ],

  "ילין לפידות": [
    "ילין",
    "ילין לפידות",
  ],

  "אנליסט": [
    "אנליסט",
  ],

  "איילון": [
    "איילון",
  ],
};

export function buildIssuerAliasLookup(customAliases = {}) {
  const merged = {
    ...DEFAULT_ISSUER_ALIASES,
    ...customAliases,
  };

  const lookup = {};

  Object.entries(merged).forEach(([canonical, aliases]) => {
    [canonical, ...(aliases || [])].forEach((alias) => {
      const clean = normalizeLooseText(alias);

      if (clean) {
        lookup[clean] = canonical;
      }
    });
  });

  return lookup;
}

export function canonicalIssuer(value, lookup) {
  const clean = normalizeLooseText(value);

  if (!clean) return "יצרן לא צוין";

  if (lookup[clean]) return lookup[clean];

  const fuzzy = Object.entries(lookup).find(([alias]) => {
    return alias && clean.includes(alias);
  });

  if (fuzzy) return fuzzy[1];

  return `יצרן לא מוכר - ${clean}`;
}
