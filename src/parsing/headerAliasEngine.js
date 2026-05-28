// src/parsing/headerAliasEngine.js
// CORE HARDENING v20
// Header Alias Expansion
//
// Purpose:
// A central, reusable alias layer for manager files.
// This does not change the Unified Schema. It only improves header recognition.

export const HEADER_ALIAS_GROUPS = {
  employeeCode: [
    "קוד מזהה של העובד",
    "קוד עובד",
    "מספר עובד",
    "מס עובד",
    "מס' עובד",
    "עובד",
    "employee code",
    "employee id",
  ],
  employeeName: [
    "שם עובד",
    "שם הלקוח",
    "שם לקוח",
    "שם מלא",
    "עמית",
    "מבוטח",
    "employee name",
    "client name",
  ],
  firstName: ["שם פרטי", "פרטי", "first name"],
  lastName: ["שם משפחה", "משפחה", "last name"],
  employeeId: [
    "תעודת זהות",
    "ת.ז",
    "תז",
    "מספר זהות",
    "מספר תעודת זהות",
    "id",
    "id number",
    "employee id",
  ],
  issuer: [
    "גוף מוסדי",
    "גוף מנהל",
    "יצרן",
    "שם יצרן",
    "חברה מנהלת",
    "שם חברה מנהלת",
    "שם קופה מנהלת",
    "קרן פנסיה",
    "חברת ביטוח",
    "מנהל",
    "issuer",
    "manager",
  ],
  productType: [
    "סוג מוצר",
    "מוצר",
    "סוג קופה",
    "סוג פוליסה",
    "סוג תוכנית",
    "סוג תכנית",
    "product",
    "product type",
    "plan type",
  ],
  policyNumber: [
    "מספר פוליסה",
    "מס' פוליסה",
    "פוליסה",
    "מספר חשבון",
    "מס' חשבון",
    "מספר עמית",
    "מס' עמית",
    "מספר קופה",
    "מספר קופה/פוליסה",
    "מספר תכנית",
    "מספר תוכנית",
    "policy number",
    "account number",
  ],
  fundName: [
    "שם קרן הפנסיה",
    "שם קרן",
    "שם קופה",
    "שם מוצר",
    "שם המוצר",
    "שם תוכנית",
    "שם תכנית",
    "שם מסלול/קופה",
    "fund name",
    "product name",
  ],
  accumulation: [
    "צבירה",
    "צבירה נוכחית",
    "יתרה",
    "יתרה צבורה",
    "שווי צבירה",
    "סהכ ערכי פידיון",
    "סה\"כ ערכי פידיון",
    "סה״כ ערכי פידיון",
    "סך הכל ערכי פידיון",
    "סהכ ערכי פדיון",
    "סה\"כ ערכי פדיון",
    "סה״כ ערכי פדיון",
    "ערך פדיון כולל",
    "ערכי פדיון",
    "accumulation",
    "balance",
  ],
  deposit: [
    "הפקדה",
    "הפקדה חודשית",
    "סך הפקדה",
    "סהכ הפקדה",
    "סה\"כ הפקדה",
    "monthly deposit",
    "deposit",
  ],
  pensionSalary: [
    "שכר פנסיוני",
    "שכר",
    "משכורת",
    "שכר מבוטח",
    "שכר מדווח",
    "שכר קובע",
    "שכר לביטוח",
  ],
  depositFee: [
    "דמי ניהול מפרמיה באחוזים",
    "דמי ניהול מפרמיה",
    "דמי ניהול מהפקדה",
    "דמי ניהול מהפקדות",
    "דמי ניהול מהפקדות %",
    "שיעור דמי ניהול מהפקדה",
    "אחוז דמי ניהול מהפקדה",
    "מהפקדה",
    "דנ מהפקדה",
  ],
  accumulationFee: [
    "דמי ניהול מצבירה באחוזים",
    "דמי ניהול מצבירה",
    "דמי ניהול מהצבירה",
    "דמי ניהול מצבירה %",
    "שיעור דמי ניהול מצבירה",
    "אחוז דמי ניהול מצבירה",
    "מצבירה",
    "דנ מצבירה",
  ],
  depositFeeAgreement: [
    "דמי ניהול מהפקדה הסכם",
    "דמי ניהול מפרמיה בהסכם",
    "הסכם מהפקדה",
    "דמי ניהול מהפקדה לפי הסכם",
    "דנ מהפקדה הסכם",
  ],
  accumulationFeeAgreement: [
    "דמי ניהול מצבירה הסכם",
    "דמי ניהול מהצבירה בהסכם",
    "הסכם מצבירה",
    "דמי ניהול מצבירה לפי הסכם",
    "דנ מצבירה הסכם",
  ],
  investmentTrackRewards: [
    "שם מסלול השקעה - תגמולים",
    "שם מסלול השקעה תגמולים",
    "מסלול השקעה תגמולים",
    "מסלול תגמולים",
    "שם מסלול תגמולים",
    "מסלול השקעה",
    "שם מסלול השקעה",
  ],
  investmentTrackCompensation: [
    "שם מסלול השקעה - פיצויים",
    "שם מסלול השקעה פיצויים",
    "מסלול השקעה פיצויים",
    "מסלול פיצויים",
    "שם מסלול פיצויים",
  ],
  insuranceTrack: [
    "מסלול ביטוח בקרן הפנסיה",
    "מסלול ביטוח",
    "כיסוי ביטוחי",
    "שם מסלול ביטוח",
    "מסלול כיסוי",
  ],
  survivorWaiver: [
    "ויתור שארים",
    "ויתור על שארים",
    "כיסוי שארים",
    "שאירים",
    "פנסיית שארים",
  ],
  arrangementManager: [
    "מנהל הסדר",
    "מנהל ההסדר",
    "סוכן",
    "סוכנות",
    "שם סוכן",
    "מספר סוכן",
  ],
  employerGroupId: [
    "מספר ח.פ מעסיק",
    "מספר חפ מעסיק",
    "חפ מעסיק",
    "ח.פ מעסיק",
    "מזהה מעסיק",
    "מספר מעסיק",
  ],
  joinDate: [
    "תאריך הצטרפות",
    "מועד הצטרפות",
    "תאריך תחילת חברות",
    "תאריך פתיחת חשבון",
  ],
  validityMonth: [
    "חודש נכונות",
    "חודש דיווח",
    "חודש תוקף",
    "נכון לחודש",
    "תאריך נכונות",
  ],
};

