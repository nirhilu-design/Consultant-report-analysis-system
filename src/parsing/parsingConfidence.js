// src/parsing/parsingConfidence.js
// CORE HARDENING v19A
// Backward-compatible Parsing Confidence Engine
//
// Important:
// This file keeps legacy exports such as asArray,
// because safeRowBuilder.js imports them directly.

export function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

export function uniqueArray(value) {
  return Array.from(
    new Set(
      asArray(value)
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  );
}

export function isMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== "" && text !== "-" && text !== "—" && text.toLowerCase() !== "nan";
}

export function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/[₪,\s]/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const DEFAULT_REQUIRED_HEADERS = [
  "memberName",
  "idNumber",
  "policyNumber",
  "managerName",
  "productType",
  "currentBalance",
];

export const HEADER_LABELS_HE = {
  memberName: "שם מבוטח",
  idNumber: "תעודת זהות",
  policyNumber: "מספר פוליסה / חשבון",
  managerName: "גוף מנהל",
  productType: "סוג מוצר",
  currentBalance: "צבירה נוכחית",
  monthlyDeposit: "הפקדה חודשית",
  employerDeposit: "הפקדת מעסיק",
  employeeDeposit: "הפקדת עובד",
  compensationBalance: "יתרת פיצויים",
  savingsBalance: "יתרת תגמולים",
};

export function getFieldLabel(fieldName) {
  return HEADER_LABELS_HE[fieldName] || fieldName;
}

export function calculateCompletenessScore({ unifiedRows = [], requiredHeaders = DEFAULT_REQUIRED_HEADERS } = {}) {
  const rows = asArray(unifiedRows);
  const required = asArray(requiredHeaders);

  if (!rows.length) return 0;
  if (!required.length) return 100;

  let totalCells = 0;
  let filledCells = 0;

  rows.forEach((row) => {
    required.forEach((field) => {
      totalCells += 1;
      if (isMeaningfulValue(row?.[field])) filledCells += 1;
    });
  });

  if (!totalCells) return 0;
  return Math.round((filledCells / totalCells) * 100);
}

export function calculateHeaderScore({
  detectedHeaders = [],
  requiredHeaders = DEFAULT_REQUIRED_HEADERS,
  missingRequiredHeaders = [],
} = {}) {
  const required = asArray(requiredHeaders);
  if (!required.length) return 100;

  const missingCount = asArray(missingRequiredHeaders).length;
  const detectedRequiredCount = Math.max(required.length - missingCount, 0);

  return Math.round((detectedRequiredCount / required.length) * 100);
}

export function calculateRowScore({ rawRows = [], unifiedRows = [] } = {}) {
  const rawCount = asArray(rawRows).length;
  const unifiedCount = asArray(unifiedRows).length;

  if (!rawCount && !unifiedCount) return 0;
  if (!rawCount && unifiedCount) return 80;

  const ratio = Math.min(unifiedCount / rawCount, 1);
  return Math.round(ratio * 100);
}

export function getConfidenceLevel(score) {
  const numericScore = Number(score || 0);

  if (numericScore >= 90) return "excellent";
  if (numericScore >= 75) return "good";
  if (numericScore >= 55) return "partial";
  return "risky";
}

export function getConfidenceTitle(level) {
  switch (level) {
    case "excellent":
      return "קליטה מצוינת";
    case "good":
      return "קליטה תקינה";
    case "partial":
      return "קליטה חלקית";
    case "risky":
    default:
      return "קליטה דורשת בדיקה";
  }
}

export function buildWarnings({
  rawRows = [],
  unifiedRows = [],
  detectedHeaders = [],
  missingRequiredHeaders = [],
  aliasMatchedHeaders = [],
  invalidRows = [],
  customWarnings = [],
} = {}) {
  const warnings = [];

  const rawCount = asArray(rawRows).length;
  const unifiedCount = asArray(unifiedRows).length;
  const detectedCount = asArray(detectedHeaders).length;
  const missing = asArray(missingRequiredHeaders);
  const aliasMatches = asArray(aliasMatchedHeaders);
  const invalid = asArray(invalidRows);
  const externalWarnings = asArray(customWarnings);

  if (!rawCount) {
    warnings.push("לא נמצאו שורות מקור בקובץ.");
  }

  if (rawCount && !unifiedCount) {
    warnings.push("נמצאו שורות בקובץ, אבל לא נוצרו שורות Unified.");
  }

  if (!detectedCount) {
    warnings.push("לא זוהו כותרות מתאימות בקובץ.");
  }

  if (missing.length) {
    warnings.push(`חסרות כותרות חובה: ${missing.map(getFieldLabel).join(", ")}.`);
  }

  if (aliasMatches.length) {
    warnings.push(`חלק מהכותרות זוהו לפי Alias ולא לפי שם מדויק: ${aliasMatches.join(", ")}.`);
  }

  if (invalid.length) {
    warnings.push(`נמצאו ${invalid.length} שורות עם ערכים חריגים או חסרים.`);
  }

  externalWarnings.forEach((warning) => {
    if (warning) warnings.push(String(warning));
  });

  return uniqueArray(warnings);
}

