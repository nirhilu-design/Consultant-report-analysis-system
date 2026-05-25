export const DEFAULT_ISSUER_ALIASES = {
  "הפניקס": "הפניקס",
  "הפניקס חברה לביטוח": "הפניקס",
  "פניקס": "הפניקס",
  "הפינקס": "הפניקס",

  "הראל": "הראל",
  "הראל ביטוח": "הראל",
  "הראל חברה לביטוח": "הראל",

  "כלל": "כלל",
  "כלל ביטוח": "כלל",
  "כלל חברה לביטוח": "כלל",

  "מגדל": "מגדל",
  "מגדל חברה לביטוח": "מגדל",

  "מנורה": "מנורה מבטחים",
  "מנורה מבטחים": "מנורה מבטחים",
  "מנורה מבטחים פנסיה וגמל": "מנורה מבטחים",

  "מיטב": "מיטב",
  "מיטב דש": "מיטב",
  "מיטב בית השקעות": "מיטב",

  "מור": "מור",
  "מור גמל ופנסיה": "מור",

  "אלטשולר": "אלטשולר שחם",
  "אלטשולר שחם": "אלטשולר שחם",
  "אלטשולר שחם גמל ופנסיה": "אלטשולר שחם",

  "ילין": "ילין לפידות",
  "ילין לפידות": "ילין לפידות",

  "אנליסט": "אנליסט",
  "אנליסט קופות גמל": "אנליסט",

  "איילון": "איילון",
  "איילון חברה לביטוח": "איילון",
};

/**
 * New canonical alias name.
 * Keep this exported separately while the refactor is in progress.
 */
export const ISSUER_ALIASES = DEFAULT_ISSUER_ALIASES;

export function normalizeIssuerName(rawIssuer) {
  if (!rawIssuer) {
    return "יצרן לא מוכר";
  }

  const cleaned = preprocessIssuerText(rawIssuer);

  return (
    DEFAULT_ISSUER_ALIASES[cleaned] ||
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
  return [
    ...new Set(
      Object.values(DEFAULT_ISSUER_ALIASES)
    ),
  ];
}

export function getIssuerAliases() {
  return {
    ...DEFAULT_ISSUER_ALIASES,
  };
}
