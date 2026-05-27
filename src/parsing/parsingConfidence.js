// src/parsing/parsingConfidence.js
// CORE HARDENING v19
// Parsing Confidence Engine
//
// Purpose:
// Give the upload/parsing layer a stable, UI-friendly quality report.
// This file is intentionally independent from React and Dashboard logic.

const DEFAULT_REQUIRED_HEADERS = [
  "memberName",
  "idNumber",
  "policyNumber",
  "managerName",
  "productType",
  "currentBalance",
];

const HEADER_LABELS_HE = {
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

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function uniqueList(list) {
  return Array.from(new Set(normalizeList(list).map((item) => String(item).trim()).filter(Boolean)));
}

function isMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== "" && text !== "-" && text !== "—" && text.toLowerCase() !== "nan";
}

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/[₪,\s]/g, "")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFieldLabel(fieldName) {
  return HEADER_LABELS_HE[fieldName] || fieldName;
}

function calculateCompletenessScore({ unifiedRows, requiredHeaders }) {
  const rows = normalizeList(unifiedRows);
  const required = normalizeList(requiredHeaders);

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

function calculateHeaderScore({ detectedHeaders, requiredHeaders, missingRequiredHeaders }) {
  const required = normalizeList(requiredHeaders);

  if (!required.length) return 100;

  const missingCount = normalizeList(missingRequiredHeaders).length;
  const detectedRequiredCount = Math.max(required.length - missingCount, 0);

  return Math.round((detectedRequiredCount / required.length) * 100);
}

function calculateRowScore({ rawRows, unifiedRows }) {
  const rawCount = normalizeList(rawRows).length;
  const unifiedCount = normalizeList(unifiedRows).length;

  if (!rawCount && !unifiedCount) return 0;
  if (!rawCount && unifiedCount) return 80;

  const ratio = Math.min(unifiedCount / rawCount, 1);
  return Math.round(ratio * 100);
}

function getConfidenceLevel(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 55) return "partial";
  return "risky";
}

function getConfidenceTitle(level) {
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

function buildWarnings({
  rawRows,
  unifiedRows,
  detectedHeaders,
  missingRequiredHeaders,
  aliasMatchedHeaders,
  invalidRows,
  customWarnings,
}) {
  const warnings = [];

  const rawCount = normalizeList(rawRows).length;
  const unifiedCount = normalizeList(unifiedRows).length;
  const detectedCount = normalizeList(detectedHeaders).length;
  const missing = normalizeList(missingRequiredHeaders);
  const aliasMatches = normalizeList(aliasMatchedHeaders);
  const invalid = normalizeList(invalidRows);
  const externalWarnings = normalizeList(customWarnings);

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

  return uniqueList(warnings);
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

  const safeDetectedHeaders = uniqueList(detectedHeaders);
  const safeRequiredHeaders = uniqueList(requiredHeaders);

  const calculatedMissing =
    Array.isArray(missingRequiredHeaders)
      ? uniqueList(missingRequiredHeaders)
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
    version: "v19",
    managerName,
    fileName,
    score,
    level,
    title: getConfidenceTitle(level),
    rowCount: normalizeList(unifiedRows).length,
    rawRowCount: normalizeList(rawRows).length,
    detectedHeaders: safeDetectedHeaders,
    requiredHeaders: safeRequiredHeaders,
    missingRequiredHeaders: calculatedMissing,
    aliasMatchedHeaders: uniqueList(aliasMatchedHeaders),
    invalidRowCount: normalizeList(invalidRows).length,
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
      aliasMatchedHeaderCount: uniqueList(aliasMatchedHeaders).length,
      totalBalance: normalizeList(unifiedRows).reduce((sum, row) => {
        return sum + safeNumber(row?.currentBalance);
      }, 0),
    },
  };
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