export function buildParsingConfidenceReport(options = {}) {
  const {
    rawRows = [],
    unifiedRows = [],
    detectedHeaders = [],
    requiredHeaders = DEFAULT_REQUIRED_HEADERS,
    missingRequiredHeaders,
    aliasMatchedHeaders = [],
    invalidRows = [],
    customWarnings = [],
    managerName = "",
    fileName = "",
  } = options;

  const safeDetectedHeaders = uniqueArray(detectedHeaders);
  const safeRequiredHeaders = uniqueArray(requiredHeaders);

  const calculatedMissing = Array.isArray(missingRequiredHeaders)
    ? uniqueArray(missingRequiredHeaders)
    : safeRequiredHeaders.filter((field) => !safeDetectedHeaders.includes(field));

  const headerScore = calculateHeaderScore({
    detectedHeaders: safeDetectedHeaders,
    requiredHeaders: safeRequiredHeaders,
    missingRequiredHeaders: calculatedMissing,
  });

  const rowScore = calculateRowScore({ rawRows, unifiedRows });

  const completenessScore = calculateCompletenessScore({
    unifiedRows,
    requiredHeaders: safeRequiredHeaders,
  });

  const score = Math.round(
    headerScore * 0.4 +
    rowScore * 0.25 +
    completenessScore * 0.35
  );

  const level = getConfidenceLevel(score);

  const warnings = buildWarnings({
    rawRows,
    unifiedRows,
    detectedHeaders: safeDetectedHeaders,
    missingRequiredHeaders: calculatedMissing,
    aliasMatchedHeaders,
    invalidRows,
    customWarnings,
  });

  return {
    version: "v19A",
    managerName,
    fileName,
    score,
    level,
    title: getConfidenceTitle(level),
    rowCount: asArray(unifiedRows).length,
    rawRowCount: asArray(rawRows).length,
    detectedHeaders: safeDetectedHeaders,
    requiredHeaders: safeRequiredHeaders,
    missingRequiredHeaders: calculatedMissing,
    aliasMatchedHeaders: uniqueArray(aliasMatchedHeaders),
    invalidRowCount: asArray(invalidRows).length,
    warnings,
    metrics: {
      headerScore,
      rowScore,
      completenessScore,
    },
    summary: {
      detectedHeaderCount: safeDetectedHeaders.length,
      requiredHeaderCount: safeRequiredHeaders.length,
      missingRequiredHeaderCount: calculatedMissing.length,
      aliasMatchedHeaderCount: uniqueArray(aliasMatchedHeaders).length,
      totalBalance: asArray(unifiedRows).reduce((sum, row) => {
        return sum + safeNumber(row?.currentBalance);
      }, 0),
    },
  };
}

// Legacy-compatible alias.
// Existing files may import buildParsingConfidence instead of buildParsingConfidenceReport.
export function buildParsingConfidence(options = {}) {
  return buildParsingConfidenceReport(options);
}

export function createEmptyParsingConfidenceReport(extra = {}) {
  return buildParsingConfidenceReport({
    rawRows: [],
    unifiedRows: [],
    detectedHeaders: [],
    customWarnings: ["טרם בוצעה קליטה לקובץ זה."],
    ...extra,
  });
}

export function isParsingRisky(report) {
  if (!report) return true;
  return report.level === "risky" || Number(report.score || 0) < 55;
}

export function isParsingUsable(report) {
  if (!report) return false;
  return Number(report.score || 0) >= 55 && Number(report.rowCount || 0) > 0;
}

export default buildParsingConfidenceReport;
