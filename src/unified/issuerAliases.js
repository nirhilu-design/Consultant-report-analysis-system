const ISSUER_ALIASES = {
  "הפניקס": "הפניקס",
  "הפניקס חברה לביטוח": "הפניקס",
  "פניקס": "הפניקס",
  "הפינקס": "הפניקס",

  "הראל": "הראל",
  "הראל ביטוח": "הראל",

  "כלל": "כלל",
  "כלל ביטוח": "כלל",

  "מגדל": "מגדל",
  "מגדל חברה לביטוח": "מגדל",

  "מנורה": "מנורה מבטחים",
  "מנורה מבטחים": "מנורה מבטחים",

  "מיטב": "מיטב",
  "מיטב דש": "מיטב",

  "מור": "מור",

  "אלטשולר": "אלטשולר שחם",
  "אלטשולר שחם": "אלטשולר שחם",

  "ילין": "ילין לפידות",
  "ילין לפידות": "ילין לפידות",

  "אנליסט": "אנליסט",

  "איילון": "איילון",
};

export function normalizeIssuerName(rawIssuer) {
  if (!rawIssuer) {
    return "יצרן לא מוכר";
  }

  const cleaned = preprocessIssuerText(rawIssuer);

  return (
    ISSUER_ALIASES[cleaned] ||
    `יצרן לא מוכר - ${rawIssuer}`
  );
}

export function preprocessIssuerText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/["']/g, "")
    .replace(/[.,]/g, "")
    .replace(/־/g, "-");
}

export function isUnknownIssuer(issuerName) {
  return String(issuerName || "").startsWith(
    "יצרן לא מוכר"
  );
}

export function getAllCanonicalIssuers() {
  return [...new Set(Object.values(ISSUER_ALIASES))];
}