export function normalizeHeader(header) {
  return String(header || "")
    .toLowerCase()
    .replace(/[\u00a0\u200e\u200f]/g, " ")
    .replace(/[״"]/g, "")
    .replace(/[׳']/g, "")
    .replace(/[.:]/g, "")
    .replace(/[־–—_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findCanonicalHeader(header) {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  for (const [canonicalKey, aliases] of Object.entries(HEADER_ALIAS_GROUPS)) {
    const normalizedAliases = aliases.map((alias) => normalizeHeader(alias)).filter(Boolean);

    if (normalizedAliases.includes(normalized)) {
      return canonicalKey;
    }

    const fuzzyMatch = normalizedAliases.some((alias) => {
      if (!alias || alias.length < 3 || normalized.length < 3) return false;
      return normalized.includes(alias) || alias.includes(normalized);
    });

    if (fuzzyMatch) {
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

export function buildHeaderIndex(headerRow = [], aliasGroups = HEADER_ALIAS_GROUPS) {
  if (!Array.isArray(headerRow)) {
    return {
      indexMap: {},
      detectedHeaders: [],
      aliasMatchedHeaders: [],
    };
  }

  const normalizedCells = headerRow.map((cell) => normalizeHeader(cell));
  const indexMap = {};
  const detectedHeaders = [];
  const aliasMatchedHeaders = [];

  Object.entries(aliasGroups).forEach(([field, aliases]) => {
    const normalizedAliases = aliases.map((alias) => normalizeHeader(alias)).filter(Boolean);

    const exactIndex = normalizedCells.findIndex((cell) => normalizedAliases.includes(cell));

    if (exactIndex >= 0) {
      indexMap[field] = exactIndex;
      detectedHeaders.push(field);

      const originalHeader = String(headerRow[exactIndex] || "").trim();
      if (normalizeHeader(originalHeader) !== normalizeHeader(field)) {
        aliasMatchedHeaders.push(originalHeader || field);
      }

      return;
    }

    const fuzzyIndex = normalizedCells.findIndex((cell) => {
      if (!cell || cell.length < 3) return false;

      return normalizedAliases.some((alias) => {
        if (!alias || alias.length < 3) return false;
        return cell.includes(alias) || alias.includes(cell);
      });
    });

    if (fuzzyIndex >= 0) {
      indexMap[field] = fuzzyIndex;
      detectedHeaders.push(field);
      aliasMatchedHeaders.push(String(headerRow[fuzzyIndex] || field).trim());
    }
  });

  return {
    indexMap,
    detectedHeaders: Array.from(new Set(detectedHeaders)),
    aliasMatchedHeaders: Array.from(new Set(aliasMatchedHeaders.filter(Boolean))),
  };
}

export function detectHeaderInfo(rows = [], options = {}) {
  const {
    maxHeaderRows = 10,
    requiredFields = ["employeeCode", "issuer", "policyNumber", "accumulation"],
    aliasGroups = HEADER_ALIAS_GROUPS,
    minScore = 2,
  } = options;

  const candidates = rows.slice(0, maxHeaderRows).map((row, index) => {
    const result = buildHeaderIndex(row, aliasGroups);
    const score = requiredFields.filter((field) => result.indexMap[field] !== undefined).length;

    return {
      index,
      score,
      map: result.indexMap,
      detectedHeaders: result.detectedHeaders,
      aliasMatchedHeaders: result.aliasMatchedHeaders,
    };
  });

  const best = candidates.sort((a, b) => b.score - a.score)[0];

  if (best?.score >= minScore) return best;

  return {
    index: 0,
    score: 0,
    map: {},
    detectedHeaders: [],
    aliasMatchedHeaders: [],
  };
}

export default {
  HEADER_ALIAS_GROUPS,
  normalizeHeader,
  findCanonicalHeader,
  mapRowWithAliases,
  buildHeaderIndex,
  detectHeaderInfo,
};
