export const HEADER_ALIAS_GROUPS = {
  employeeName: ["שם עובד", "שם לקוח", "עמית", "מבוטח", "employee name", "client name"],
  employeeId: ["תעודת זהות", "ת.ז", "מספר זהות", "id", "employee id"],
  issuer: ["גוף מוסדי", "יצרן", "חברה מנהלת", "issuer", "manager"],
  productType: ["סוג מוצר", "מוצר", "product", "product type"],
  accumulation: ["צבירה", "יתרה", "שווי צבירה", "accumulation", "balance"],
  deposit: ["הפקדה", "הפקדה חודשית", "monthly deposit", "deposit"],
};

export function normalizeHeader(header) {
  return String(header || "")
    .toLowerCase()
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .replace(/[\u200e\u200f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findCanonicalHeader(header) {
  const normalized = normalizeHeader(header);

  for (const [canonicalKey, aliases] of Object.entries(HEADER_ALIAS_GROUPS)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
      return canonicalKey;
    }
  }

  return null;
}

export function mapRowWithAliases(row = {}) {
  const mapped = { ...row };

  for (const [key, value] of Object.entries(row || {})) {
    const canonicalKey = findCanonicalHeader(key);
    if (canonicalKey && mapped[canonicalKey] === undefined) {
      mapped[canonicalKey] = value;
    }
  }

  return mapped;
}
